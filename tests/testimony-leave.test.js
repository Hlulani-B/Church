import { describe, expect, it } from 'vitest'
import { TestimoniesFetch } from '../src/page_functions/testimonies.js'
import { makeSupabaseMock } from './helpers/mock-supabase.js'

/*
  Which of a community's testimonies belong to this address, and what the clear-out does with them.

  A testimony row carries its author as ciphertext written with a key that never leaves the browser, so
  the database cannot answer "whose rows are these" — `myTestimonies` reads the community and matches
  here, and `deleteMine` sends what it matched one row at a time to the delete the card's own button
  uses. Three things are worth locking, because all three are easy to break by accident:

    - the match is on the author and on nothing else. A sharing whose readers were narrowed to a name
      list the author is not on is still theirs, and leaving a community cannot be blocked by a
      permission the person set years ago. So the read asks for two columns and no canRead filter runs.
    - the walk covers every page. A clear-out that stops at the first hundred rows would report a tidy
      success while leaving the rest behind, which is the worst kind of wrong.
    - one failure is counted rather than ending the run, and a person who shared nothing has their
      departure decided by one read instead of a hundred pointless ones.

  The class is assembled without its constructor, because the constructor stands up a Supabase client
  and a roster reader that neither of these two methods touches. `deleteTestimony` is replaced by a
  recorder, so the test states which ids the clear-out handed over — the author check inside it is not
  this path's business, and what matters here is that no other author's row is ever offered to it.
*/

function clearout(rows, answers = {}) {
  const mock = makeSupabaseMock({ testimony: rows })
  const sent = []
  const fetcher = Object.create(TestimoniesFetch.prototype)
  fetcher.client = mock
  fetcher.deleteTestimony = async ({ testimony_id }) => {
    sent.push(testimony_id)
    const answer = answers[testimony_id]
    if (answer instanceof Error) throw answer
    return answer ?? { removed: true, testimony_id }
  }
  return { fetcher, mock, sent }
}

describe('TestimoniesFetch.myTestimonies — whose rows these are', () => {
  it('finds this address under every spelling of it', async () => {
    const { fetcher } = clearout([
      { testimony_id: 1, user_email: 'ana@x.co' },
      { testimony_id: 2, user_email: 'ben@x.co' },
      { testimony_id: 3, user_email: '  ANA@X.co ' },
    ])
    const found = await fetcher.myTestimonies(7, 'Ana@x.co')
    expect(found.map((one) => one.testimony_id)).toEqual([1, 3])
  })

  it('asks the table for ids and addresses only, under one community, and never for a permission', async () => {
    const { fetcher, mock } = clearout([{ testimony_id: 1, user_email: 'ana@x.co' }])
    await fetcher.myTestimonies(7, 'ana@x.co')
    const call = mock.callsFor('testimony')[0]
    expect(call.select).toBe('testimony_id, user_email')
    expect(call.filters).toEqual([{ kind: 'eq', col: 'community_id', val: 7 }])
    expect(call.order.col).toBe('testimony_id')
    expect(call.range).toEqual([0, 99])
  })

  /*
    The row a person shared with a name list they are not even on comes back as theirs. This is the
    invariant the paged read on screen cannot carry, because that one narrows to what the viewer may
    see: here the only question is authorship, so a sharing is always collectable by the one who wrote it.
  */
  it('does not hide a restricted sharing from its own author', async () => {
    const { fetcher } = clearout([
      { testimony_id: 1, user_email: 'ana@x.co', allow_all: false, authorise: ['ben@x.co'] },
    ])
    const found = await fetcher.myTestimonies(7, 'ana@x.co')
    expect(found).toEqual([{ testimony_id: 1, author: 'ana@x.co' }])
  })

  it('walks past a full page and stops at the one that comes back short', async () => {
    const rows = []
    for (let one = 1; one <= 103; one += 1) {
      rows.push({ testimony_id: one, user_email: one % 2 ? 'ana@x.co' : 'ben@x.co' })
    }
    const { fetcher, mock } = clearout(rows)
    const found = await fetcher.myTestimonies(7, 'ana@x.co')
    expect(found.length).toBe(52)
    const calls = mock.callsFor('testimony')
    expect(calls.length).toBe(2)
    expect(calls.map((one) => one.range)).toEqual([[0, 99], [100, 199]])
  })

  it('says so when it was not told which community or who is asking', async () => {
    const { fetcher, mock } = clearout([{ testimony_id: 1, user_email: 'ana@x.co' }])
    await expect(fetcher.myTestimonies(null, 'ana@x.co')).rejects.toThrow('community_id is required')
    await expect(fetcher.myTestimonies(7, '')).rejects.toThrow('Nobody is signed in')
    expect(mock.callsFor('testimony')).toEqual([])
  })
})

describe('TestimoniesFetch.deleteMine — taking your own sharings back', () => {
  it('only ever hands over rows that answer to this address', async () => {
    const { fetcher, sent } = clearout([
      { testimony_id: 1, user_email: 'ana@x.co' },
      { testimony_id: 2, user_email: 'ben@x.co' },
      { testimony_id: 3, user_email: 'ana@x.co' },
    ])
    const took = await fetcher.deleteMine({ community_id: 7, email: 'ana@x.co' })
    expect(sent).toEqual([1, 3])
    expect(took.testimonies).toBe(2)
  })

  it('counts the files that went with them and the ones storage kept', async () => {
    const { fetcher } = clearout(
      [
        { testimony_id: 1, user_email: 'ana@x.co' },
        { testimony_id: 2, user_email: 'ana@x.co' },
        { testimony_id: 3, user_email: 'ana@x.co' },
      ],
      {
        1: { removed: true, testimony_id: 1, file: { path: 'testimonies/ana/1.png', taken: true } },
        2: { removed: true, testimony_id: 2, file: { path: '', taken: false } },
        3: { removed: true, testimony_id: 3 },
      },
    )
    expect(await fetcher.deleteMine({ community_id: 7, email: 'ana@x.co' })).toEqual({
      testimonies: 3,
      files: 1,
      filesLeft: 1,
      failed: 0,
    })
  })

  /*
    A single refusal — the server down, one row already gone, a network that dropped mid-way — must not
    abandon the rest of the pile. The leaving itself has already happened by this point, so a person
    standing outside the fellowship is left with an honest count of what is still there and a page that
    offers to try the rest again.
  */
  it('keeps going after a row refuses and reports what it could not finish', async () => {
    const { fetcher, sent } = clearout(
      [
        { testimony_id: 1, user_email: 'ana@x.co' },
        { testimony_id: 2, user_email: 'ana@x.co' },
        { testimony_id: 3, user_email: 'ana@x.co' },
      ],
      { 2: new Error('The server refused the request (500).') },
    )
    const took = await fetcher.deleteMine({ community_id: 7, email: 'ana@x.co' })
    expect(sent).toEqual([1, 2, 3])
    expect(took).toEqual({ testimonies: 2, files: 0, filesLeft: 0, failed: 1 })
  })

  it('reads once and reports nought for a person who never shared anything', async () => {
    const { fetcher, mock, sent } = clearout([{ testimony_id: 1, user_email: 'ben@x.co' }])
    const took = await fetcher.deleteMine({ community_id: 7, email: 'ana@x.co' })
    expect(took).toEqual({ testimonies: 0, files: 0, filesLeft: 0, failed: 0 })
    expect(sent).toEqual([])
    expect(mock.callsFor('testimony').length).toBe(1)
  })
})
