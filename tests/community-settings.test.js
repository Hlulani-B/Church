import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/admin.js'

/*
  The two ends of one write: what /api/admin will carry onto a community row, and what the settings
  page sends.

  Renaming a fellowship and changing its picture are the first things an admin has ever been allowed to
  change about `community` itself, so the branch that lets them does two jobs at once. It lets exactly
  two columns through — `join_id` is drawn by the server and `created_by` is what the delete-everything
  gate is compared against, so a browser asking to write either one is simply not answered — and it
  refuses a value that would make the community unreadable or its hero unpaintable: an empty name, a
  picture that is not an http address. Everything the branch decides is visible here because `finish`
  is stubbed to hand back the params it was given, which is exactly what the table would be sent.

  The page half is worth holding for a different reason: `src/page_functions/god.js` picks the door by
  (action, function), and a community update that walked to /api/self would be refused there by its
  whitelist. So the path the request leaves on is asserted, not assumed.
*/

const world = vi.hoisted(() => ({ email: '', gates: [], sent: [] }))

vi.mock('../lib/god.js', () => ({
  God: class {
    constructor() {
      this.url = 'http://example.invalid'
      this.key = 'fake-key'
    }
  },
  authenticate: async () => ({ token: 'an-id-token' }),
  matchesServerKey: () => false,
  verifiedEmail: async () =>
    world.email ? { email: world.email } : { reason: 'no email on the token' },
  roleGate: async (god, email, community_id, level) => {
    world.gates.push([email, community_id, level])
    return { role: 'admin' }
  },
  finish: async (god, action, params, creator, res) => {
    world.sent.push({ action, params })
    return res.status(200).json({ data: { action, params } })
  },
}))

function response() {
  const out = {}
  return {
    out,
    setHeader() {},
    end() {
      return this
    },
    status(code) {
      out.status = code
      return this
    },
    json(body) {
      out.body = body
      return this
    },
  }
}

async function ask(params) {
  const res = response()
  await handler({ method: 'POST', headers: {}, body: { action: 'community', params } }, res)
  return { ...res.out, sent: world.sent[world.sent.length - 1] }
}

beforeEach(() => {
  world.email = 'ana@x.co'
  world.gates = []
  world.sent = []
})

describe('/api/admin community update — the two columns an admin may write', () => {
  it('hands on a name with the spaces around it taken off', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { name: '  Stream of Hope  ' } })
    expect(out.status).toBe(200)
    expect(out.sent.params.changes).toEqual({ name: 'Stream of Hope' })
  })

  it('asks whether the caller is an admin of that community before it writes anything', async () => {
    await ask({ function: 'update', community_id: 4, changes: { name: 'Stream of Hope' } })
    expect(world.gates).toEqual([['ana@x.co', 4, 'admin']])
  })

  it('normalises a picture into the address it will be painted from', async () => {
    const out = await ask({
      function: 'update',
      community_id: 4,
      changes: { picture: 'https://x.co/a b.jpg' },
    })
    expect(out.sent.params.changes).toEqual({ picture: 'https://x.co/a%20b.jpg' })
  })

  it('takes an emptied picture as a real answer and writes null', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { name: 'X', picture: '  ' } })
    expect(out.sent.params.changes).toEqual({ name: 'X', picture: null })
  })

  it('carries name and picture together when both were changed', async () => {
    const out = await ask({
      function: 'update',
      community_id: 4,
      changes: { name: 'New Name', picture: 'https://x.co/hall.jpg' },
    })
    expect(out.sent.params.changes).toEqual({ name: 'New Name', picture: 'https://x.co/hall.jpg' })
  })

  it('drops a join code and a creator out of the same request, because neither is writable here', async () => {
    const out = await ask({
      function: 'update',
      community_id: 4,
      changes: { name: 'New Name', join_id: 'HACK1', created_by: 'other@x.co' },
    })
    expect(out.sent.params.changes).toEqual({ name: 'New Name' })
    expect(JSON.stringify(out.sent.params)).not.toContain('HACK1')
  })

  it('refuses a name that is only spaces, because every screen would then call itself nothing', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { name: '   ' } })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('always called something')
  })

  it('refuses a name longer than a community is ever called', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { name: 'x'.repeat(121) } })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('too long')
  })

  it('refuses a picture that is not a picture address', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { picture: 'javascript:alert(1)' } })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('address')
  })

  it('refuses an update that would change neither of the two things it exists for', async () => {
    const out = await ask({ function: 'update', community_id: 4, changes: { colour: 'red' } })
    expect(out.status).toBe(400)
    expect(out.body.error).toMatch(/a name, a picture, or both/)
  })

  it('refuses a delete of the community row, which no browser is allowed to ask for', async () => {
    const out = await ask({ function: 'remove', community_id: 4 })
    expect(out.status).toBe(403)
  })
})

/*
  The page's half, through the real `callGod`: the body it builds and the door it takes it to. Firebase
  is stood in for by an address that is already signed in, and fetch is asked for nothing but a record
  of what left the browser.
*/
vi.mock('firebase/auth', () => ({ getIdToken: async () => 'an-id-token' }))
vi.mock('../src/firebase.js', () => ({
  auth: { currentUser: { email: 'ana@x.co' } },
  ready: Promise.resolve(),
}))

const sent = []
global.fetch = vi.fn(async (path, init) => {
  sent.push({ path, body: JSON.parse(init.body) })
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ data: { community_id: 4, name: 'New Name', picture: 'https://x.co/h.jpg' } }),
  }
})

const { AdminDashboardFetch } = await import('../src/page_functions/admin_dashboard.js')
const dashboard = new AdminDashboardFetch()

describe('AdminDashboardFetch.saveCommunity', () => {
  it('posts the write to the admin tier, which is the only door that will take it', async () => {
    sent.length = 0
    await dashboard.saveCommunity(4, { name: 'New Name', picture: 'https://x.co/h.jpg' })
    expect(sent[0].path).toBe('/api/admin')
    expect(sent[0].body).toEqual({
      action: 'community',
      params: {
        function: 'update',
        community_id: 4,
        changes: { name: 'New Name', picture: 'https://x.co/h.jpg' },
      },
    })
  })

  it('sends an empty picture as the null the column wants', async () => {
    sent.length = 0
    await dashboard.saveCommunity(4, { name: 'New Name', picture: '' })
    expect(sent[0].body.params.changes).toEqual({ name: 'New Name', picture: null })
  })

  it('says nothing about a column it was not asked about', async () => {
    sent.length = 0
    await dashboard.saveCommunity(4, { name: '  Only the name  ' })
    expect(sent[0].body.params.changes).toEqual({ name: 'Only the name' })
  })

  it('answers with the row the server now holds', async () => {
    const row = await dashboard.saveCommunity(4, { name: 'New Name' })
    expect(row).toEqual({ community_id: 4, name: 'New Name', picture: 'https://x.co/h.jpg' })
  })
})
