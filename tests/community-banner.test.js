import { describe, expect, it } from 'vitest'
import { Community } from '../src/functions/community.js'
import { makeSupabaseMock } from './helpers/mock-supabase.js'

/*
  What a person's own list of fellowships carries, now that every dashboard opens on one.

  `memberOf` is a self-tier read — /api/self answers it for the address on the caller's id token — and the
  columns it names are therefore the boundary of what a member can learn about a community. The name and
  the banner picture are the two things a fellowship shows everybody inside it, which is why the member
  and leader dashboards now paint their header from this read rather than from `find`. The join code is
  not: `find` sits on the admin tier for exactly that reason, so this select is the line that keeps it
  there. Both halves are locked here, because adding a column to a read this wide is how a code leaks one
  commit later.

  Nothing in the mock filters, so the community table holds only the rows this read is meant to find.
*/

function communityWith(mock) {
  const community = new Community('http://example.invalid', 'fake-key')
  community.client = mock
  return community
}

const GRACE = { community_id: 'c1', name: 'Grace Point Fellowship', picture: 'https://example.invalid/grace.jpg' }
const LINK = { community_id: 'c1', role: 'member' }

describe('Community.memberOf — the caller’s own list, banner included', () => {
  it('names three columns and no join code', async () => {
    const mock = makeSupabaseMock({ community_members: [LINK], community: [GRACE] })
    await communityWith(mock).memberOf('ana@x.co')
    const read = mock.callsFor('community')[0]
    expect(read.select).toBe('community_id, name, picture')
    expect(read.select).not.toContain('join_id')
    expect(read.select).not.toContain('created_by')
  })

  it('hands back the picture with the caller’s own role beside it', async () => {
    const mock = makeSupabaseMock({ community_members: [LINK], community: [GRACE] })
    const rows = await communityWith(mock).memberOf('ana@x.co')
    expect(rows).toEqual([{ ...GRACE, role: 'member' }])
  })

  it('asks about the one address it was given', async () => {
    const mock = makeSupabaseMock({ community_members: [LINK], community: [GRACE] })
    await communityWith(mock).memberOf('ana@x.co')
    const links = mock.callsFor('community_members')[0]
    expect(links.select).toBe('community_id, role')
    expect(links.filters).toEqual([{ kind: 'eq', col: 'email', val: 'ana@x.co' }])
  })

  it('says nothing about a person in no community, reading no communities at all', async () => {
    const mock = makeSupabaseMock({ community: [GRACE] })
    await expect(communityWith(mock).memberOf('ana@x.co')).resolves.toEqual([])
    expect(mock.callsFor('community')).toHaveLength(0)
  })

  it('refuses to answer for nobody rather than for everybody', async () => {
    const mock = makeSupabaseMock({ community_members: [LINK], community: [GRACE] })
    await expect(communityWith(mock).memberOf('')).rejects.toThrow('email is required')
  })

  // A fellowship whose admin never chose a banner: the row comes back with nothing in the column, and
  // that is the dashboard's plain band rather than a broken one.
  it('carries a community with no picture as a community with no picture', async () => {
    const plain = { community_id: 'c2', name: 'Stream of Hope Fellowship', picture: null }
    const mock = makeSupabaseMock({
      community_members: [{ community_id: 'c2', role: 'leader' }],
      community: [plain],
    })
    const [row] = await communityWith(mock).memberOf('ana@x.co')
    expect(row.picture).toBeNull()
    expect(row.role).toBe('leader')
  })
})
