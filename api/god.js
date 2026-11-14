import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'

import { User } from '../src/functions/user.js'
import { Community } from '../src/functions/community.js'
import { CommunityMember } from '../src/functions/community_members.js'
import { Event } from '../src/functions/event.js'
import { Session } from '../src/functions/session.js'
import { Testimony } from '../src/functions/testimony.js'

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
      case 'event':
        return { class: Event, keys: ['event_id'] }
      case 'session':
        return { class: Session, keys: ['session_id'] }
      case 'testimony':
        return { class: Testimony, keys: ['testimony_id'] }
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
      case 'members':
        // Community only too: the roster of one community_id, no email of its own.
        if (data.community_id === undefined)
          throw badRequest("params.community_id is required for 'members'")
        return client.members(data.community_id)
      case 'find':
        return client.find(...ids())
      case 'update':
        if (changes === undefined) throw badRequest("params.changes is required for 'update'")
        return client.update(...ids(), changes)
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
// The roster, the community row and its join code are on the list too, but they describe
// other people, so #requireAdmin answers them only for an admin of that community.
const SELF_ACTIONS = {
  user: ['find', 'create', 'update'],
  community: ['memberOf', 'create', 'find', 'update'],
  member: ['create', 'find', 'members'],
}
// email is the primary key of users, so a browser must never move a row onto
// someone else's address; everything except these two columns is dropped. The only
// column of community an admin may change by hand is the code people type to join.
const SELF_FIELDS = { user: ['name', 'surname'], community: ['join_id'] }
// The generated code is six uppercase hex characters, so a hand-written one is held to
// the same shape: short enough to say aloud, no separators, no case ambiguity.
const JOIN_CODE = /^[A-Z0-9]{6}$/

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
      These read or change what a community looks like to other people: its roster, its
      own row, its join code. The caller's community_members row for that community_id
      settles it, taken from the token rather than the body, so an admin of one group
      cannot reach into another and a plain member cannot rename the group.
    */
    const links = new CommunityMember(god.url, god.key)
    const needsAdmin =
      (action === 'member' && params.function === 'members') ||
      (action === 'community' && ['find', 'update'].includes(params.function))
    if (needsAdmin) {
      if (!params.community_id) {
        return res.status(400).json({ error: 'params.community_id is required for that request' })
      }
      const link = await links.find(email, params.community_id)
      if (link?.role !== 'admin') {
        return res
          .status(403)
          .json({ error: 'only an admin of that community can read its members or change its code' })
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
      // A hand-written join code is held to the shape of a generated one.
      if (changes.join_id !== undefined) {
        changes.join_id = String(changes.join_id).toUpperCase()
        if (!JOIN_CODE.test(changes.join_id)) {
          return res.status(400).json({ error: 'join_id must be six characters, A-Z or 0-9' })
        }
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
