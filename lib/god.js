import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'

import { User } from '../src/functions/user.js'
import { Community } from '../src/functions/community.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { AdminDashboard } from '../src/functions/admin_dashboard.js'
import { Attendance } from '../src/functions/attendance.js'
import { Event } from '../src/functions/event.js'
import { Session } from '../src/functions/session.js'
import { Feedback } from '../src/functions/feedback.js'
import { ChurchFunctions } from '../src/functions/church_functions.js'

/*
  Everything the three /api endpoints used to share before god.js was split by auth tier.

  The split is by who may call something — self, leader, admin — rather than by table, so the
  request-parsing, the Firebase token check, the role gate and the one dispatcher all live here and
  are reached from every endpoint. The domain branches that read or harden a request stay in the
  endpoint whose tier owns them, because that is the whole point of splitting: a reader of
  /api/self sees only what a plain member can do.
*/

export function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

/*
  A coordinate as a device reported it, or NaN.

  `Number(null)` is 0 and `Number('')` is 0, so a bare Number would read a phone that gave no
  position as a point in the Gulf of Guinea — 4167 km from a room in Johannesburg, and a session
  opened with no place would be measured from the same water. Every distance test asks whether the
  pair is finite, so the empty case has to arrive as NaN rather than as a number that happens to
  be valid.
*/
export function reading(value) {
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
      case 'feedback':
        // Not community-scoped: the table has no community_id, so no per-fellowship rule to
        // apply. What may be created and by whom is settled in the endpoint whitelists.
        return { class: Feedback, keys: [] }
      case 'church_function':
        // Not one table either: a planned function, and the two per-person answers under it. Its
        // key is `id` rather than a named id column, and nothing here is addressed by it yet —
        // both calls are scoped by the community_id the endpoint has already gated.
        return { class: ChurchFunctions, keys: [] }
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
      case 'live':
        // Session only, and it writes nothing: every live or scheduled check-in in a community,
        // with no PIN — what a plain member's dashboard listens to for its notice.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'live'")
        return client.live(data)
      case 'manage':
        // Session only: what a leader or an admin listens to on their dashboard. The handler
        // has already put the caller's address and admin flag into data, and settled that they
        // lead or admin this community, so this read carries PINs to the right eyes and no other.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'manage'")
        return client.manage(data)
      case 'revise':
        // Session only: cancel a check-in or change its radius. Whether the caller may touch
        // this row is settled in the handler before it gets here; ids() is the session_id.
        return client.revise(...ids(), changes)
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
      case 'list':
        // The functions page only: this community's planned functions, each with its three
        // counts. /api/leader has already settled that the caller leads or admins that
        // community, which is the whole answer to whose functions these are.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'list'")
        return client.list(data)
      case 'details':
        // One function on the functions page: its own row and everybody who has answered it. Both
        // halves are needed — the community_id because the class compares the function against it,
        // the function_id because it says which one. /api/leader has gated the community, and the
        // class refuses a function_id that does not live inside it.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'details'")
        if (data.function_id === undefined)
          throw badRequest("params.function_id is required for 'details'")
        return client.details(data)
      case 'getUsers':
        // The user class only, and for the leader tier: the people of one community, addressed
        // and named, which is what the absence form's For-who box is built from. Keyed on the
        // community_id rather than an email of its own.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'getUsers'")
        return client.getUsers(data.community_id)
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

export function matchesServerKey(token) {
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
export async function verifiedEmail(token) {
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
      return fail(`token was signed in for '${payload.iss}', not project '${project}`)
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

// email is the primary key of users, so a browser must never move a row onto
// someone else's address; everything except these two columns is dropped. community has
// no entry because a join code is never read off a request: 'changeCode' draws one on the
// server, and writing a code somebody typed by hand stays behind GOD_SERVER_KEY.
export const SELF_FIELDS = { user: ['name', 'surname'] }

/*
  The three things every endpoint asks before it looks at the body: POST only, a deployment that
  was actually given a way to check a caller, and a bearer value. It answers by returning the token
  to verify, or by writing the refusal itself and returning null so the caller just stops.
*/
export async function authenticate(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'POST only' })
    return null
  }
  if (!process.env.GOD_SERVER_KEY && !process.env.FIREBASE_PROJECT_ID) {
    res
      .status(503)
      .json({ error: 'neither GOD_SERVER_KEY nor FIREBASE_PROJECT_ID is set on this deployment' })
    return null
  }
  const [scheme, token] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'a bearer server key or Firebase id token is required' })
    return null
  }
  return { token }
}

/*
  The one role question the leader and admin endpoints ask of every browser request: does this
  address lead (or admin) the community named in the body. It is taken from the token rather than
  the body, so an admin of one group cannot reach into another. `level` is 'leader' (either role) or
  'admin' (that role alone). Returns the caller's link on the way through, or null after writing the
  refusal — the same two answers, in the same words, that the single god.js gave before the split.
*/
export async function roleGate(god, email, community_id, level, res) {
  if (!community_id) {
    res.status(400).json({ error: 'params.community_id is required for that request' })
    return null
  }
  const link = await new CommunityMember(god.url, god.key).find(email, community_id)
  const enough =
    level === 'admin'
      ? link?.role === 'admin'
      : link?.role === 'admin' || link?.role === 'leader'
  if (!enough) {
    res.status(403).json({
      error:
        level === 'admin'
          ? 'only an admin of that community can change its roles, its people or its join code'
          : 'only a leader or an admin of that community can read its people and its attendance, or open a check-in session',
    })
    return null
  }
  return link
}

/*
  The one place a gathering's name is read back off the sessions of a day, shared by both tiers
  that record an absence: /api/self for the caller's own notice, /api/leader for a notice the
  For-who box names somebody else in. A name that arrives with the request is kept exactly as
  given; an absent one is settled against this community's uncancelled sessions for that day —
  no session is nothing to be absent from, and two are a coin-flip that is refused rather than
  guessed at. The refusals throw with a 400 so each endpoint answers in its own shape, and an
  absence form that ever grows a second door changes this sentence once.
*/
export async function resolveAbsenceGathering(god, community_id, event_date, event_name) {
  const named = String(event_name || '').trim()
  if (named) return named
  const onDay = (await new Session(god.url, god.key).all({
    community_id,
    date: event_date,
  })).filter((one) => one.cancel !== true && one.event_name)
  if (!onDay.length) {
    throw badRequest(
      'there is no session on that day in this community, so there is nothing to record an absence against — a gathering takes its name from the session the leader opens for it',
    )
  }
  if (onDay.length > 1) {
    throw badRequest(
      'more than one gathering sits on that day, so this absence cannot be placed — wait for the leader to open its session',
    )
  }
  return onDay[0].event_name
}

/*
  The last stretch every endpoint walks: hand the hardened params to the dispatcher, and — for a
  session someone just opened — write its creator's own attendance row against the id that came
  back. If that row cannot be written the session goes back out with the failure: a PIN the room was
  told, with nobody recorded against it, would be read later as a gathering nobody attended.
*/
export async function finish(god, action, params, creator, res) {
  try {
    const data = await god.call(action, params)
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
