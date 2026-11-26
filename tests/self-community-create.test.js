import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/self.js'
import { Community } from '../src/functions/community.js'
import { makeSupabaseMock } from './helpers/mock-supabase.js'

/*
  Who a community is recorded as belonging to.

  `community.created_by` is the address the delete-everything path later trusts, so the write of it is
  a security question rather than a bookkeeping one: if a browser could put any address in that column
  when it opened a fellowship, the same person could then delete a fellowship they never opened. So
  /api/self takes the creator off the caller's own id token, in the one place the token's address is
  written into the params, and a value that arrives in the body is overwritten rather than honoured.

  The tier's plumbing is stubbed so this test is about that one line; `finish` answers with the params
  it was handed, which is exactly what the Community class will insert.
*/

const world = vi.hoisted(() => ({ email: '' }))

vi.mock('../lib/god.js', () => ({
  God: class {
    constructor() {
      this.url = 'http://example.invalid'
      this.key = 'fake-key'
    }
  },
  SELF_FIELDS: { user: ['name', 'surname'] },
  authenticate: async () => ({ token: 'an-id-token' }),
  matchesServerKey: () => false,
  reading: (value) => (value === null || value === undefined || value === '' ? NaN : Number(value)),
  resolveAbsenceGathering: async (god, community_id, event_date, event_name) => event_name,
  verifiedEmail: async () => (world.email ? { email: world.email } : { reason: 'no email on the token' }),
  finish: async (god, action, params, creator, res) => res.status(200).json({ data: { action, params } }),
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
  return res.out
}

beforeEach(() => {
  world.email = 'ana@x.co'
})

describe('/api/self community create — the founder is the caller', () => {
  it('writes the address on the id token as the one who opened it', async () => {
    const out = await ask({ function: 'create', name: 'Grace Fellowship' })
    expect(out.status).toBe(200)
    expect(out.body.data.params.created_by).toBe('ana@x.co')
    expect(out.body.data.params.name).toBe('Grace Fellowship')
  })

  it('lets the token win when the body claims somebody else opened it', async () => {
    const out = await ask({
      function: 'create',
      name: 'Grace Fellowship',
      created_by: 'someone.else@x.co',
    })
    expect(out.body.data.params.created_by).toBe('ana@x.co')
    expect(JSON.stringify(out.body.data.params)).not.toContain('someone.else@x.co')
  })

  it('refuses to open a community with no name, so no owner is written against a blank row', async () => {
    const out = await ask({ function: 'create', name: '   ' })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('params.name is required')
  })
})

/*
  The other half of the same rule, one layer down: the column is written with the row, and an owner
  that was never given stays null instead of being guessed. A community with a null owner is one the
  delete path refuses, which is the honest answer — nobody can be shown to have opened it.
*/
describe('Community.create — the owner goes in beside the name', () => {
  function communityWith(mock) {
    const community = new Community('http://example.invalid', 'fake-key')
    community.client = mock
    return community
  }

  it('inserts created_by with the name', async () => {
    const mock = makeSupabaseMock()
    const row = await communityWith(mock).create({ name: 'Grace', created_by: 'ana@x.co' })
    expect(mock.callsFor('community')[0].insert).toEqual({ name: 'Grace', created_by: 'ana@x.co' })
    expect(row.created_by).toBe('ana@x.co')
  })

  it('writes no owner rather than inventing one', async () => {
    const mock = makeSupabaseMock()
    await communityWith(mock).create({ name: 'Grace' })
    expect(mock.callsFor('community')[0].insert).toEqual({ name: 'Grace', created_by: null })
  })
})
