import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, feedbackWith } from './helpers/mock-supabase.js'

/*
  The feedback pile is read by every signed-in person, so the read is where the app's rule about
  addresses is settled rather than page by page: nobody sees anybody else's email but their own.
  `all` names each note off one `users` read and keeps the bare address on only the caller's own row.
  The rule reaches the read rather than the page because the pile's other use is a downloaded file,
  and a file is a screen somebody else ends up reading.
*/

let next = 1
const note = (email, extra = {}) => ({
  id: next++,
  email,
  stars: 4,
  solves_problem: true,
  improvements: 'nothing',
  created_at: '2026-11-01T09:00:00Z',
  ...extra,
})

describe('Feedback.all — a pile of names rather than a pile of addresses', () => {
  it('names every author off one users read over the addresses on the page', async () => {
    const mock = makeSupabaseMock({
      feedback: [note('ana@x'), note('ben@x')],
      users: [
        { email: 'ana@x', name: 'Ana', surname: 'Dlamini' },
        { email: 'ben@x', name: 'Ben', surname: 'Khumalo' },
      ],
    })
    const pile = await feedbackWith(mock)
    const rows = await pile.all({ email: 'ana@x' })

    expect(mock.callsFor('users')).toHaveLength(1)
    const [read] = mock.callsFor('users')
    expect(read.filters).toContainEqual({ kind: 'in', col: 'email', vals: ['ana@x', 'ben@x'] })
    expect(rows.map((one) => one.submitted_by)).toEqual(['Ana Dlamini', 'Ben Khumalo'])
  })

  it('keeps the bare address on the caller\'s own note and on nobody else\'s', async () => {
    const mock = makeSupabaseMock({
      feedback: [note('ana@x'), note('ben@x')],
      users: [
        { email: 'ana@x', name: 'Ana', surname: 'Dlamini' },
        { email: 'ben@x', name: 'Ben', surname: 'Khumalo' },
      ],
    })
    const pile = await feedbackWith(mock)
    const rows = await pile.all({ email: 'ana@x' })

    expect(rows[0].email).toBe('ana@x')
    expect(rows[1].email).toBeNull()
    // A neighbour's name is the answer, and the address that keys it is not part of it.
    expect(JSON.stringify(rows[1])).not.toContain('ben@x')
  })

  it('says so in words when the users table holds nobody behind a note', async () => {
    const mock = makeSupabaseMock({
      feedback: [note('ghost@x')],
      users: [],
    })
    const pile = await feedbackWith(mock)
    const [row] = await pile.all({ email: 'ana@x' })

    expect(row.submitted_by).toBe('Somebody this app has not named')
    expect(row.email).toBeNull()
  })

  it('shows a person their own address when the users row has no name for it', async () => {
    const mock = makeSupabaseMock({ feedback: [note('ana@x')], users: [] })
    const pile = await feedbackWith(mock)
    const [row] = await pile.all({ email: 'ana@x' })

    expect(row.submitted_by).toBe('ana@x')
    expect(row.email).toBe('ana@x')
  })

  /*
    `Feedback.create` files every address lower-cased, and the token's is compared rather than
    trusted to have arrived in the same shape — so both sides of the match are settled here, or a
    note written by 'Ana@X' would be shown its own address to a reader signed in as 'ana@x'.
  */
  it('matches an address whatever case either side arrived in', async () => {
    const mock = makeSupabaseMock({
      feedback: [note('Ana@X'.toLowerCase())],
      users: [{ email: 'ANA@x', name: 'Ana', surname: 'Dlamini' }],
    })
    const pile = await feedbackWith(mock)
    const [row] = await pile.all({ email: 'ana@X' })

    expect(row.submitted_by).toBe('Ana Dlamini')
    expect(row.email).toBe('ana@x')
  })

  it('asks the users table nothing when the pile is empty', async () => {
    const mock = makeSupabaseMock({ feedback: [], users: [] })
    const pile = await feedbackWith(mock)

    expect(await pile.all({ email: 'ana@x' })).toEqual([])
    expect(mock.callsFor('users')).toHaveLength(0)
  })

  it('names everybody and shows nobody an address when the call carries no caller', async () => {
    const mock = makeSupabaseMock({
      feedback: [note('ana@x')],
      users: [{ email: 'ana@x', name: 'Ana', surname: 'Dlamini' }],
    })
    const pile = await feedbackWith(mock)
    const [row] = await pile.all()

    expect(row.submitted_by).toBe('Ana Dlamini')
    expect(row.email).toBeNull()
  })
})
