import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/self.js'

/*
  Who may take themselves out of a fellowship, and what the endpoint refuses before it deletes.

  Leaving is the only write on this tier that removes a row the caller did not create that second ago,
  so it is worth stating what it cannot do. It cannot name another person: `params.email` was already
  overwritten with the address off the id token, so the body's version is gone before this branch runs.
  It cannot leave a community the caller is not in, which would otherwise answer as a success having
  changed nothing. And it cannot strand a fellowship: the last admin is refused, exactly as
  /api/admin refuses anybody who tries to take an only admin's role away, because a community with no
  admin left has nobody who can change its join code or clear its records.

  Only the branch is real here. The tier's plumbing is stubbed the way the other /api/self tests stub
  it, `finish` answers with the params it was handed, and the roster is a plain array, so what these
  assertions read is what the delete would actually be given.
*/

const world = vi.hoisted(() => ({ email: '', roster: [], reads: [] }))

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

vi.mock('../src/functions/community_members.js', () => ({
  CommunityMember: class {
    async find(email, community_id) {
      world.reads.push(['find', email, community_id])
      return (
        world.roster.find(
          (one) => one.email === email && String(one.community_id) === String(community_id),
        ) ?? null
      )
    }
    async all({ community_id } = {}) {
      world.reads.push(['all', community_id])
      return world.roster.filter((one) => String(one.community_id) === String(community_id))
    }
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
  await handler({ method: 'POST', headers: {}, body: { action: 'member', params } }, res)
  return res.out
}

beforeEach(() => {
  world.email = 'ana@x.co'
  world.reads = []
  world.roster = [{ email: 'ana@x.co', community_id: 7, role: 'member' }]
})

describe('/api/self member leave — walking out of a community', () => {
  it('takes the caller out of the fellowship named, and out of nothing else', async () => {
    const out = await ask({
      function: 'leave',
      community_id: 7,
      email: 'ben@x.co',
      role: 'admin',
      join_id: 'ABCDEFG',
    })
    expect(out.status).toBe(200)
    expect(out.body.data.params).toEqual({ function: 'leave', community_id: 7, email: 'ana@x.co' })
  })

  it('does not read the whole roster for somebody who is only a member', async () => {
    await ask({ function: 'leave', community_id: 7 })
    expect(world.reads).toEqual([['find', 'ana@x.co', 7]])
  })

  it('lets an admin go once somebody else can run it', async () => {
    world.roster = [
      { email: 'ana@x.co', community_id: 7, role: 'admin' },
      { email: 'ben@x.co', community_id: 7, role: 'admin' },
    ]
    const out = await ask({ function: 'leave', community_id: 7 })
    expect(out.status).toBe(200)
    expect(out.body.data.params.email).toBe('ana@x.co')
  })

  it('refuses the only admin and says what to do first', async () => {
    world.roster = [{ email: 'ana@x.co', community_id: 7, role: 'admin' }]
    const out = await ask({ function: 'leave', community_id: 7 })
    expect(out.status).toBe(403)
    expect(out.body.error).toMatch(/only admin here/)
    expect(out.body.error).toMatch(/make somebody else an admin/)
  })

  it('refuses to leave a community the caller is not in, rather than reporting an empty success', async () => {
    const out = await ask({ function: 'leave', community_id: 91 })
    expect(out.status).toBe(400)
    expect(out.body.error).toBe('you are not a member of that community')
  })

  it('refuses to leave a fellowship it was never told the id of', async () => {
    const out = await ask({ function: 'leave' })
    expect(out.status).toBe(400)
    expect(out.body.error).toContain('params.community_id is required')
  })

  /*
    The word an admin uses for somebody else stays behind the admin tier. The row is the same row and
    the delete is the same delete, but `remove` arrives at /api/admin, where the caller has to hold the
    role — so this tier's whitelist answering with a refusal is what keeps the two doors from becoming
    one door.
  */
  it('does not answer the word an admin uses for somebody else', async () => {
    const out = await ask({ function: 'remove', community_id: 7, email: 'ben@x.co' })
    expect(out.status).toBe(403)
    expect(world.reads).toEqual([])
  })
})
