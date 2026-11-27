import { beforeEach, describe, expect, it, vi } from 'vitest'
import { God } from '../lib/god.js'

/*
  The one word in the middle, between the endpoint that decided a leave is allowed and the row it
  deletes.

  `God.call` picks a class by action and a method by `params.function`, and the member's two keys are
  `email` then `community_id` — the same order `remove` is handed. That order is the whole risk on this
  path: two strings passed the wrong way round delete nobody and answer as a success, because a delete
  with no matching row is not an error. So the pair is asserted here rather than trusted to a click
  through the app, along with the rule that a word the class does not carry never reaches the switch.
*/

const world = vi.hoisted(() => ({ sent: [] }))

vi.mock('../src/functions/community_members.js', () => ({
  CommunityMember: class {
    async leave(email, community_id) {
      world.sent.push([email, community_id])
      return { email, community_id, removed: true }
    }
  },
}))

function god() {
  return new God('http://example.invalid', 'fake-key')
}

beforeEach(() => {
  world.sent = []
})

describe("God.call member leave — the dispatcher's half", () => {
  it('hands the class the address and then the community, in that order', async () => {
    const done = await god().call('member', { function: 'leave', email: 'ana@x.co', community_id: 7 })
    expect(world.sent).toEqual([['ana@x.co', 7]])
    expect(done.removed).toBe(true)
  })

  it('refuses a leave that never named an address, rather than deleting on half a key', async () => {
    await expect(god().call('member', { function: 'leave', community_id: 7 })).rejects.toThrow(
      "params.email is required for 'leave'",
    )
    expect(world.sent).toEqual([])
  })

  it('refuses a word the member class does not carry', async () => {
    await expect(
      god().call('member', { function: 'walk_out', email: 'ana@x.co', community_id: 7 }),
    ).rejects.toThrow("action 'member' has no function 'walk_out'")
  })
})
