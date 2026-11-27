import { Community } from '../src/functions/community.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { AdminDashboard } from '../src/functions/admin_dashboard.js'
import { Event } from '../src/functions/event.js'
import { Session, distanceInMetres, pickOpenSession } from '../src/functions/session.js'
import { cors } from '../lib/cors.js'
import {
  God,
  SELF_FIELDS,
  authenticate,
  matchesServerKey,
  reading,
  resolveAbsenceGathering,
  verifiedEmail,
  finish,
} from '../lib/god.js'

/*
  /api/self — what any signed-in member may do for themselves.

  This is one of the three endpoints god.js was split into by auth tier. Nothing here needs a role:
  a person reads their own user row, opens and joins communities, becomes the first member of a
  community they just created, gives notice of an absence, checks themselves in with a PIN, answers a
  function the fellowship has planned, and asks what is open for check-in right now. Every write is
  about the caller, whose address the Firebase token forces over anything in the body.

  Reading the roster and the attendance, and opening or managing a check-in session, live in
  /api/leader; changing who is in a community, its roles and its join code live in /api/admin, as does
  the functions page's register, which counts everybody's answers under a function rather than one
  person's. Taking yourself out of a community is here, because that write is about the caller rather
  than about the fellowship. A request that belongs over there is refused here by the whitelist below,
  so a browser cannot reach a leader or admin power by guessing an endpoint.
*/

// What a signed-in browser may do at this tier, and nothing else.
const SELF_ACTIONS = {
  user: ['find', 'create', 'update'],
  // 'join' is the typed code; 'join_at_session' is the QR scan, which proves its way in with the
  // PIN of a check-in that is open right now rather than with a code the person was handed.
  community: ['memberOf', 'create', 'join', 'join_at_session'],
  member: ['create', 'find', 'leave'],
  // Only the names of the people who lead, never the whole roster — that stays a leader's read.
  admin: ['hosts'],
  event: ['record', 'checkin'],
  session: ['open', 'live'],
  // Any signed-in person may leave product feedback about the app itself, and any signed-in
  // person may read what everybody else has said. The table is not community-scoped, so no
  // membership check applies; the address on the row is the token's, which is what makes the
  // pile attributable rather than anonymous.
  feedback: ['create', 'all'],
  /*
    A planned function, from the member's side: what is still to come, what one of them says about
    me, and my own answer to it. The register of who has come and who has paid stays a leader's read
    at /api/leader — this tier only ever reads the list and writes the caller's own two rows.
  */
  church_function: ['available', 'rsvp', 'respond'],
}

export default async function handler(req, res) {
  // Answer a cross-origin preflight before authenticate, which is POST-only and would 405 it.
  if (cors(req, res)) return
  const auth = await authenticate(req, res)
  if (!auth) return
  const { token } = auth

  let { action, params = {} } = req.body || {}
  const god = new God()

  if (!matchesServerKey(token)) {
    const { email, reason } = await verifiedEmail(token)
    if (!email) {
      console.warn('[self] rejected bearer token:', reason)
      return res.status(401).json({
        error: 'that sign-in is not valid',
        reason: process.env.VERCEL_ENV === 'production' ? undefined : reason,
      })
    }
    if (!SELF_ACTIONS[action]?.includes(params.function)) {
      return res
        .status(403)
        .json({ error: 'a signed-in browser may only touch its own user row and communities' })
    }
    const links = new CommunityMember(god.url, god.key)
    params = { ...params, email }

    /*
      Recording yourself as not attending is one of the two attendance writes a browser has, and
      the one the absence box on the member's page makes. Three things are forced and one is
      refused. Forced: the address the row speaks about is the token's, never the body's; the
      answer is always false, so this path cannot be turned into the presence the branch below it
      writes; and only these columns are passed on, which is what keeps a request from writing
      recorded_by, a session or a latitude. A reason may be left out, and an empty one is sent as
      null rather than as the empty string; when one is given it is the caller's own wording, kept
      exactly as typed rather than matched to a list. Refused: a row that already says present is
      never turned into an absence. Being there is a fact about a day that has gone by, and a yes
      that could be taken back would end up recording whoever edited the list rather than who was
      in the room. A date that has not come is allowed — that is the point of the box — because an
      apology travels ahead of the gathering it is about.
    */
    if (action === 'event' && params.function === 'record') {
      const event_date = String(params.event_date || '').trim()
      let event_name = String(params.event_name || '').trim()
      // Optional: an empty box writes no reason at all, which is recorded as null.
      const reason = String(params.reason || '').trim()
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to record that you are not attending' })
      }
      if (!event_date) {
        return res
          .status(400)
          .json({ error: 'params.event_date is required to record an absence' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can record themselves as not attending' })
      }
      /*
        The gathering is named by the session, not typed into the box — so when no name arrives
        with the request, the server reads it back off this community's sessions for that day, in
        the one helper /api/leader reaches through the same door when the For-who box names
        somebody else. A name that does arrive — from an older caller, or from any path that
        already knows the gathering — is kept exactly as given, so this only fills the box the
        absence form no longer has.
      */
      try {
        event_name = await resolveAbsenceGathering(god, params.community_id, event_date, event_name)
      } catch (error) {
        return res.status(error.status || 500).json({ error: error.message })
      }
      const gatherings = new Event(god.url, god.key)
      const [already] = await gatherings.all({
        community_id: params.community_id,
        event_date,
        event_name,
        user_email: email,
      })
      if (already?.attend) {
        return res
          .status(403)
          .json({ error: 'you are recorded as present at that gathering, and a yes is never taken back' })
      }
      params = {
        function: 'record',
        community_id: params.community_id,
        event_date,
        event_name,
        user_email: email,
        attend: false,
        reason: reason || null,
      }
    }
    /*
      Checking in with a PIN is the second attendance write a browser has, and the only one that
      can answer yes. Everything that decides the yes is read by the server instead of being
      asked of the page: the PIN is matched against the session table, the window, the day, the
      gathering's name and the place it was opened from all come off that row, the address comes
      from the token, and the arrival time comes off this function's own clock. What the page
      contributes is four digits and the two coordinates its device reported — which is the whole
      point of the box, since a room is checked in from sixty phones and nobody types sixty names.

      It is filed under 'event' rather than 'session' deliberately, and it sits at this tier for the
      same reason: a plain member stood in the room is exactly who this row is about, and a check-in
      that answered to the leader tier would refuse every one of them.

      The distance rule is the reason the reading is asked for at all: four digits can be told to
      a friend, texted to a phone, or read off a screenshot, so the PIN on its own proves that
      somebody knows about a gathering, not that they came to it. Turning it off is the leader's
      call and theirs alone, made in the room as the session is opened, and it is stored on the
      row rather than kept here.
    */
    if (action === 'event' && params.function === 'checkin') {
      const pin = String(params.pin || '').trim()
      if (!/^\d{4}$/.test(pin)) {
        return res
          .status(400)
          .json({ error: 'params.pin must be the four digits the leader read out' })
      }
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required to check in' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can check in at one of its gatherings' })
      }
      const now = new Date()
      /*
        Those four digits are only unique within one day — `unique (community_id, date, pin)` —
        so the same PIN can belong to this Sunday and next, and the window decides which one is
        being stood in now. A cancelled session is not stood in at all: whoever opened it called it
        off, and its PIN records nobody from that moment. The newest start wins if two somehow
        overlap.
      */
      const openings = await new Session(god.url, god.key).all({
        community_id: params.community_id,
        pin,
      })
      /*
        A scanned QR names one gathering, not just its four digits, so the check-in is held to the
        row the code points at. A PIN that happens to repeat against a stale id, or an id carried
        over from a different community, simply finds nothing here — a code and a set of digits
        that do not line up on the same row is a refusal, not a coin-flip between candidates.
      */
      const requested = params.session_id ? String(params.session_id).trim() : ''
      const named = requested
        ? openings.filter((one) => one.session_id === requested)
        : openings
      /*
        The same window rule that the join-by-scan below applies, reached through the same helper:
        if it ever moves, it has to move for both at once, or a room full of phones ends up
        disagreeing with the register about who was standing where.
      */
      const open = pickOpenSession(named, { now })
      if (!open) {
        if (requested && !named.length) {
          return res
            .status(400)
            .json({ error: 'that code and those digits do not name a check-in here' })
        }
        if (!named.length) {
          return res
            .status(400)
            .json({ error: 'no check-in is open in this community on those four digits' })
        }
        if (named.every((one) => one.cancel === true)) {
          return res
            .status(400)
            .json({ error: 'that check-in was called off, so its PIN no longer records anybody' })
        }
        /*
          No time is quoted here, and that is not laziness: this function runs in UTC and the
          room does not, so a clock printed server-side is a clock wrong by the offset between
          the two. Which of the two it is comes back as its own refusal, and the leader standing
          in front of the room is the one who can say the hour.
        */
        const last = named.reduce(
          (best, one) => (new Date(one.ended_at) > new Date(best.ended_at) ? one : best),
          named[0],
        )
        return res.status(400).json({
          error:
            new Date(last.started_at) > now
              ? 'that check-in has not opened yet — ask the leader again when it starts'
              : 'that check-in has closed, so the PIN no longer records anybody at it',
        })
      }
      /*
        A session seeded before these columns existed names no gathering, and `event.event_name`
        is both not nullable and part of what makes an attendance row unique — so there is no row
        this could write, and saying so beats a constraint error nobody could interpret.
      */
      if (!open.event_name) {
        return res.status(400).json({
          error:
            'that session was opened without naming a gathering, so nobody can be checked in at it — ask the leader to open a new one',
        })
      }
      /*
        The person who opened a session does not check in to it. Their own attendance row was
        written as a yes the moment the session was saved, at /api/leader — so these digits are
        their own secret, and typing them back would either re-assert a fact that stands or, worse,
        be read as a fresh arrival. The row that already holds them comes back unchanged, said as
        the arrival it is, and nothing is written.
      */
      const gatherings = new Event(god.url, god.key)
      if (open.created_by === email) {
        const [own] = await gatherings.all({
          community_id: params.community_id,
          event_date: open.date,
          event_name: open.event_name,
          user_email: email,
        })
        if (own?.attend) {
          return res.status(200).json({ data: { ...own, already: true, metres: null } })
        }
        return res.status(400).json({
          error: 'you opened this check-in — your attendance is written when you open it, not from its PIN',
        })
      }
      const latitude = reading(params.latitude)
      const longitude = reading(params.longitude)
      const reported =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180
      /*
        Three ways this check-in asks no question about distance: the leader turned the rule off,
        the session carries no radius, or it carries a radius but no place of its own to measure
        from. The last two are what every seeded session row is, so those PINs record anybody
        standing anywhere — which is documented rather than quietly fixed here.
      */
      const limit =
        open.allow_any_radius === true ||
        open.radius === null ||
        open.radius === undefined ||
        !Number.isFinite(open.latitude) ||
        !Number.isFinite(open.longitude)
          ? null
          : Number(open.radius)
      if (limit !== null && !reported) {
        return res.status(403).json({
          error:
            'this check-in is only taken from near where it was opened, so it needs the position this device reports',
        })
      }
      const metres =
        reported && limit !== null
          ? Math.round(distanceInMetres({ latitude: open.latitude, longitude: open.longitude }, { latitude, longitude }))
          : null
      if (limit !== null && metres !== null && metres > limit) {
        return res.status(403).json({
          error: `you are ${metres} m from where this was opened, and it only takes check-ins within ${Math.round(limit)} m of that`,
        })
      }
      const [already] = await gatherings.all({
        community_id: params.community_id,
        event_date: open.date,
        event_name: open.event_name,
        user_email: email,
      })
      /*
        Two taps are the same arrival twice. `checked_in_at` is the time the room was walked into,
        so a row that already says present is left exactly as it was written and this request
        changes nothing — otherwise the last tap would be remembered as the arrival, and a
        register that moves backwards is worse than one that is short.
      */
      if (already?.attend) {
        return res.status(200).json({ data: { ...already, already: true, metres } })
      }
      /*
        An apology sent earlier for the same gathering is overwritten, and that is the right
        answer rather than an exception: a notice says somebody will not come, and they came.
        `latitude` and `longitude` carry the gathering's place, the same pair every other row at
        this session will hold and the pair the creator's own row was written with, while the
        `checkin_` columns carry where this phone was. Two different questions, and the columns
        already say which is which.
      */
      params = {
        function: 'record',
        community_id: params.community_id,
        event_date: open.date,
        event_name: open.event_name,
        user_email: email,
        attend: true,
        reason: null,
        recorded_by: email,
        session_id: open.session_id,
        checked_in_at: now.toISOString(),
        checkin_latitude: reported ? latitude : null,
        checkin_longitude: reported ? longitude : null,
        latitude: open.latitude,
        longitude: open.longitude,
      }
    }
    // Only name and surname survive a self update; a browser cannot move a row onto another address.
    if (params.function === 'update') {
      const allowed = SELF_FIELDS[action] ?? []
      const changes = Object.fromEntries(
        Object.entries(params.changes || {}).filter(([key]) => allowed.includes(key)),
      )
      if (!Object.keys(changes).length) {
        return res
          .status(400)
          .json({ error: `params.changes must hold at least one of ${allowed.join(', ')}` })
      }
      params = { ...params, changes }
    }
    /*
      The address that opened a community is recorded with it, and it is taken from the id token and
      not from the body: the one person who could otherwise name themselves the owner of somebody
      else's fellowship is the person this later protects against, when they ask for everything in it
      to be deleted.
    */
    if (action === 'community' && params.function === 'create') {
      const name = String(params.name || '').trim()
      if (!name) {
        return res.status(400).json({ error: 'params.name is required to open a community' })
      }
      params = { ...params, name, created_by: email }
    }
    /*
      Making yourself a member with role admin is only safe while the community has no
      members at all, which is the moment a creator joins the group they just opened.
      Adding to a community that already has people would hand over their attendance and
      testimonies, so that stays behind GOD_SERVER_KEY.
    */
    if (action === 'member' && params.function === 'create') {
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required to add yourself to a community' })
      }
      const everyone = await links.all({ community_id: params.community_id })
      if (everyone.length) {
        return res
          .status(403)
          .json({ error: 'that community already has members, so only the server key can add one' })
      }
      params = { ...params, role: 'admin' }
    }
    /*
      Leaving a community, which is the removal an admin does to somebody else done to your own row.
      The address needs no checking because it has none: `params.email` was written from the id token
      above, and the body's version of it was thrown away with it, so this cannot take a neighbour out
      of a fellowship or drop somebody from the wrong one. Two things are refused before the link is
      deleted. Nobody leaves a community they are not in, which would otherwise answer as a success
      having changed nothing. And the last admin cannot walk out — the same refusal /api/admin makes
      when somebody tries to take an only admin's role away, because a community left with no admin
      has nobody who can read its roster, change its join code or clear its record, and no way back
      except the server key. Making one more person an admin is the way through, and it takes a minute.

      Everything the person recorded stays. Their attendance, their servings, the prayers they asked
      for and their name on the users row are all still there afterwards, and their testimonies stay
      unless they ask for those back too, which is a question the page asks and this endpoint does not
      answer: the address on a testimony row is ciphertext, and only the browser holding the key can
      say which rows are anybody's.
    */
    if (action === 'member' && params.function === 'leave') {
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required to leave a community' })
      }
      const own = await links.find(email, params.community_id)
      if (!own) {
        return res.status(400).json({ error: 'you are not a member of that community' })
      }
      if (own.role === 'admin') {
        const everyone = await links.all({ community_id: params.community_id })
        if (everyone.filter((one) => one.role === 'admin').length <= 1) {
          return res.status(403).json({
            error:
              'you are the only admin here, so make somebody else an admin before you leave — a community with nobody to run it cannot change its code or clear its records',
          })
        }
      }
      params = { function: 'leave', community_id: params.community_id, email }
    }
    /*
      Whether there is anything to check in to, which is what a dashboard asks on a timer so the
      PIN box stays out of the way until a leader has opened a session. Any member of the
      community may ask it — the person stood in the room with four digits to type is a plain
      member, and hiding the box behind a leader role would hide it from exactly the people it
      exists for. The answer is the name, the window and whether a distance will be asked about,
      and neither the PIN nor the place the session was opened at, neither of which this question
      needs and either of which would answer the check-in before it was asked.
    */
    if (action === 'session' && params.function === 'open') {
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to read its open check-ins' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can read what is open for check-in there' })
      }
      const openings = await new Session(god.url, god.key).open({
        community_id: params.community_id,
        now: new Date().toISOString(),
      })
      return res.status(200).json({ data: openings })
    }
    /*
      Whether anything is live or scheduled in this community, which is what a member's dashboard
      asks on a timer so the whole fellowship hears that attendance is being taken — not only the
      people already staring at a check-in box. The same membership rule as 'open' applies, and the
      same answer: name, window and whether a distance will be asked about, never the PIN. The
      difference is that 'live' also returns a session whose window has not started yet, so a
      gathering scheduled for later today is announced before the leader reads out its digits.
    */
    if (action === 'session' && params.function === 'live') {
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to read its live check-ins' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can read what is live there' })
      }
      const openings = await new Session(god.url, god.key).live({
        community_id: params.community_id,
        // The token's address decides which of these rows the caller opened; it is not a body value.
        email,
      })
      return res.status(200).json({ data: openings })
    }
    /*
      Product feedback always travels under the caller's own hand. The address that lands on the
      row is the one this handler already put into `params.email` — read off the verified ID token,
      never out of the body — so a signed-in person cannot post into the pile unsigned and cannot
      post as anybody else. There is no community_id on this table, and the pile is read by every
      signed-in person, so the row's only owner is the address on it.
    */

    /*
      Who runs this community, for the member's dashboard: its admin(s) and its leaders, by name.
      Any member may ask — the people who lead a fellowship are not secret from the people in it —
      so the only gate is that the caller belongs to the community, read off the token rather than
      the body. The answer carries names and roles and no email; the roster that carries addresses
      is a leader's read, opened at /api/leader.
    */
    if (action === 'admin' && params.function === 'hosts') {
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to read who leads a community' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can read who leads it' })
      }
      const people = await new AdminDashboard(god.url, god.key).hosts(params.community_id)
      return res.status(200).json({ data: people })
    }

    /*
      Joining from a QR scan, which is how a first-timer at the door gets in without anybody
      stopping to find a code. It is deliberately not the code branch above wearing different
      clothes: here the credential is the PIN, and it is only worth anything because the session
      it belongs to is open at this exact second. A photograph of a screen carries four digits no
      better than a whisper does, so the window is what makes this "somebody standing in this room
      during this gathering" rather than "anybody who once saw a projector" — which is the same
      proof the check-in two branches up already accepts before it writes an arrival.

      Everything that decides the yes is read by the server: the community comes from the session
      row those digits opened, the address comes from the token, and the role is 'member', which
      Community.join sets and takes from nobody. A caller cannot name a community here and get
      added to it, because the id in the body only ever selects which session is being asked
      about, and a session in another fellowship answers for nobody.
    */
    if (action === 'community' && params.function === 'join_at_session') {
      const pin = String(params.pin || '').trim()
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required to join at a gathering' })
      }
      if (!/^\d{4}$/.test(pin)) {
        return res
          .status(400)
          .json({ error: 'params.pin must be the four digits the leader read out' })
      }
      const openings = await new Session(god.url, god.key).all({
        community_id: params.community_id,
        pin,
      })
      const open = pickOpenSession(openings, {
        session_id: params.session_id ? String(params.session_id).trim() : '',
        now: new Date(),
      })
      if (!open) {
        return res.status(400).json({
          error:
            'that PIN does not open a check-in right now, so nobody can be added from this scan — ask the leader to open one',
        })
      }
      const one = await new Community(god.url, god.key).find(open.community_id)
      if (!one) {
        return res.status(400).json({ error: 'that session belongs to no community' })
      }
      /*
        Already being a member is a yes, not an error — the join-code branch above can afford to
        shout, because a person typing a code knows what they asked for. This one runs on the way
        to a check-in, for the member who scanned the same QR as the stranger did, and making them
        watch a failure they did not cause would be the first thing the new flow got wrong.
      */
      const link = await links.find(email, open.community_id)
      if (link) {
        return res.status(200).json({ data: { ...link, name: one.name, already: true } })
      }
      const added = await new Community(god.url, god.key).join({
        community_id: open.community_id,
        email,
      })
      return res.status(200).json({ data: { ...added, name: one.name } })
    }

    /*
      Answering a function is the third of the writes a plain member has, and it is the only one that
      puts rows in the two tables under a function. Three things are forced and one is left out. Forced:
      the community is one this caller belongs to, read off `community_members` through the same helper
      the absence notice and the check-in above use; the function_id has to be a number, because it is a
      bigint and a letter would come back as a Postgres type error nobody could interpret; and the
      address on both rows is the token's, never the body's, so a member cannot answer for a neighbour
      or pay somebody else's way. Left out: `confirmed_by` and `confirmed_at`. A confirmation is a
      leader's signature over a receipt, and nothing on this path can sign it — which is what keeps
      "I attached my proof" from becoming "my payment is accepted".

      A receipt is a web address rather than the file itself: the page puts the file into storage and
      hands back the public url, so this branch only ever checks that the string looks like one. The
      day given instead of a receipt is kept as `YYYY-MM-DD`, which is what the date column wants and
      what the table's `paid_fields_match` check then reads as an outstanding promise. Giving neither
      is allowed, and writes no money row at all.
    */
    if (action === 'church_function') {
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to see what a community has planned' })
      }
      const function_id = String(params.function_id ?? '').trim()
      if (params.function !== 'available' && !/^\d+$/.test(function_id)) {
        return res.status(400).json({
          error: 'params.function_id is the number a planned function is addressed by',
        })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can see or answer its functions' })
      }
      if (params.function === 'available') {
        params = { function: 'available', community_id: params.community_id }
        return finish(god, action, params, null, res)
      }
      if (params.function === 'respond') {
        const attending = params.attending === true ? true : params.attending === false ? false : null
        if (attending === null) {
          return res.status(400).json({
            error: 'params.attending is required — true when you are coming, false when you are not',
          })
        }
        const proof_path = String(params.proof_path || '').trim()
        if (proof_path && !/^https?:\/\//.test(proof_path)) {
          return res.status(400).json({
            error: 'params.proof_path is the web address of the receipt the page attached',
          })
        }
        const expected_pay_date = String(params.expected_pay_date || '').trim()
        if (expected_pay_date && !/^\d{4}-\d{2}-\d{2}$/.test(expected_pay_date)) {
          return res.status(400).json({
            error: 'params.expected_pay_date is the day you expect to pay, written as 2026-12-05',
          })
        }
        params = {
          function: 'respond',
          community_id: params.community_id,
          function_id,
          user_email: email,
          attending,
          proof_path: proof_path || null,
          expected_pay_date: expected_pay_date || null,
        }
        return finish(god, action, params, null, res)
      }
      params = {
        function: 'rsvp',
        community_id: params.community_id,
        function_id,
        user_email: email,
      }
      return finish(god, action, params, null, res)
    }
  }

  /*
    Joining with a code, which is the other way in and the one a person who was told the code
    uses. Three things are read by the server rather than taken on trust: the community_id comes
    from the community table matched on those six characters, so the id typed into the same
    request is dropped; the address is the token's, overwritten above for a browser; and the role
    is 'member', which Community.join sets and takes from nobody. An empty code and a code
    nobody holds are both answered the same way and without naming a community, so this is not a
    way to test a guess against the list of fellowships. The code is the whole credential: the
    alphabet leaves out the look-alikes and 32^6 combinations is not a number you reach by
    accident, but anybody who reads one off a screen can walk in as a member.
  */
  if (action === 'community' && params.function === 'join') {
    const join_id = String(params.join_id || '').trim().toUpperCase()
    if (!join_id) {
      return res.status(400).json({ error: 'params.join_id is required to join a community' })
    }
    const groups = new Community(god.url, god.key)
    const links = new CommunityMember(god.url, god.key)
    const one = await groups.byCode(join_id)
    if (!one) {
      return res.status(400).json({ error: 'no community carries that join code' })
    }
    const link = await links.find(params.email, one.community_id)
    if (link) {
      return res
        .status(400)
        .json({ error: `you are already in ${one.name}, as ${link.role}` })
    }
    params = { ...params, join_id, community_id: one.community_id }
  }

  return finish(god, action, params, null, res)
}
