import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, churchFunctionWith } from './helpers/mock-supabase.js'

/*
  The CHECK on the `functions` table — `amount_matches_payment` — is mirrored in
  ChurchFunctions.create, and the mirror is what keeps a number typed into the amount box and
  then abandoned from coming back as a 23514 nobody can interpret. Both halves of it:

  1. A function that asks for no money stores no amount at all, whatever was typed beside the
     payment question before it was answered no.
  2. A function that asks for money stores the amount it was given.

  The read has its own invariant, and it is the one a careless rewrite would break: the two child
  tables are asked for once each over the ids just listed, so thirty planned functions cost three
  queries rather than sixty-one. And a function nobody has answered keeps its place in the list
  with noughts beside it — dropping it out would make a function created a minute ago look like
  it was never created at all.
*/

const base = {
  community_id: 'c1',
  name: 'Annual Youth Congress',
  function_date: '2027-03-06',
  location: 'Community Hall, Soweto',
  created_by: 'leader@x',
}

describe('ChurchFunctions.create — the price follows the payment question', () => {
  it('keeps no amount when the function asks for none, whatever was typed', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    await planned.create({ ...base, requires_payment: false, amount: 250 })

    const [call] = mock.callsFor('functions')
    expect(call.insert).toMatchObject({ requires_payment: false, amount: null })
  })

  it('keeps the amount when the function asks for money', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    await planned.create({ ...base, requires_payment: true, amount: 250 })

    const [call] = mock.callsFor('functions')
    expect(call.insert).toMatchObject({ requires_payment: true, amount: 250 })
  })

  it('writes a location left blank as a null, not as an empty string', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    await planned.create({ ...base, location: '', requires_payment: false })

    const [call] = mock.callsFor('functions')
    expect(call.insert.location).toBeNull()
  })

  it('refuses to plan a function for no community', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    await expect(
      planned.create({ ...base, community_id: '', requires_payment: false }),
    ).rejects.toThrow(/community_id is required/)
    expect(mock.callsFor('functions')).toHaveLength(0)
  })
})

describe('ChurchFunctions.list — the tallies, and how few reads they cost', () => {
  const functions = [
    { id: 1, community_id: 'c1', name: 'Congress' },
    { id: 2, community_id: 'c1', name: 'Picnic' },
  ]
  const function_attending = [
    { function_id: 1, attending: true },
    { function_id: 1, attending: false },
    { function_id: 2, attending: true },
  ]
  const function_paid = [
    { function_id: 1, paid: true },
    { function_id: 1, paid: false },
    { function_id: 1, paid: false },
  ]

  it('counts going, paid and promised against the function each row belongs to', async () => {
    const mock = makeSupabaseMock({ functions, function_attending, function_paid })
    const planned = await churchFunctionWith(mock)
    const listed = await planned.list({ community_id: 'c1' })

    expect(listed).toHaveLength(2)
    expect(listed[0]).toMatchObject({ id: 1, going: 1, paid: 1, promised: 2 })
    // A function nobody has answered yet is still a function, and it is counted as noughts —
    // which is what every row looks like until a member has a screen to answer from.
    expect(listed[1]).toMatchObject({ id: 2, going: 1, paid: 0, promised: 0 })
  })

  it('asks each child table once, over the ids it just read', async () => {
    const mock = makeSupabaseMock({ functions, function_attending, function_paid })
    const planned = await churchFunctionWith(mock)
    await planned.list({ community_id: 'c1' })

    const [attending] = mock.callsFor('function_attending')
    const [paid] = mock.callsFor('function_paid')
    expect(mock.callsFor('function_attending')).toHaveLength(1)
    expect(mock.callsFor('function_paid')).toHaveLength(1)
    expect(attending.filters).toContainEqual({ kind: 'in', col: 'function_id', vals: [1, 2] })
    expect(paid.filters).toContainEqual({ kind: 'in', col: 'function_id', vals: [1, 2] })
  })

  it('asks nothing of the child tables when nothing has been planned', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    const listed = await planned.list({ community_id: 'c1' })

    expect(listed).toEqual([])
    expect(mock.callsFor('function_attending')).toHaveLength(0)
    expect(mock.callsFor('function_paid')).toHaveLength(0)
  })
})

/*
  The opened-out read is what the four sections above the answer table are built from, so its
  invariants are the ones a leader would notice breaking: a person's two answers have to land on one
  line rather than two, an address the users table does not know still has to appear (its answer is
  real whoever it came from), and a function belonging to a different fellowship must be refused
  before a single name is read. That last one is the whole reason the row is read first and compared
  rather than the child tables being filtered by an id the caller supplied.
*/
describe('ChurchFunctions.details — one function and everybody under it', () => {
  const congress = {
    id: 7,
    community_id: 'c1',
    name: 'Congress',
    requires_payment: true,
    amount: '250.00',
  }

  const answered = () =>
    makeSupabaseMock({
      functions: [congress],
      function_attending: [
        { function_id: 7, user_email: 'a@x', attending: true },
        { function_id: 7, user_email: 'b@x', attending: false },
        { function_id: 7, user_email: 'c@x', attending: true },
      ],
      function_paid: [
        {
          function_id: 7,
          user_email: 'a@x',
          paid: true,
          proof_path: 'proofs/7/a.png',
          proof_submitted_at: '2027-02-11T09:00:00Z',
          confirmed_by: 'leader@x',
          confirmed_at: '2027-02-12T18:30:00Z',
        },
        {
          function_id: 7,
          user_email: 'c@x',
          paid: false,
          expected_pay_date: '2027-02-20',
        },
      ],
      users: [
        { email: 'a@x', name: 'Thabo', surname: 'Sisulu' },
        { email: 'b@x', name: 'Nomsa', surname: 'Dlamini' },
      ],
      singleAsRow: true,
    })

  const byEmail = (people) => Object.fromEntries(people.map((one) => [one.email, one]))

  it('folds both answers onto one line per person', async () => {
    const planned = await churchFunctionWith(answered())
    const { function: one, people } = await planned.details({
      community_id: 'c1',
      function_id: 7,
    })

    expect(one).toMatchObject({ id: 7, name: 'Congress' })
    expect(people).toHaveLength(3)
    const every = byEmail(people)
    expect(every['a@x']).toMatchObject({
      label: 'Thabo Sisulu',
      attending: true,
      paid: true,
      confirmed_by: 'leader@x',
    })
    expect(every['b@x']).toMatchObject({ label: 'Nomsa Dlamini', attending: false, paid: false })
    expect(every['c@x']).toMatchObject({ attending: true, paid: false, expected_pay_date: '2027-02-20' })
  })

  it('keeps an address the users table does not know, named by itself', async () => {
    const planned = await churchFunctionWith(answered())
    const { people } = await planned.details({ community_id: 'c1', function_id: 7 })

    // c@x answered both tables and has no user row: the answer is on record either way.
    expect(byEmail(people)['c@x'].label).toBe('c@x')
  })

  it('refuses a function that lives in another community, before reading any answer', async () => {
    const mock = answered()
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.details({ community_id: 'c2', function_id: 7 }),
    ).rejects.toThrow(/another community/)
    expect(mock.callsFor('function_attending')).toHaveLength(0)
    expect(mock.callsFor('function_paid')).toHaveLength(0)
    expect(mock.callsFor('users')).toHaveLength(0)
  })

  it('reads names once, and does not ask for any when nobody answered', async () => {
    const mock = makeSupabaseMock({
      functions: [congress],
      function_attending: [],
      function_paid: [],
      singleAsRow: true,
    })
    const planned = await churchFunctionWith(mock)
    const { people } = await planned.details({ community_id: 'c1', function_id: 7 })

    expect(people).toEqual([])
    expect(mock.callsFor('function_attending')).toHaveLength(1)
    expect(mock.callsFor('function_paid')).toHaveLength(1)
    expect(mock.callsFor('users')).toHaveLength(0)
  })

  it('refuses to open a function of no community, or a community of no function', async () => {
    const mock = answered()
    const planned = await churchFunctionWith(mock)

    await expect(planned.details({ function_id: 7 })).rejects.toThrow(/community_id is required/)
    await expect(planned.details({ community_id: 'c1' })).rejects.toThrow(/function_id is required/)
    expect(mock.calls).toHaveLength(0)
  })
})
