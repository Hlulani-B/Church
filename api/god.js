import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'

import { User } from '../src/functions/user.js'
import { Community } from '../src/functions/community.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { AdminDashboard, ROLES } from '../src/functions/admin_dashboard.js'
import { Attendance } from '../src/functions/attendance.js'
import { Event, REASONS } from '../src/functions/event.js'
import { Session } from '../src/functions/session.js'

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
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
// Everything under 'admin' and 'attendance' describes other people, so the caller's role in
// the community_id in the request answers those — an admin for anything that changes them, a
// leader for reading them. 'event' opens exactly one write, and it is about the caller:
// recording that they are not attending. Nothing a browser can ask here marks anybody present.
const SELF_ACTIONS = {
  user: ['find', 'create', 'update'],
  community: ['memberOf', 'create', 'find'],
  member: ['create', 'find', 'remove'],
  admin: ['roster', 'changeCode', 'assign'],
  attendance: ['services', 'service'],
  event: ['record'],
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
    const needsLeader = action === 'attendance' || (action === 'admin' && params.function === 'roster')
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
            : 'only a leader or an admin of that community can read its people and its attendance',
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
        return res.status(400).json({ error: `${target} is not a member of that community` })
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
        return res.status(400).json({ error: `${target} is not a member of that community` })
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
      Recording yourself as not attending is the only attendance write a browser has, and it
      is the one the attendance page makes. Three things are forced and one is refused. Forced:
      the address the row speaks about is the token's, never the body's; the answer is always
      false, so nothing a page can send marks anybody present; and only these columns are
      passed on, which is what keeps a request from writing recorded_by, a session or a
      latitude. A reason may be left out, and an empty one is sent as null rather than as the
      empty string, because the column's check accepts a null and refuses a word outside its
      five. Refused: a row that already says present is never turned into an absence. Being
      there is a fact about a day that has gone by, and a yes that could be taken back would
      end up recording whoever edited the list rather than who was in the room. A date that has
      not come is allowed — that is the point of the box — because an apology travels ahead of
      the gathering it is about.
    */
    if (action === 'event' && params.function === 'record') {
      const event_date = String(params.event_date || '').trim()
      const event_name = String(params.event_name || '').trim()
      // Optional: an empty box writes no reason at all, and a NULL passes the column's check.
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
      if (reason && !REASONS.includes(reason)) {
        return res.status(400).json({ error: `params.reason is one of ${REASONS.join(', ')}` })
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
        return res.status(400).json({ error: 'params.community_id is required to join a community' })
      }
      const everyone = await links.all({ community_id: params.community_id })
      if (everyone.length) {
        return res
          .status(403)
          .json({ error: 'that community already has members, so only the server key can add one' })
      }
      params = { ...params, role: 'admin' }
    }
  }

  try {
    const data = await god.call(action, params)
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
