/*
  Temporary check of the session create path in api/leader.js. Nothing here reaches the real
  project: the Supabase url points at a local server that answers PostgREST-shaped JSON, and
  the Firebase id token is minted from a throwaway RSA key served by a stubbed signing-key
  endpoint.
*/
import { createServer } from 'node:http'
import { generateKeyPairSync, createPrivateKey, sign } from 'node:crypto'
import handler from './api/leader.js'

const project = 'kopano-local-check'
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const realFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  if (String(url) === CERTS_URL) {
    return { ok: true, json: async () => ({ kid1: publicKey }) }
  }
  return realFetch(url, options)
}

function tokenFor(email, sub = 'probe-subject') {
  const b64 = (one) => Buffer.from(JSON.stringify(one)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'RS256', typ: 'JWT', kid: 'kid1' })
  const body = b64({
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    sub,
    email,
    exp: now + 600,
    iat: now,
  })
  const signature = sign('rsa-sha256', Buffer.from(`${head}.${body}`), {
    key: privateKey,
    padding: 1,
  })
  return `${head}.${body}.${signature.toString('base64url')}`
}

// What the stub answers, and what it was asked for.
let links = { 'probe@example.com': { role: 'leader' } }
let rows = []
let failEvent = false
let sequence = 0

const server = createServer((req, res) => {
  const chunks = []
  req.on('data', (one) => chunks.push(one))
  req.on('end', () => {
    const sent = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
    const path = req.url.split('?')[0]
    const table = path.replace('/rest/v1/', '')
    const wantsObject = (req.headers.accept || '').includes('pgrst.object')
    const reply = (status, payload) => {
      rows.push({ method: req.method, table, prefer: req.headers.prefer, body: sent })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(payload))
    }

    if (req.method === 'GET' && table.startsWith('community_members')) {
      const email = decodeURIComponent(/email=eq\.([^&]+)/.exec(req.url)?.[1] || '')
      const found = links[email] ? [{ ...links[email], email, community_id: 'comm-1' }] : []
      return reply(200, wantsObject ? found[0] ?? null : found)
    }
    if (req.method === 'POST' && table === 'session') {
      const row = { ...sent, session_id: `session-${++sequence}` }
      return reply(201, wantsObject ? row : [row])
    }
    if (req.method === 'POST' && table === 'event') {
      if (failEvent) return reply(500, { message: 'the gathering row refused', code: '23505' })
      const row = { ...sent, event_id: `event-${sequence}` }
      return reply(201, wantsObject ? row : [row])
    }
    if (req.method === 'DELETE') return reply(200, [sent ?? {}])
    return reply(200, [])
  })
})

await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}`
process.env.FIREBASE_PROJECT_ID = project
process.env.GOD_SERVER_KEY = 'unused-here'
process.env.SUPABASE_URL = base
process.env.SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'

const idToken = tokenFor('probe@example.com')

async function ask(params, token = idToken) {
  const res = {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(one) {
      this.body = one
      return this
    },
  }
  await handler(
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { action: 'session', params },
    },
    res,
  )
  return { status: res.statusCode, body: res.body }
}

const good = {
  function: 'create',
  community_id: 'comm-1',
  pin: '4172',
  event_name: 'Sunday Fellowship',
  started_at: '2026-11-15T09:00',
  ended_at: '2026-11-15T11:30',
  latitude: -25.747867,
  longitude: 28.229271,
  // The three a page should never get to decide for itself.
  created_by: 'someone.else@example.com',
  date: '1999-01-01',
}

const report = []
const check = (label, ok, detail) => report.push({ label, ok, detail })

rows = []
const happy = await ask(good)
const session = rows.find((one) => one.method === 'POST' && one.table === 'session')
const gathering = rows.find((one) => one.method === 'POST' && one.table === 'event')
check('a leader opens a session', happy.status === 200, happy.status)
check(
  'the session row keeps the name and the place',
  session?.body?.event_name === 'Sunday Fellowship' &&
    session?.body?.latitude === -25.747867 &&
    session?.body?.longitude === 28.229271,
  JSON.stringify(session?.body),
)
check(
  'created_by and the day come from the server, not the body',
  session?.body?.created_by === 'probe@example.com' && session?.body?.date === '2026-11-15',
  JSON.stringify({ created_by: session?.body?.created_by, date: session?.body?.date }),
)
check(
  'the creator is written down as attending, at that session',
  gathering?.body?.attend === true &&
    gathering?.body?.user_email === 'probe@example.com' &&
    gathering?.body?.recorded_by === 'probe@example.com' &&
    gathering?.body?.session_id === 'session-1' &&
    gathering?.body?.reason === null &&
    gathering?.body?.event_date === '2026-11-15' &&
    gathering?.body?.latitude === -25.747867,
  JSON.stringify(gathering?.body),
)

const noPlace = await ask({ ...good, latitude: undefined, longitude: undefined })
check('a session with no position is refused', noPlace.status === 400, noPlace.body?.error)
const halfPlace = await ask({ ...good, longitude: 'abc' })
check('one coordinate alone is refused', halfPlace.status === 400, halfPlace.body?.error)
const farPlace = await ask({ ...good, latitude: 190 })
check('a latitude off the globe is refused', farPlace.status === 400, farPlace.body?.error)
const noName = await ask({ ...good, event_name: '   ' })
check('a session naming no gathering is refused', noName.status === 400, noName.body?.error)
const badPin = await ask({ ...good, pin: '12' })
check('a PIN that is not four digits is refused', badPin.status === 400, badPin.body?.error)
const backwards = await ask({ ...good, ended_at: '2026-11-15T08:00' })
check('a session that ends before it starts is refused', backwards.status === 400, backwards.body?.error)

rows = []
links = { 'probe@example.com': { role: 'member' } }
const plain = await ask(good)
check(
  'a plain member cannot open a session',
  plain.status === 403 && !rows.some((one) => one.method === 'POST'),
  JSON.stringify({ status: plain.status, calls: rows.map((one) => `${one.method} ${one.table}`) }),
)
links = { 'probe@example.com': { role: 'leader' } }

failEvent = true
rows = []
const broken = await ask(good)
failEvent = false
check(
  'when the attendance row fails the session goes back out',
  broken.status === 500 &&
    rows.some((one) => one.method === 'DELETE' && one.table === 'session') &&
    /refused/.test(broken.body?.error || ''),
  JSON.stringify({ status: broken.status, error: broken.body?.error, calls: rows.map((one) => `${one.method} ${one.table}`) }),
)

const stranger = await ask(good, tokenFor('nobody@example.com', 'other-subject'))
check('an address with no link is refused', stranger.status === 403, stranger.body?.error)

let failures = 0
for (const one of report) {
  if (!one.ok) failures += 1
  console.log(`${one.ok ? 'ok  ' : 'FAIL'} ${one.label}${one.ok ? '' : ` — ${one.detail}`}`)
}
console.log(failures ? `\n${failures} of ${report.length} failed` : `\nall ${report.length} passed`)
server.close()
process.exit(failures ? 1 : 0)
