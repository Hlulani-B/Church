import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'

import { User } from '../src/functions/user.js'
import { Community } from '../src/functions/community.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { AdminDashboard, ROLES } from '../src/functions/admin_dashboard.js'
import { Attendance } from '../src/functions/attendance.js'
import { Event } from '../src/functions/event.js'
import { Session, distanceInMetres } from '../src/functions/session.js'

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

/*
  A coordinate as a device reported it, or NaN.

  `Number(null)` is 0 and `Number('')` is 0, so a bare Number would read a phone that gave no
  position as a point in the Gulf of Guinea — 4167 km from a room in Johannesburg, and a session
  opened with no place would be measured from the same water. Every distance test below asks
  whether the pair is finite, so the empty case has to arrive as NaN rather than as a number that
  happens to be valid.
*/
function reading(value) {
  return value === null || value === undefined || value === '' ? NaN : Number(value)
}

// action picks the class, params.function picks the method, the rest of params are its arguments.
export class God {
  constructor(
    url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  ) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.url = url
    this.key = key
  }

  #case(action) {
    switch (action) {
      case 'user':
        return { class: User, keys: ['email'] }
      case 'community':
        return { class: Community, keys: ['community_id'] }
      case 'member':
        return { class: CommunityMember, keys: ['email', 'community_id'] }
      case 'admin':
        // Not a table: what the admin dashboard needs, which spans two of them.
        return { class: AdminDashboard, keys: ['community_id'] }
      case 'attendance':
        // Also not a table: gatherings grouped out of event, with the names from users.
        return { class: Attendance, keys: ['community_id'] }
      case 'event':
        return { class: Event, keys: ['event_id'] }
      case 'session':
        return { class: Session, keys: ['session_id'] }
      default:
        throw badRequest(`unknown action '${action}'`)
    }
  }

  async call(action, params = {}) {
    const { function: fn, changes, ...data } = params
    if (!fn) throw badRequest('params.function is required')
    const { class: Class, keys } = this.#case(action)
    const client = new Class(this.url, this.key)

    if (!(fn in client)) throw badRequest(`action '${action}' has no function '${fn}'`)

    const ids = () =>
      keys.map((key) => {
        if (data[key] === undefined) throw badRequest(`params.${key} is required for '${fn}'`)
        return data[key]
      })

    switch (fn) {
      case 'create':
        return client.create(data)
      case 'join':
        // Community only: the handler read the community_id off the code before getting here.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'join'")
        return client.join(data)
      case 'pin':
        // Session only, and it touches no table: the four digits are drawn for the page to
        // show the room, and travel back in the create that follows.
        return client.pin()
      case 'open':
        // Session only, and it writes nothing: what could be checked in to right now, with
        // neither the PIN nor the place of the session in the answer.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'open'")
        return client.open(data)
      case 'all':
        return client.all(data)
      case 'memberOf':
        // Community only, and keyed by email rather than the action's own id.
        if (data.email === undefined) throw badRequest("params.email is required for 'memberOf'")
        return client.memberOf(data.email)
      case 'roster':
        // The admin dashboard only: one community_id, no email of its own.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'roster'")
        return client.roster(data.community_id)
      case 'services':
      case 'service': {
        // The attendance page only. One gathering also names itself, or the read would be
        // every row the community has ever recorded.
        if (data.community_id === undefined)
          throw badRequest(`params.community_id is required for '${fn}'`)
        if (fn === 'services') return client.services(data.community_id)
        if (data.event_date === undefined || data.event_name === undefined) {
          throw badRequest("params.event_date and params.event_name are required for 'service'")
        }
        return client.service(data.community_id, data.event_date, data.event_name)
      }
      case 'find':
        return client.find(...ids())
      case 'update':
        if (changes === undefined) throw badRequest("params.changes is required for 'update'")
        return client.update(...ids(), changes)
      case 'changeCode':
        return client.changeCode(...ids())
      case 'assign':
        // The admin dashboard only: two addresses and a role, none of them the caller's own id.
        if (data.member_email === undefined || data.role === undefined) {
          throw badRequest("params.member_email and params.role are required for 'assign'")
        }
        return client.assign(data.community_id, data.member_email, data.role)
      case 'remove':
        return client.remove(...ids())
      case 'record':
        return client.record(data)
      default:
        throw badRequest(`unknown function '${fn}' for action '${action}'`)
    }
  }
}

function matchesServerKey(token) {
  const expected = process.env.GOD_SERVER_KEY
  if (!expected) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
let certs = { at: 0, keys: {} }

async function signingKeys() {
  if (Date.now() - certs.at < 6 * 60 * 60 * 1000) return certs.keys
  const response = await fetch(CERTS_URL)
  if (!response.ok) throw new Error('could not read the Firebase signing keys')
  const keys = Object.fromEntries(
    Object.entries(await response.json()).map(([kid, pem]) => [kid, createPublicKey(pem)]),
  )
  certs = { at: Date.now(), keys }
  return keys
}

/*
  A Firebase ID token proves the caller owns that email address, so a browser can
  reach the users table without being handed any server secret.
*/
async function verifiedEmail(token) {
  const fail = (reason) => ({ reason })
  const project = process.env.FIREBASE_PROJECT_ID
  if (!project) return fail('FIREBASE_PROJECT_ID is not set on this server')
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return fail('the bearer value is not a Firebase id token')
  try {
    // Only the header and payload are JSON; the signature is raw bytes.
    const [header, payload] = parts
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')))
    if (header.alg !== 'RS256') return fail(`unexpected token algorithm '${header.alg}'`)
    if (payload.iss !== `https://securetoken.google.com/${project}`)
      return fail(`token was signed in for '${payload.iss}', not project '${project}'`)
    if (payload.aud !== project) return fail(`token audience '${payload.aud}' is not this project`)
    if (!payload.sub) return fail('token has no subject')
    if (payload.exp * 1000 <= Date.now())
      return fail(`token expired at ${new Date(payload.exp * 1000).toISOString()}`)

    const keys = await signingKeys()
    const key = keys[header.kid]
    if (!key) return fail(`no signing key for kid '${header.kid}' (have ${Object.keys(keys)})`)
    const valid = verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], 'base64url'),
    )
    if (!valid) return fail('token signature does not verify')
    // email_verified is still false straight after sign-up, and nothing gates on it.
    if (!payload.email) return fail('token has no email, so the sign-in is anonymous')
    return { email: payload.email }
  } catch (error) {
    return fail(`could not read the token: ${error.message}`)
  }
}

// What a signed-in browser may do without the server key: only its own user row,
// and only the communities its own email belongs to. Opening a community is allowed
// because the guard below pairs it with joining that new community as its first member.
// Joining with somebody else's code is allowed because the address and the role both come
// from the server there, and the community only from the code.
// Everything under 'admin' and 'attendance' describes other people, so the caller's role in
// the community_id in the request answers those — an admin for anything that changes them, a
// leader for reading them. 'event' opens two writes, and both are about the caller: recording
// that they are not attending, and recording that they are — the second only for as long as a
// PIN, a window and a distance all agree, which is what the branch below checks rather than
// anything the page is asked to believe. 'session' opens the two the take-attendance page
// makes — drawing a PIN, which writes nothing, and the session row that follows, which also
// records its own creator as present at the gathering they just opened, because whoever runs
// the check-in is in the room. Both answer to the leader tier, since a session belongs to the
// running of the room rather than to anybody else's record. The third session call, 'open', is
// a read rather than a write: it answers which gatherings could be checked in to at this
// moment, so a member's page can show its PIN box only while one of them holds — and it names
// no PIN, for the reason spelled out where that branch is. Nothing else a browser can ask
// marks anybody present.
const SELF_ACTIONS = {
  user: ['find', 'create', 'update'],
  community: ['memberOf', 'create', 'find', 'join'],
  member: ['create', 'find', 'remove'],
  admin: ['roster', 'changeCode', 'assign'],
  attendance: ['services', 'service'],
  event: ['record', 'checkin'],
  session: ['create', 'pin', 'open'],
}
// email is the primary key of users, so a browser must never move a row onto
// someone else's address; everything except these two columns is dropped. community has
// no entry because a join code is never read off a request: 'changeCode' draws one on the
// server, and writing a code somebody typed by hand stays behind GOD_SERVER_KEY.
const SELF_FIELDS = { user: ['name', 'surname'] }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST only' })
  }
  if (!process.env.GOD_SERVER_KEY && !process.env.FIREBASE_PROJECT_ID) {
    return res
      .status(503)
      .json({ error: 'neither GOD_SERVER_KEY nor FIREBASE_PROJECT_ID is set on this deployment' })
  }

  const [scheme, token] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'a bearer server key or Firebase id token is required' })
  }

  let { action, params = {} } = req.body || {}
  // What a session create owes the `event` table once it has a session_id to point at.
  let creator = null
  const god = new God()
  if (!matchesServerKey(token)) {
    const { email, reason } = await verifiedEmail(token)
    if (!email) {
      console.warn('[god] rejected bearer token:', reason)
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
    params = { ...params, email }
    /*
      These read or change what a community looks like to other people: who is in it, its
      join code, its own row, who was at each of its gatherings. The caller's
      community_members row for that community_id settles it, taken from the token rather
      than the body, so an admin of one group cannot reach into another and a plain member
      cannot rename the group.

      That settles it on two different answers, because a leader reads about other people and
      an admin changes them. The roster and the attendance are what the leader role is for, so
      either role opens them. A role assignment, a removal, a new code and the community row
      that carries the old one stay with an admin — 'community' find is in that tier only
      because the row it returns holds join_id.
    */
    const links = new CommunityMember(god.url, god.key)
    // The leader tier is asked first because it is the narrower one: 'admin' roster answers
    // the admin test too, and a read matched on both would be settled as a change.
    // Opening a session is on this tier because it is about a gathering, not about anybody's
    // record at it, and the leader role exists to run the room. Reading which sessions are open
    // is not: whoever is stood in the room with a PIN to type is a plain member, and the box
    // that asks them for it would otherwise be hidden behind a role they do not hold.
    const openSessions = action === 'session' && params.function === 'open'
    const needsLeader =
      !openSessions &&
      (action === 'attendance' ||
        action === 'session' ||
        (action === 'admin' && params.function === 'roster'))
    const needsAdmin =
      !needsLeader &&
      (action === 'admin' ||
        (action === 'member' && params.function === 'remove') ||
        (action === 'community' && params.function === 'find'))
    if (needsAdmin || needsLeader) {
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required for that request' })
      }
      const link = await links.find(email, params.community_id)
      const enough = needsAdmin
        ? link?.role === 'admin'
        : link?.role === 'admin' || link?.role === 'leader'
      if (!enough) {
        return res.status(403).json({
          error: needsAdmin
            ? 'only an admin of that community can change its roles, its people or its join code'
            : 'only a leader or an admin of that community can read its people and its attendance, or open a check-in session',
        })
      }
    }
    /*
      Removing somebody is the one browser action here that speaks about another person, so
      the target arrives as member_email and only becomes params.email — what the class
      deletes on — once the caller has been shown to be an admin of this community. Three
      things follow from that. An address that is not in the community is a 400 rather than
      a silent no-op. One admin cannot delete another; only the admin themselves can do
      that to their own row, because otherwise any admin could empty a group of its
      managers. And the last member cannot be removed at all: 'member' create is open to a
      browser while a community has no members, so an emptied community would be there for
      whoever guessed its id to claim as admin.
    */
    if (action === 'member' && params.function === 'remove') {
      const target = String(params.member_email || '').trim()
      if (!target) {
        return res.status(400).json({ error: 'params.member_email is required to remove a member' })
      }
      const row = await links.find(target, params.community_id)
      if (!row) {
        return res.status(400).json({ error: 'that person is not a member of this community' })
      }
      if (row.role === 'admin' && target !== email) {
        return res
          .status(403)
          .json({ error: 'only that admin can remove themselves from this community' })
      }
      const everyone = await links.all({ community_id: params.community_id })
      if (everyone.length <= 1) {
        return res
          .status(403)
          .json({ error: 'that community has only one member, so removing them would leave it unowned' })
      }
      params = { ...params, email: target }
    }
    /*
      Assigning a role is the second action here that speaks about another person, and it is
      guarded the same way: the caller is an admin of this community (checked above, off the
      token), the address has to hold a link in this community, and the role has to be one of
      the three the table allows. Then one refusal, the loudest: a community whose last admin
      stops being an admin has nobody left who can read its roster or change its code, and no
      way back in except the server key. It is the same rule whoever the address is, so an
      admin handing their own role to somebody else is allowed the moment a second admin
      already holds it — and not before.
    */
    if (action === 'admin' && params.function === 'assign') {
      const target = String(params.member_email || '').trim()
      if (!target) {
        return res.status(400).json({ error: 'params.member_email is required to assign a role' })
      }
      if (!ROLES.includes(params.role)) {
        return res
          .status(400)
          .json({ error: `params.role is required to assign a role, and it is one of ${ROLES.join(', ')}` })
      }
      const row = await links.find(target, params.community_id)
      if (!row) {
        return res.status(400).json({ error: 'that person is not a member of this community' })
      }
      if (params.role !== 'admin') {
        const everyone = await links.all({ community_id: params.community_id })
        const admins = everyone.filter((one) => one.role === 'admin')
        if (row.role === 'admin' && admins.length <= 1) {
          return res
            .status(403)
            .json({ error: 'that is the only admin, so the community would be left with nobody who can manage it' })
        }
      }
    }
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
      const event_name = String(params.event_name || '').trim()
      // Optional: an empty box writes no reason at all, which is recorded as null.
      const reason = String(params.reason || '').trim()
      if (!params.community_id) {
        return res
          .status(400)
          .json({ error: 'params.community_id is required to record that you are not attending' })
      }
      if (!event_date || !event_name) {
        return res
          .status(400)
          .json({ error: 'params.event_date and params.event_name are required to record an absence' })
      }
      const link = await links.find(email, params.community_id)
      if (!link) {
        return res
          .status(403)
          .json({ error: 'only a member of that community can record themselves as not attending' })
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

      It is filed under 'event' rather than 'session' deliberately. The leader tier above is
      keyed on the action, so a check-in asking to be a session call would refuse every plain
      member — and a plain member standing in the room is exactly who this row is about.

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
        being stood in now. The newest start wins if two somehow overlap.
      */
      const openings = await new Session(god.url, god.key).all({
        community_id: params.community_id,
        pin,
      })
      const open = openings
        .filter((one) => new Date(one.started_at) <= now && new Date(one.ended_at) >= now)
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0]
      if (!open) {
        if (!openings.length) {
          return res
            .status(400)
            .json({ error: 'no check-in is open in this community on those four digits' })
        }
        /*
          No time is quoted here, and that is not laziness: this function runs in UTC and the
          room does not, so a clock printed server-side is a clock wrong by the offset between
          the two. Which of the two it is comes back as its own refusal, and the leader standing
          in front of the room is the one who can say the hour.
        */
        const last = openings.reduce(
          (best, one) => (new Date(one.ended_at) > new Date(best.ended_at) ? one : best),
          openings[0],
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
      const gatherings = new Event(god.url, god.key)
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
    if (action === 'community' && params.function === 'create') {
      const name = String(params.name || '').trim()
      if (!name) {
        return res.status(400).json({ error: 'params.name is required to open a community' })
      }
      params = { ...params, name }
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
      with no place is a session that cannot refuse a cheat. The gathering has to be named for the
      same kind of reason: `event.event_name` is not nullable and is part of what makes an
      attendance row unique, so an unnamed session could not record anybody at it, its own creator
      included.
    */
    if (action === 'session' && params.function === 'create') {
      if (!/^\d{4}$/.test(String(params.pin || ''))) {
        return res
          .status(400)
          .json({ error: 'params.pin must be the four digits this server drew' })
      }
      const event_name = String(params.event_name || '').trim()
      if (!event_name) {
        return res.status(400).json({
          error: 'params.event_name is required: a session that names no gathering records nobody',
        })
      }
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
      const latitude = Number(params.latitude)
      const longitude = Number(params.longitude)
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      ) {
        return res.status(400).json({
          error:
            'params.latitude and params.longitude are both needed, as this device reported them',
        })
      }
      /*
        How near the room a check-in has to come from, in metres, and whether that question is
        asked at all. Both are the leader's to decide, and decided in the room: a hall where the
        signal reads badly is worth a wider number, and a gathering that meets in three towns at
        once is worth turning the rule off. A blank radius stays blank rather than being
        defaulted here, because a null reads back upstream as no limit, which is the honest
        outcome of a leader who set no number; and a radius kept alongside `allow_any_radius` is
        stored but unused, so switching the rule back off later returns to what was first set.
      */
      const allow_any_radius = params.allow_any_radius === true
      const radius =
        params.radius === null || params.radius === undefined || params.radius === ''
          ? null
          : Number(params.radius)
      if (radius !== null && (!Number.isFinite(radius) || radius <= 0 || radius > 20000)) {
        return res
          .status(400)
          .json({ error: 'params.radius is a distance in metres, from 1 to 20000' })
      }
      const date = started.slice(0, 10)
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

  try {
    const data = await god.call(action, params)
    /*
      The creator's attendance row follows the session it belongs to, because it points at that
      row's id. If it cannot be written the session goes back out with the failure: a PIN the room
      was told, with nobody recorded against it, would be read later as a gathering nobody attended
      — a worse falsehood than an error on the screen.
    */
    if (creator && data?.session_id) {
      try {
        await new Event(god.url, god.key).record({ ...creator, session_id: data.session_id })
      } catch (error) {
        await new Session(god.url, god.key).remove(data.session_id)
        throw error
      }
    }
    return res.status(200).json({ data })
  } catch (error) {
    const status = error.status || 500
    return res.status(status).json({
      error: error.message || 'request failed',
      code: error.code,
      details: error.details,
    })
  }
}
