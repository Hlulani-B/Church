import { Session } from '../src/functions/session.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { Event } from '../src/functions/event.js'
import { cors } from '../lib/cors.js'
import {
  God,
  authenticate,
  matchesServerKey,
  roleGate,
  resolveAbsenceGathering,
  verifiedEmail,
  finish,
} from '../lib/god.js'

/*
  /api/leader — what a leader or an admin may do for the community they run.

  This is the second of the three endpoints god.js was split into by auth tier. Everything here
  speaks about a gathering or a group rather than about the caller alone, so one question is asked
  of every browser request before any of it runs: does this address lead — or admin — the community
  named in the body? The answer comes off the caller's community_members row, read against the email
  the Firebase token forces, never against whatever the body claims, so a leader of one fellowship
  cannot reach into another.

  Reading the roster and the attendance, and opening, watching or revising a check-in session, are
  all here because they belong to whoever runs the room. What a plain member does for themselves —
  their own user row, joining and creating communities, recording an absence, checking in with a
  PIN, seeing what is open — lives in /api/self; changing who is in a community, their roles and its
  join code lives in /api/admin. A request that belongs over there is refused here by the whitelist
  below, so a browser cannot reach a power it was not given by guessing an endpoint.
*/

// What a leader or an admin browser may do at this tier, and nothing else.
const LEADER_ACTIONS = {
  attendance: ['services', 'service'],
  admin: ['roster'],
  session: ['create', 'pin', 'manage', 'revise'],
  // The For-who box's two moves: read this community's people, and record one of them away.
  user: ['getUsers'],
  event: ['record_for'],
  // The functions page: what this community has planned, the planning of one more, one of them
  // opened out with everybody who has answered it, and a leader's signature on a receipt — or that
  // signature taken back when it was put on the wrong row.
  church_function: ['list', 'create', 'details', 'confirm'],
}

export default async function handler(req, res) {
  // Answer a cross-origin preflight before authenticate, which is POST-only and would 405 it.
  if (cors(req, res)) return
  const auth = await authenticate(req, res)
  if (!auth) return
  const { token } = auth

  let { action, params = {} } = req.body || {}
  // What a session create owes the `event` table once it has a session_id to point at.
  let creator = null
  const god = new God()

  if (!matchesServerKey(token)) {
    const { email, reason } = await verifiedEmail(token)
    if (!email) {
      console.warn('[leader] rejected bearer token:', reason)
      return res.status(401).json({
        error: 'that sign-in is not valid',
        reason: process.env.VERCEL_ENV === 'production' ? undefined : reason,
      })
    }
    if (!LEADER_ACTIONS[action]?.includes(params.function)) {
      return res
        .status(403)
        .json({ error: 'a signed-in browser may only touch its own user row and communities' })
    }
    params = { ...params, email }
    /*
      Everything this endpoint reaches reads or changes what a community looks like to other
      people: who was at each of its gatherings, its roster, and its check-in sessions. The
      caller's community_members row for that community_id settles it — a leader or an admin of
      that community and nobody else — before any branch below runs.
    */
    const link = await roleGate(god, email, params.community_id, 'leader', res)
    if (!link) return

    /*
      Recording that somebody else in this community will not be at a gathering — the write the
      For-who box on the admin and leader attendance pages makes, and the one write at this tier
      that touches anybody's attendance but the caller's own. The same hardenings /api/self
      applies to a member's own notice all stand here: the answer is forced to not attending, so
      this path cannot hand out a presence; the gathering is named by the session opened for that
      day, through the same shared helper; only these columns are rebuilt, so no session, place
      or checked-in time rides in on a body; and a row that already says present refuses the
      write, so a leader cannot talk anybody else's yes back into a no either. One hardening is
      this tier's own: the address comes from the body because the caller may name anybody, so
      that person's community_members row for exactly this community_id is read before anything
      is written — a leader of one fellowship cannot put an absence on a stranger — and the
      caller's token address is kept as `recorded_by`, whose hand put the notice down.
    */
    if (action === 'event' && params.function === 'record_for') {
      const event_date = String(params.event_date || '').trim()
      const reason = String(params.reason || '').trim()
      const member_email = String(params.user_email || '').trim()
      if (!event_date) {
        return res.status(400).json({ error: 'params.event_date is required to record an absence' })
      }
      if (!member_email) {
        return res
          .status(400)
          .json({ error: 'params.user_email is required to record who is not attending' })
      }
      const named_member = await new CommunityMember(god.url, god.key).find(
        member_email,
        params.community_id,
      )
      if (!named_member) {
        return res.status(403).json({
          error: 'that person is not a member of this community, so no absence can be recorded for them here',
        })
      }
      let event_name
      try {
        event_name = await resolveAbsenceGathering(
          god,
          params.community_id,
          event_date,
          params.event_name,
        )
      } catch (error) {
        return res.status(error.status || 500).json({ error: error.message })
      }
      const gatherings = new Event(god.url, god.key)
      const [already] = await gatherings.all({
        community_id: params.community_id,
        event_date,
        event_name,
        user_email: member_email,
      })
      if (already?.attend) {
        return res.status(403).json({
          error: 'that person is recorded as present at that gathering, and a yes is never taken back',
        })
      }
      params = {
        function: 'record',
        community_id: params.community_id,
        event_date,
        event_name,
        user_email: member_email,
        attend: false,
        reason: reason || null,
        recorded_by: email,
      }
    }

    /*
      What the leader and admin dashboards listen to, and the two changes they can make to a
      check-in. The gate above has already refused a plain member and confirmed this community_id
      is one the caller leads or admins, but each branch still needs the caller's own address here
      for a different reason.

      'manage' carries it so the read can mark which rows are the caller's own, and whether they
      are an admin, which together decide whose PINs come back: only rows they opened, and every
      row if they admin the community. 'revise' carries it because changing somebody else's
      check-in — cancelling it, or moving its radius — belongs to whoever opened it, or to an
      admin who can override any check-in in their community, and to nobody else. The session is
      read first so that is settled against the row's real creator, not against whatever the
      page chose to send.
    */
    if (action === 'session' && params.function === 'manage') {
      params = {
        function: 'manage',
        community_id: params.community_id,
        email,
        admin: link?.role === 'admin',
      }
    }
    if (action === 'session' && params.function === 'revise') {
      const session_id = String(params.session_id || '')
      if (!session_id) {
        return res.status(400).json({ error: 'params.session_id is required to change a check-in' })
      }
      const sessions = new Session(god.url, god.key)
      const one = await sessions.find(session_id)
      if (!one || one.community_id !== params.community_id) {
        return res.status(404).json({ error: 'there is no such check-in in this community' })
      }
      if (one.created_by !== email && link?.role !== 'admin') {
        return res.status(403).json({
          error:
            'only the person who opened a check-in, or an admin of this community, can change it',
        })
      }
      // Only these two moves are open to a dashboard; everything else on the row is fixed at opening.
      const changes = {}
      if (params.changes?.cancel === true) changes.cancel = true
      if (params.changes && Object.prototype.hasOwnProperty.call(params.changes, 'radius')) {
        changes.radius = params.changes.radius
      }
      params = { function: 'revise', session_id, changes }
    }
    /*
      Opening a check-in session writes two rows: the session itself, and the creator's own
      attendance at the gathering they just opened — the same shape every member's row will have,
      their address, a yes, the session it belongs to and the place it was opened from. What the
      page gets to choose is the PIN it was shown, the two times, which community, what the
      gathering is called and where the device holding this page is. Everything else is filled in
      here: `created_by` and the address the attendance row speaks about are the token's, never
      the body's; `date` is cut out of the start the leader typed rather than promised separately,
      because a row whose day disagrees with its own start is a row nobody can trust later; and the
      PIN has to be the four digits this server drew.

      The two coordinates are required, and that is deliberate rather than tidy. They are what a
      check-in is measured against — the distance from this point is the whole answer to somebody
      entering a PIN they were told by a friend, or typing one from a different town — so a session
      with no place is a session that cannot refuse a cheat. The gathering, by contrast, need not
      be named: `event.event_name` is not nullable and helps make an attendance row unique, so one
      left blank is filed under a standing default rather than refused.
    */
    if (action === 'session' && params.function === 'create') {
      if (!/^\d{4}$/.test(String(params.pin || ''))) {
        return res
          .status(400)
          .json({ error: 'params.pin must be the four digits this server drew' })
      }
      /*
        The gathering's name is optional. Its column is not nullable and helps make an attendance
        row unique, so a session opened without one is filed under a standing default — the register
        still has something to call the day, and naming it properly is a nicety, not a gate.
      */
      const event_name = String(params.event_name || '').trim() || 'Gathering'
      const started = String(params.started_at || '')
      const ended = String(params.ended_at || '')
      const startDate = new Date(started)
      const endDate = new Date(ended)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'params.started_at and params.ended_at are both needed, as a date with a time',
        })
      }
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'that session ends before it starts' })
      }
      /*
        A session that takes check-ins from anywhere does not care where the leader's device is
        standing — a phone that refuses to say where it is must not be allowed to block opening
        it. The pair is normalised to null when the reading is refused or absent, so the session
        row and the creator's own attendance row both say "no place" rather than a silent NaN that
        every later distance check would have to remember to reject.
      */
      const rawLat =
        params.latitude === null || params.latitude === undefined ? NaN : Number(params.latitude)
      const rawLng =
        params.longitude === null || params.longitude === undefined
          ? NaN
          : Number(params.longitude)
      const allow_any_radius = params.allow_any_radius === true
      const hasPlace =
        Number.isFinite(rawLat) &&
        Number.isFinite(rawLng) &&
        Math.abs(rawLat) <= 90 &&
        Math.abs(rawLng) <= 180
      if (!hasPlace && !allow_any_radius) {
        return res.status(400).json({
          error:
            'params.latitude and params.longitude are both needed, as this device reported them — or turn on “Allow check-in from anywhere”',
        })
      }
      const latitude = hasPlace ? rawLat : null
      const longitude = hasPlace ? rawLng : null
      /*
        How near the room a check-in has to come from, in metres, and whether that question is
        asked at all. Both are the leader's to decide, and decided in the room: a hall where the
        signal reads badly is worth a wider number, and a gathering that meets in three towns at
        once is worth turning the rule off. A blank radius stays blank rather than being
        defaulted here, because a null reads back upstream as no limit, which is the honest
        outcome of a leader who set no number; and a radius kept alongside `allow_any_radius` is
        stored but unused, so switching the rule back off later returns to what was first set.
      */
      const radius =
        params.radius === null || params.radius === undefined || params.radius === ''
          ? null
          : Number(params.radius)
      if (radius !== null && (!Number.isFinite(radius) || radius <= 0 || radius > 20000)) {
        return res
          .status(400)
          .json({ error: 'params.radius is a distance in metres, from 1 to 20000' })
      }
      // The leader typed a local wall-clock day, and the browser sends it as `date` so the record
      // is filed under the day the room recognises rather than the UTC day an evening service
      // spills into. An older caller that sends no day falls back to the start instant's own date.
      const localDay = String(params.date || '').slice(0, 10)
      const date = /^\d{4}-\d{2}-\d{2}$/.test(localDay)
        ? localDay
        : startDate.toISOString().slice(0, 10)
      params = {
        function: 'create',
        community_id: params.community_id,
        pin: String(params.pin),
        created_by: email,
        date,
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        event_name,
        latitude,
        longitude,
        radius,
        allow_any_radius,
      }
      /*
        The attendance row is held back until the session insert answers with its id, which is
        what ties a yes to the PIN, the window and the place rather than to a day on its own. A
        reason is cleared rather than left: whoever opened the session is answering for themselves
        at their own gathering, and any apology they sent for it beforehand is contradicted by the
        act of running it.
      */
      creator = {
        community_id: params.community_id,
        event_date: date,
        event_name,
        user_email: email,
        attend: true,
        reason: null,
        recorded_by: email,
        latitude,
        longitude,
      }
    }
    /*
      Planning a function: what it is called, the day it is held, where, and whether it costs
      anything. The shape is the one every write here keeps — the columns the page gets to choose
      are named out one by one, so nothing that was not asked for rides in on a body, and
      `created_by` is the address off the caller's token rather than the one in the request. Two
      of the refusals are the table's own rules said in words a page can show: the
      `amount_matches_payment` check refuses a number against no payment requirement and refuses
      nothing against a requirement, and `numeric(10,2)` holds two decimals and no more, so both
      are settled here instead of arriving back as a 23514 nobody can interpret.

      A function that asks for no money is not stored as zero. It is stored with no amount at all,
      which is what the check means by free, and what keeps a later read from showing "R 0.00 per
      head" for a gathering nobody is being charged for.
    */
    if (action === 'church_function' && params.function === 'create') {
      const name = String(params.name || '').trim()
      if (!name) {
        return res.status(400).json({ error: 'params.name is required — a function has to be called something' })
      }
      const function_date = String(params.function_date || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(function_date)) {
        return res
          .status(400)
          .json({ error: 'params.function_date is the day the function is held, as YYYY-MM-DD' })
      }
      const requires_payment = params.requires_payment === true
      let amount = null
      if (requires_payment) {
        amount =
          params.amount === null || params.amount === undefined || params.amount === ''
            ? NaN
            : Number(params.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({
            error: 'a function that asks for money needs an amount above zero — turn the requirement off if nobody is paying',
          })
        }
        if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-9 || amount >= 100000000) {
          return res.status(400).json({
            error: 'that amount is more than two decimal places, or more than the table can hold',
          })
        }
        // Fixed to the two the column keeps, so the number the page is answered with is the one
        // that was stored rather than one the browser drew.
        amount = Math.round(amount * 100) / 100
      }
      const location = String(params.location || '').trim()
      params = {
        function: 'create',
        community_id: params.community_id,
        name,
        function_date,
        location: location || null,
        requires_payment,
        amount,
        created_by: email,
      }
    }
    /*
      Opening one function out. The community the caller leads was settled above, so all that is
      asked here is which function: a bare id, digits only, because the column is a bigint and a
      letter in the url would otherwise reach PostgREST as a bad comparison rather than an answer
      here. Which community the row really belongs to is not the page's to say — the class reads the
      row and compares its community_id with the gated one.
    */
    if (action === 'church_function' && params.function === 'details') {
      const function_id = String(params.function_id ?? '').trim()
      if (!/^\d+$/.test(function_id)) {
        return res
          .status(400)
          .json({ error: 'params.function_id is the number a planned function is addressed by' })
      }
      params = {
        function: 'details',
        community_id: params.community_id,
        function_id,
      }
    }
    /*
      Checking one person's receipt off, and undoing that check. The register is the only page that
      asks, and of everything on the row only two columns move: whose signature it is and when it was
      put there, and neither of them comes from the body. `confirmed_by` is the address off this
      caller's token, so the row says who checked it because they were the one signed in, and
      `confirmed_at` is stamped by the class. Which person is being checked does come from the body,
      because a leader acts on other people's rows — the class still reads the function first and
      refuses one that lives outside the community gated above, so a leader of one fellowship cannot
      sign or unsign in another. `confirm: false` is the un-do, and the rest of the body is dropped
      rather than passed on, so nothing else about the payment can ride in on this path.
    */
    if (action === 'church_function' && params.function === 'confirm') {
      const function_id = String(params.function_id ?? '').trim()
      if (!/^\d+$/.test(function_id)) {
        return res
          .status(400)
          .json({ error: 'params.function_id is the number a planned function is addressed by' })
      }
      const user_email = String(params.user_email ?? '').trim()
      if (!user_email) {
        return res
          .status(400)
          .json({ error: 'params.user_email is required to say whose receipt is being checked' })
      }
      params = {
        function: 'confirm',
        community_id: params.community_id,
        function_id,
        user_email,
        confirmed_by: email,
        confirm: params.confirm !== false,
      }
    }
  }

  return finish(god, action, params, creator, res)
}
