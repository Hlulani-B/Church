import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/admin.js'

/*
  The gate in front of the one irreversible call a browser can make.

  /api/admin already asks whether the caller is an admin of the community, and for everything else on
  this tier that is the whole answer. Deleting everything is not everything else: an admin is somebody
  who runs a fellowship, the founder is the person who opened it, and only the second of the two may
  empty it. These tests hold the four things the endpoint insists on — that the community exists, that
  `created_by` was written, that the address on the id token is that address, and that the name was
  typed back — and the two ways it declines to say more than it must: the founder's address is never
  repeated to somebody who is not them, and a name is compared without regard to capital letters,
  which is a kindness rather than a weakening because the row is still the thing being matched.

  Only the gate is real here. The tier's shared plumbing is stubbed so the test is about the branch
  and not about Firebase, and `finish` answers with the params it was handed, which is where you can
  see what the purge class would actually be given.
*/

const world = vi.hoisted(() => ({ email: '', community: null }))

vi.mock('../lib/god.js', () => ({
  God: class {
    constructor() {
      this.url = 'http://example.invalid'
      this.key = 'fake-key'
    }
  },
  authenticate: async () => ({ token: 'an-id-token' }),
  matchesServerKey: () => false,
  verifiedEmail: async () => (world.email ? { email: world.email } : { reason: 'no email on the token' }),
  roleGate: async () => ({ role: 'admin' }),
  finish: async (god, action, params, creator, res) => res.status(200).json({ data: { action, params } }),
}))

vi.mock('../src/functions/community.js', () => ({
  Community: class {
    async find() {
      return world.community
    }
  },
}))

const GRACE = { community_id: 4, name: 'Grace Fellowship', created_by: 'ana@x.co' }

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
  await handler({ method: 'POST', headers: {}, body: { action: 'purge', params } }, res)
  return res.out
}

beforeEach(() => {
  world.email = 'ana@x.co'
  world.community = GRACE
})

describe('/api/admin purge — who may empty a community', () => {
  it('lets the founder through once the name is typed back, and hands the purge the id off the row', async () => {
    const out = await ask({ function: 'deleteAll', community_id: 4, name: 'Grace Fellowship' })
    expect(out.status).toBe(200)
    expect(out.body.data.params.community_id).toBe(4)
    expect(out.body.data.params.name).toBe('Grace Fellowship')
  })

  it('reads the name without regard to capital letters and passes on what was typed, trimmed', async () => {
    const out = await ask({ function: 'deleteAll', community_id: 4, name: '  GRACE fellowship ' })
    expect(out.status).toBe(200)
    expect(out.body.data.params.name).toBe('GRACE fellowship')
  })

  it('refuses an admin of the community who is not the person that opened it', async () => {
    world.email = 'ben@x.co'
    const out = await ask({ function: 'deleteAll', community_id: 4, name: 'Grace Fellowship' })
    expect(out.status).toBe(403)
    expect(out.body.error).toMatch(/only the person who opened/)
  })

  it('does not read the founder’s address out to the person who is not them', async () => {
    world.email = 'ben@x.co'
    const out = await ask({ function: 'deleteAll', community_id: 4, name: 'Grace Fellowship' })
    expect(JSON.stringify(out.body)).not.toContain('ana@x.co')
  })

  it('refuses a community opened before the column existed, and says what to do about it', async () => {
    world.community = { ...GRACE, created_by: null }
    const out = await ask({ function: 'deleteAll', community_id: 4, name: 'Grace Fellowship' })
    expect(out.status).toBe(403)
    expect(out.body.error).toContain('created_by')
  })

  it('refuses an id that names no community rather than reporting an empty success', async () => {
    world.community = null
    const out = await ask({ function: 'deleteAll', community_id: 91, name: 'Grace Fellowship' })
    expect(out.status).toBe(400)
    expect(out.body.error).toBe('there is no community with that id')
  })

  it('refuses to delete on an empty box, because the typed name is the proof', async () => {
    const out = await ask({ function: 'deleteAll', community_id: 4, name: '   ' })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('params.name is required')
  })

  it('refuses a name that belongs to a different fellowship', async () => {
    const out = await ask({ function: 'deleteAll', community_id: 4, name: 'Cornerstone' })
    expect(out.status).toBe(400)
    expect(out.body.error).toBe('the name typed does not match the name of this community')
  })

  it('knows no other function on the purge class, so a guessed action cannot reach the tables', async () => {
    const out = await ask({ function: 'deleteRows', community_id: 4, name: 'Grace Fellowship' })
    expect(out.status).toBe(403)
  })
})
