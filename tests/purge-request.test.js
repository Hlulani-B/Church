import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
  The browser's half of the delete. Two things are worth locking: that the request that leaves the
  page is the one /api/admin is written to answer — action `purge`, function `deleteAll`, the id and
  the typed name — and that an empty box never becomes a request at all. The second is not politeness:
  a page that asked anyway would only be answered by a refusal, and a person who clicked "delete for
  good" and got a server error has learned less than the one told, before anything was sent, which box
  they left empty.
*/

vi.mock('../src/page_functions/god.js', () => ({
  callGod: vi.fn(async (action, params) => ({ action, params })),
}))

import { callGod } from '../src/page_functions/god.js'
import { PurgeFetch } from '../src/page_functions/purge.js'

const purge = new PurgeFetch()

beforeEach(() => {
  callGod.mockClear()
})

describe('PurgeFetch.deleteAll', () => {
  it('asks the admin tier to empty one named community', async () => {
    const answer = await purge.deleteAll({ community_id: 4, name: 'Grace Fellowship' })
    expect(callGod).toHaveBeenCalledWith('purge', {
      function: 'deleteAll',
      community_id: 4,
      name: 'Grace Fellowship',
    })
    expect(answer.params.name).toBe('Grace Fellowship')
  })

  it('sends the name without the spaces somebody typed around it', async () => {
    await purge.deleteAll({ community_id: 4, name: '  Grace Fellowship  ' })
    expect(callGod.mock.calls[0][1].name).toBe('Grace Fellowship')
  })

  it('stops an empty box before it reaches the server', async () => {
    await expect(purge.deleteAll({ community_id: 4, name: '   ' })).rejects.toThrow(/Type the community name/)
    await expect(purge.deleteAll({ community_id: 4 })).rejects.toThrow(/Type the community name/)
    expect(callGod).not.toHaveBeenCalled()
  })

  it('stops when no community was named, because that is the request that deletes the wrong thing', async () => {
    await expect(purge.deleteAll({ name: 'Grace Fellowship' })).rejects.toThrow(/No community was named/)
    expect(callGod).not.toHaveBeenCalled()
  })
})
