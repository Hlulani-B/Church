import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, churchFunctionWith } from './helpers/mock-supabase.js'

/*
  The CHECK on the `functions` table — `amount_matches_payment` — is mirrored in
  ChurchFunctions.create, and the mirror is what keeps a number typed into the amount box and
  then abandoned from coming back as a 23514 nobody can interpret. Both halves of it:

  1. A function that asks for no money stores no amount at all, whatever was typed beside the
     payment question before it was answered no.
  2. A function that asks for money stores the amount it was given.

  The read has its own invariant, and it is the one a careless rewrite would break: the three tallies
  are counted by the database in the same read that lists the functions, as an aggregate over each
  table under them with its condition carried on the aggregate's own name — one request whatever the
  community has planned, and no answer row crossing the wire to be added up in JS. And a function
  nobody has answered keeps its place in the list with noughts beside it; dropping it out would make a
  function created a minute ago look like it was never created at all.
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

  it('counts all three tallies in the one read that lists the functions', async () => {
    const mock = makeSupabaseMock({ functions, function_attending, function_paid })
    const planned = await churchFunctionWith(mock)
    await planned.list({ community_id: 'c1' })

    // Neither child table is asked for anything: the counts come back on the function rows.
    expect(mock.callsFor('functions')).toHaveLength(1)
    expect(mock.callsFor('function_attending')).toHaveLength(0)
    expect(mock.callsFor('function_paid')).toHaveLength(0)

    const [call] = mock.callsFor('functions')
    expect(call.select).toContain('going:function_attending(count)')
    expect(call.select).toContain('paid:function_paid(count)')
    expect(call.select).toContain('promised:function_paid(count)')
    /*
      The condition each tally counts by travels on the tally's own name, so `going` counts the
      answers that say yes and `paid` and `promised` are the two halves of the money table. Lose any
      one of these three and the register starts counting receipts as promises, which is a number a
      leader cannot tell is wrong.
    */
    expect(call.filters).toContainEqual({ kind: 'eq', col: 'going.attending', val: true })
    expect(call.filters).toContainEqual({ kind: 'eq', col: 'paid.paid', val: true })
    expect(call.filters).toContainEqual({ kind: 'eq', col: 'promised.paid', val: false })
    expect(call.orders).toEqual([
      { col: 'function_date', opts: { ascending: false } },
      { col: 'id', opts: { ascending: false } },
    ])
  })

  it('asks nothing when nothing has been planned', async () => {
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
  invariants are the ones a leader would notice breaking: the person who planned the function has to
  be named rather than left as an address, a person's two answers have to land on one line rather than
  two, an address the users table does not know still has to appear (its answer is
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
    created_by: 'leader@x',
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
        { email: 'leader@x', name: 'Lerato', surname: 'Mokoena' },
        { email: 'a@x', name: 'Thabo', surname: 'Sisulu' },
        { email: 'b@x', name: 'Nomsa', surname: 'Dlamini' },
      ],
      singleAsRow: true,
    })

  const byEmail = (people) => Object.fromEntries(people.map((one) => [one.email, one]))

  it('folds both answers onto one line per person', async () => {
    const planned = await churchFunctionWith(answered())
    const { function: one, people, planned_by } = await planned.details({
      community_id: 'c1',
      function_id: 7,
    })

    expect(one).toMatchObject({ id: 7, name: 'Congress' })
    // The planner comes out of the same read as the answerers' names, in words rather than as the
    // address `created_by` holds.
    expect(planned_by).toBe('Lerato Mokoena')
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

  /*
    Whoever signs a receipt off is a person the register has to name too, and their address is on the
    money row rather than the attendance one — a read that only collected `user_email` would leave the
    Confirmed-by column holding an address. `leader@x` is both the planner and the confirmer here, so
    the dedup is what is being locked as much as the name.
  */
  it('names the leader who confirmed a receipt out of the same single read', async () => {
    const mock = answered()
    const planned = await churchFunctionWith(mock)
    const { people } = await planned.details({ community_id: 'c1', function_id: 7 })

    const every = byEmail(people)
    expect(every['a@x'].confirmed_by_label).toBe('Lerato Mokoena')
    // The row that only promised a date has no confirmer, and is not given one.
    expect(every['c@x'].confirmed_by_label).toBeNull()

    expect(mock.callsFor('users')).toHaveLength(1)
    const wanted = mock.callsFor('users')[0].filters.find((one) => one.kind === 'in')
    expect(wanted.vals).toEqual(['a@x', 'b@x', 'c@x', 'leader@x'])
  })

  /*
    An address the users table does not know keeps its email in `confirmed_by_label`, which is how the
    page can tell a leader it has no name for from a leader it has: the register says the name is
    missing rather than printing the sign-in.
  */
  it('leaves an unknown confirmer as the address it was, beside the one it could name', async () => {
    const mock = makeSupabaseMock({
      functions: [congress],
      function_attending: [{ function_id: 7, user_email: 'a@x', attending: true }],
      function_paid: [
        {
          function_id: 7,
          user_email: 'a@x',
          paid: true,
          confirmed_by: 'ghost@x',
          confirmed_at: '2027-02-12T18:30:00Z',
        },
      ],
      users: [{ email: 'a@x', name: 'Thabo', surname: 'Sisulu' }],
      singleAsRow: true,
    })
    const planned = await churchFunctionWith(mock)
    const { people } = await planned.details({ community_id: 'c1', function_id: 7 })

    expect(people[0]).toMatchObject({ confirmed_by: 'ghost@x', confirmed_by_label: 'ghost@x' })
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

  it('reads every name in one request, planner included, when nobody answered', async () => {
    const mock = makeSupabaseMock({
      functions: [congress],
      function_attending: [],
      function_paid: [],
      singleAsRow: true,
    })
    const planned = await churchFunctionWith(mock)
    const { people, planned_by } = await planned.details({ community_id: 'c1', function_id: 7 })

    expect(people).toEqual([])
    expect(mock.callsFor('function_attending')).toHaveLength(1)
    expect(mock.callsFor('function_paid')).toHaveLength(1)
    /*
      One users read rather than none, because an empty register still has somebody who planned it.
      The table here holds nobody at all, so the address is said as itself — the page is not left with
      a blank where the planner should be.
    */
    expect(mock.callsFor('users')).toHaveLength(1)
    expect(planned_by).toBe('leader@x')
  })

  it('refuses to open a function of no community, or a community of no function', async () => {
    const mock = answered()
    const planned = await churchFunctionWith(mock)

    await expect(planned.details({ function_id: 7 })).rejects.toThrow(/community_id is required/)
    await expect(planned.details({ community_id: 'c1' })).rejects.toThrow(/function_id is required/)
    expect(mock.calls).toHaveLength(0)
  })
})

/*
  The member's side of the same three tables. Two invariants hold the whole flow up, and both are the
  kind that break quietly: `available` has to leave the days that have gone by out of the list, because
  a list of past functions invites an answer nobody will read; and `respond` has to write the money row
  in the shape `paid_fields_match` accepts — a receipt with no promised date, or a promised date with
  no receipt fields — since the third state, nothing at all, is not a row but the absence of one.
*/
describe('ChurchFunctions.available — only what has not happened', () => {
  it('keeps today and everything after it, soonest first', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)
    await planned.available({ community_id: 'c1' })

    const [call] = mock.callsFor('functions')
    const today = new Date().toISOString().slice(0, 10)
    expect(call.filters).toContainEqual({ kind: 'eq', col: 'community_id', val: 'c1' })
    // `gte` and not `gt`: a function held tonight has not happened, and its day is still the one the
    // column carries.
    expect(call.filters).toContainEqual({ kind: 'gte', col: 'function_date', val: today })
    expect(call.orders).toEqual([
      { col: 'function_date', opts: { ascending: true } },
      { col: 'id', opts: { ascending: true } },
    ])
  })

  it('refuses to list the plans of no community, and asks nothing', async () => {
    const mock = makeSupabaseMock({ functions: [] })
    const planned = await churchFunctionWith(mock)

    await expect(planned.available({})).rejects.toThrow(/community_id is required/)
    expect(mock.calls).toHaveLength(0)
  })
})

describe('ChurchFunctions.rsvp — one function seen from underneath', () => {
  const congress = {
    id: 7,
    community_id: 'c1',
    name: 'Congress',
    function_date: '2027-03-06',
    requires_payment: true,
    amount: '250.00',
    created_by: 'leader@x',
  }

  const asked = () =>
    makeSupabaseMock({
      functions: [congress],
      function_attending: [{ function_id: 7, user_email: 'a@x', attending: true }],
      function_paid: [
        {
          function_id: 7,
          user_email: 'a@x',
          paid: true,
          proof_path: 'functions/a@x/7/receipt.png',
          proof_submitted_at: '2027-02-11T09:00:00Z',
          confirmed_by: 'leader@x',
          confirmed_at: '2027-02-12T18:30:00Z',
        },
      ],
      users: [
        { email: 'leader@x', name: 'Lerato', surname: 'Mokoena' },
        { email: 'a@x', name: 'Thabo', surname: 'Sisulu' },
      ],
      singleAsRow: true,
    })

  it('names the planner, and folds this address\'s two answers into one standing', async () => {
    const planned = await churchFunctionWith(asked())
    const read = await planned.rsvp({ community_id: 'c1', function_id: 7, user_email: 'a@x' })

    expect(read.planned_by).toBe('Lerato Mokoena')
    expect(read.you).toMatchObject({
      email: 'a@x',
      attending: true,
      recorded: true,
      paid: true,
      proof_path: 'functions/a@x/7/receipt.png',
      confirmed_by_label: 'Lerato Mokoena',
    })
  })

  it('answers a person who has never been asked as nothing recorded, not as a no', async () => {
    const mock = makeSupabaseMock({ functions: [congress], singleAsRow: true })
    const planned = await churchFunctionWith(mock)
    const { you } = await planned.rsvp({
      community_id: 'c1',
      function_id: 7,
      user_email: 'nobody@x',
    })

    // null and not false: an unanswered invitation and a refusal are different states, and a page that
    // cannot tell them apart will offer the wrong form.
    expect(you).toMatchObject({ attending: null, recorded: false, paid: false, proof_path: null })
  })

  it('refuses a function of another community before reading either answer', async () => {
    const mock = asked()
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.rsvp({ community_id: 'c2', function_id: 7, user_email: 'a@x' }),
    ).rejects.toThrow(/another community/)
    expect(mock.callsFor('function_attending')).toHaveLength(0)
    expect(mock.callsFor('function_paid')).toHaveLength(0)
  })

  it('refuses to answer for nobody', async () => {
    const mock = asked()
    const planned = await churchFunctionWith(mock)

    await expect(planned.rsvp({ community_id: 'c1', function_id: 7 })).rejects.toThrow(
      /user_email is required/,
    )
    expect(mock.calls).toHaveLength(0)
  })
})

describe('ChurchFunctions.respond — the member\'s own two writes', () => {
  const paid = { id: 7, community_id: 'c1', requires_payment: true, name: 'Congress' }
  const free = { id: 8, community_id: 'c1', requires_payment: false, name: 'Picnic' }

  // The mock answers a `.maybeSingle()` read with the first row of the table, so a mock built for
  // these tests holds exactly the one function the call is meant to find and nothing else.
  const answer = (row) => makeSupabaseMock({ functions: [row], singleAsRow: true })

  const wrote = (mock, table) => mock.callsFor(table).find((one) => one.upsert)

  it('writes a receipt as paid with no promised date beside it', async () => {
    const mock = answer(paid)
    const planned = await churchFunctionWith(mock)
    await planned.respond({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      attending: true,
      proof_path: 'https://x/functions/a@x/7/receipt.png',
    })

    expect(wrote(mock, 'function_attending').upsert).toMatchObject({
      function_id: 7,
      user_email: 'a@x',
      attending: true,
    })
    const money = wrote(mock, 'function_paid')
    expect(money.upsert).toMatchObject({
      paid: true,
      proof_path: 'https://x/functions/a@x/7/receipt.png',
      expected_pay_date: null,
    })
    expect(money.upsert.proof_submitted_at).toBeTruthy()
    expect(money.onConflict).toBe('function_id,user_email')
  })

  it('writes a promised date as not paid, with no receipt fields at all', async () => {
    const mock = answer(paid)
    const planned = await churchFunctionWith(mock)
    await planned.respond({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      attending: true,
      expected_pay_date: '2027-02-20',
    })

    const money = wrote(mock, 'function_paid')
    expect(money.upsert).toMatchObject({
      paid: false,
      expected_pay_date: '2027-02-20',
      proof_path: null,
      proof_submitted_at: null,
    })
  })

  it('writes no money row when neither a receipt nor a day was given', async () => {
    const mock = answer(paid)
    const planned = await churchFunctionWith(mock)
    await planned.respond({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      attending: false,
    })

    expect(wrote(mock, 'function_attending')).toBeTruthy()
    // The read that follows the write asks this table too; what must not appear is an upsert.
    expect(wrote(mock, 'function_paid')).toBeUndefined()
  })

  it('writes no money row under a function that asks nothing, even for a date sent', async () => {
    const mock = answer(free)
    const planned = await churchFunctionWith(mock)
    await planned.respond({
      community_id: 'c1',
      function_id: 8,
      user_email: 'a@x',
      attending: true,
      expected_pay_date: '2027-02-20',
    })

    expect(wrote(mock, 'function_paid')).toBeUndefined()
  })

  it('never signs its own confirmation', async () => {
    const mock = answer(paid)
    const planned = await churchFunctionWith(mock)
    await planned.respond({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      attending: true,
      proof_path: 'https://x/receipt.png',
    })

    // A confirmation is a leader's signature: nothing on this path can write one, whatever a page
    // puts in its body.
    const money = wrote(mock, 'function_paid').upsert
    expect(money).not.toHaveProperty('confirmed_by')
    expect(money).not.toHaveProperty('confirmed_at')
  })

  it('refuses an answer that is neither yes nor no, and touches nothing', async () => {
    const mock = answer(paid)
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.respond({ community_id: 'c1', function_id: 7, user_email: 'a@x' }),
    ).rejects.toThrow(/attending is either true or false/)
    expect(mock.callsFor('function_attending')).toHaveLength(0)
    expect(mock.callsFor('function_paid')).toHaveLength(0)
  })
})

/*
  A leader's signature on the same money row a member cannot sign. Three rules are worth locking, and
  all three are the kind that break silently on a register: a confirmation writes the name and the
  moment together, because `isConfirmed` on the page asks for both and a row holding one would sit in
  neither section; taking a signature back clears both, because erasing only the name would leave a
  receipt still reading as paid-and-confirmed, which is precisely the mistake the button exists to
  undo; and a promise is not a payment, so there is nothing to check off on a date somebody gave.

  The mock answers a `.maybeSingle()` read with the first row of the table, so each mock here holds
  exactly the function and the one money row the call is meant to find.
*/
describe('ChurchFunctions.confirm — a leader\'s signature, and taking it back', () => {
  const congress = { id: 7, community_id: 'c1', requires_payment: true, name: 'Congress' }

  const receipt = (over = {}) =>
    makeSupabaseMock({
      functions: [congress],
      function_paid: [
        {
          function_id: 7,
          user_email: 'a@x',
          paid: true,
          proof_path: 'functions/a@x/7/receipt.png',
          confirmed_by: null,
          confirmed_at: null,
          ...over,
        },
      ],
      singleAsRow: true,
    })

  const signed = (mock) => mock.callsFor('function_paid').find((one) => one.update)

  it('stamps the confirmer and the moment together', async () => {
    const mock = receipt()
    const planned = await churchFunctionWith(mock)
    await planned.confirm({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      confirmed_by: 'leader@x',
    })

    expect(signed(mock).update).toMatchObject({ confirmed_by: 'leader@x' })
    expect(Date.parse(signed(mock).update.confirmed_at)).not.toBeNaN()
    // The pair the row is addressed by, so a leader checking one person cannot write over another's.
    expect(signed(mock).filters).toContainEqual({ kind: 'eq', col: 'function_id', val: 7 })
    expect(signed(mock).filters).toContainEqual({ kind: 'eq', col: 'user_email', val: 'a@x' })
  })

  it('clears both columns on an un-confirm, so the row goes back to waiting', async () => {
    const mock = receipt({ confirmed_by: 'leader@x', confirmed_at: '2027-02-12T18:30:00Z' })
    const planned = await churchFunctionWith(mock)
    await planned.confirm({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      confirmed_by: 'leader@x',
      confirm: false,
    })

    expect(signed(mock).update).toEqual({ confirmed_by: null, confirmed_at: null })
  })

  it('refuses to sign a promise, because no money is in yet', async () => {
    const mock = receipt({ paid: false, proof_path: null, expected_pay_date: '2027-02-20' })
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.confirm({
        community_id: 'c1',
        function_id: 7,
        user_email: 'a@x',
        confirmed_by: 'leader@x',
      }),
    ).rejects.toThrow(/promised a date rather than paid/)
    expect(signed(mock)).toBeUndefined()
  })

  /*
    Taking a signature back is allowed whatever the row says, since the mistake being undone may well
    be a confirmation put on a row that should never have had one.
  */
  it('will un-sign a row it would refuse to sign', async () => {
    const mock = receipt({ paid: false, confirmed_by: 'leader@x', confirmed_at: '2027-02-12T18:30:00Z' })
    const planned = await churchFunctionWith(mock)
    const back = await planned.confirm({
      community_id: 'c1',
      function_id: 7,
      user_email: 'a@x',
      confirmed_by: 'leader@x',
      confirm: false,
    })

    expect(back).toEqual({ confirmed_by: null, confirmed_at: null })
  })

  it('refuses a person with no payment row, and writes nothing', async () => {
    const mock = makeSupabaseMock({ functions: [congress], function_paid: [], singleAsRow: true })
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.confirm({
        community_id: 'c1',
        function_id: 7,
        user_email: 'a@x',
        confirmed_by: 'leader@x',
      }),
    ).rejects.toThrow(/no payment recorded/)
    expect(signed(mock)).toBeUndefined()
  })

  it('refuses a function of another community before touching the money row', async () => {
    const mock = receipt()
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.confirm({
        community_id: 'c2',
        function_id: 7,
        user_email: 'a@x',
        confirmed_by: 'leader@x',
      }),
    ).rejects.toThrow(/another community/)
    expect(mock.callsFor('function_paid')).toHaveLength(0)
  })

  it('refuses to sign as nobody, and for nobody', async () => {
    const mock = receipt()
    const planned = await churchFunctionWith(mock)

    await expect(
      planned.confirm({ community_id: 'c1', function_id: 7, user_email: 'a@x' }),
    ).rejects.toThrow(/confirmed_by is required/)
    await expect(
      planned.confirm({ community_id: 'c1', function_id: 7, confirmed_by: 'leader@x' }),
    ).rejects.toThrow(/user_email is required/)
    expect(mock.calls).toHaveLength(0)
  })
})
