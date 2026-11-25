import { createClient } from '@supabase/supabase-js'

const FUNCTION = 'functions'
const ATTENDING = 'function_attending'
const PAID = 'function_paid'

/*
  What the functions page reads and writes: a gathering somebody is planning, who is going to it
  and who has paid for it. Three tables rather than one, because the two answers a person gives
  about a function are separate — whether they will be there, and whether the money is in — and
  each is one row per person, keyed on (function_id, user_email).

  Row level security is on for all three and no policy has been written yet, so a browser reading
  them with the anon key gets nothing back. That is why this class is only ever built by God with
  the service key, and why the register comes through /api/leader while a member's own answer comes
  through /api/self: in both cases the community named in the request has already been shown to be
  one the caller belongs to before anything here runs.

  The tallies are counts, not the columns they are counted from. `going` is how many said they
  will be there, `paid` how many have put money in, and `promised` how many gave a date instead.
  They are counted by the database on the read that lists the functions, so a function that was
  created a minute ago answers noughts rather than vanishing from the list — a function nobody has
  answered yet is the normal state of one that has just been planned.
*/
export class ChurchFunctions {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  /*
    Every call here is scoped by a community, and the opened-out read is scoped by a function as
    well. The name is said out loud rather than assumed, because the message is what a reader of a
    400 gets: a missing function_id answered as "community_id is required" sends them looking at the
    wrong half of the request.
  */
  #id(value, what = 'community_id') {
    if (!value) throw new Error(`${what} is required`)
  }

  /*
    The one place a function id is turned into a row, and the one place that row is compared with the
    community the caller was gated on. The id arrives from a click or a url and the caller has only
    been shown to belong to *a* community, so without this comparison a person could point another
    fellowship's function id at a page and read its plans, or write their own name under it. `details`,
    `rsvp` and `respond` all start here so none of them can be opened without the comparison.
  */
  async #one(community_id, function_id) {
    this.#id(community_id)
    this.#id(function_id, 'function_id')
    const { data, error } = await this.client
      .from(FUNCTION)
      .select()
      .eq('id', function_id)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('there is no such function')
    if (data.community_id !== community_id) {
      throw new Error('that function belongs to another community')
    }
    return data
  }

  /*
    Names for a handful of addresses, in one read. Nothing in the schema ties
    `function_attending.user_email`, `function_paid.user_email` or `functions.created_by` to `users` —
    those tables were created without those foreign keys, so PostgREST has no relationship to fold the
    way Attendance does with `event`. An address with no user row keeps its email as its name rather
    than dropping out of the answer: somebody planned, paid or said they are coming, and that is still
    true whoever they turned out to be.
  */
  async #called(emails) {
    const wanted = [...new Set(emails.filter(Boolean))]
    if (!wanted.length) return new Map()
    const { data, error } = await this.client
      .from('users')
      .select('email, name, surname')
      .in('email', wanted)
    if (error) throw error
    return new Map(
      data.map((person) => [
        person.email,
        `${person.name || ''} ${person.surname || ''}`.trim() || person.email,
      ]),
    )
  }

  /*
    One planned function. `created_by` is the address whoever is asking signed in with, and it is
    handed in by /api/leader off the caller's token — never off what the page claimed. The price
    is kept or dropped here rather than left for the table's `amount_matches_payment` check to
    catch: a free function stores no amount at all, so a number typed and then abandoned when the
    payment switch was left off cannot come back as a 23514 the reader has no way to interpret.
  */
  async create({
    community_id,
    name,
    function_date,
    location,
    requires_payment,
    amount,
    created_by,
  }) {
    this.#id(community_id)
    const paid = requires_payment === true
    const { data, error } = await this.client
      .from(FUNCTION)
      .insert({
        community_id,
        name,
        function_date,
        location: location || null,
        requires_payment: paid,
        amount: paid ? amount : null,
        created_by,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  /*
    Every function this community has, soonest-relevant first, each with its three counts. Postgres
    makes the counts, in the same read that lists the functions: each tally is an aggregate over the
    table under it, given a name of its own so that the condition saying which rows it counts can
    travel with it (`going.attending`, `paid.paid`, `promised.paid`). That is one request and one row
    per function, where counting them here used to be three requests and one row per answer — on the
    seeded calendar, 42 functions with 440 answers under them came back as 26 KB in 529-871 ms in
    three reads, and as 14 KB in 289 ms in one.

    A function nobody has answered keeps its place in the list with noughts beside it, which is the
    thing a hand-written count loop gets wrong most often: an aggregate over nothing answers as nought
    rather than leaving the function out, and a function that was planned a minute ago is still a
    function.
  */
  async list({ community_id }) {
    this.#id(community_id)
    const { data, error } = await this.client
      .from(FUNCTION)
      .select(
        '*, going:function_attending(count), paid:function_paid(count), promised:function_paid(count)',
      )
      .eq('community_id', community_id)
      .eq('going.attending', true)
      .eq('paid.paid', true)
      .eq('promised.paid', false)
      .order('function_date', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw error
    return (data || []).map((one) => ({
      ...one,
      going: tallied(one.going),
      paid: tallied(one.paid),
      promised: tallied(one.promised),
    }))
  }

  /*
    One function in full: its own row, who planned it, and everybody who has answered it with a name
    beside their address. The function is read first and compared with the community in the request
    before either child table is touched, because the id comes in from a url or a click and the caller
    has only been shown to lead *a* community — see #one.

    The names cost a second read rather than an embed, for the reason given on #called. One `in` over
    the addresses found below the function answers for everybody at once, and the planner's address is
    put into the same list rather than asked for on its own — the page is read by a leader who wants to
    know whose function this is before they want to know anything else about it.
  */
  async details({ community_id, function_id }) {
    const one = await this.#one(community_id, function_id)

    const [attending, paid] = await Promise.all([
      this.client.from(ATTENDING).select().eq('function_id', one.id),
      this.client.from(PAID).select().eq('function_id', one.id),
    ])
    for (const read of [attending, paid]) {
      if (read.error) throw read.error
    }

    const emails = [...attending.data, ...paid.data].map((row) => row.user_email)
    // One `users` read for the whole page: everybody who answered, whoever planned it, and whoever
    // signed a receipt off. The leader's register is a list of people, so an address is never the
    // thing it wants to show.
    const called = await this.#called([
      ...emails,
      one.created_by,
      ...paid.data.map((row) => row.confirmed_by),
    ])

    // One row per person, both answers folded onto it: whether they are coming, and where the
    // money got to. A promise keeps the date they gave even once the paid row is later confirmed,
    // because when they meant to pay is part of the record either way.
    const people = new Map()
    const person = (email) => {
      if (!people.has(email)) {
        people.set(email, {
          email,
          label: called.get(email) || email,
          attending: null,
          paid: false,
          expected_pay_date: null,
          proof_path: null,
          proof_submitted_at: null,
          confirmed_by: null,
          confirmed_by_label: null,
          confirmed_at: null,
        })
      }
      return people.get(email)
    }
    for (const row of attending.data) {
      person(row.user_email).attending = row.attending === true
    }
    for (const row of paid.data) {
      Object.assign(person(row.user_email), {
        paid: row.paid === true,
        expected_pay_date: row.expected_pay_date,
        proof_path: row.proof_path,
        proof_submitted_at: row.proof_submitted_at,
        confirmed_by: row.confirmed_by,
        confirmed_by_label:
          (row.confirmed_by && called.get(row.confirmed_by)) || row.confirmed_by || null,
        confirmed_at: row.confirmed_at,
      })
    }

    return {
      function: one,
      // The same words `rsvp` uses for the same fact, so the two pages cannot start calling the
      // planner by different names. An address with no user row is still said as its email.
      planned_by: (one.created_by && called.get(one.created_by)) || one.created_by || null,
      people: [...people.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }
  }

  /*
    What a member is offered on their own way in: this community's functions whose day has not gone
    by. `function_date` is a date rather than a moment, so "still to come" is settled against today
    and not against this second — a function held tonight is still on the list, one held yesterday is
    not, because nobody can answer it any more. Soonest first, because a person here is looking at
    what is next rather than what was last. The day is the server's own, which is UTC: anywhere within
    a day of Greenwich gets the list it expects, and the disagreement is the hours around midnight.
  */
  async available({ community_id }) {
    this.#id(community_id)
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await this.client
      .from(FUNCTION)
      .select()
      .eq('community_id', community_id)
      .gte('function_date', today)
      .order('function_date', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw error
    return data
  }

  /*
    The standing of one address under a function that has already been read and compared with the
    caller's community — see #one. `rsvp` ends here, and so does `respond`, which is why the row it
    looked up on the way in is handed over rather than the id being sent to be looked up again: the
    read after a save has to be fresh, but a fresh read of the two answers does not need a third read
    of the plan it was answered under.

    A missing row answers as null rather than as an empty object, because "nobody has asked me this
    yet" and "I said no" are different states and the page has to be able to tell them apart.
  */
  async #view(one, user_email) {
    const [answer, money] = await Promise.all([
      this.client
        .from(ATTENDING)
        .select()
        .eq('function_id', one.id)
        .eq('user_email', user_email)
        .maybeSingle(),
      this.client
        .from(PAID)
        .select()
        .eq('function_id', one.id)
        .eq('user_email', user_email)
        .maybeSingle(),
    ])
    for (const read of [answer, money]) {
      if (read.error) throw read.error
    }

    const row = money.data
    const called = await this.#called([one.created_by, row?.confirmed_by])
    return {
      function: one,
      planned_by: (one.created_by && called.get(one.created_by)) || one.created_by || null,
      you: {
        email: user_email,
        attending: answer.data ? answer.data.attending === true : null,
        recorded: Boolean(answer.data),
        paid: row ? row.paid === true : false,
        expected_pay_date: row?.expected_pay_date ?? null,
        proof_path: row?.proof_path ?? null,
        proof_submitted_at: row?.proof_submitted_at ?? null,
        confirmed_by: row?.confirmed_by ?? null,
        confirmed_by_label: (row?.confirmed_by && called.get(row.confirmed_by)) || row?.confirmed_by || null,
        confirmed_at: row?.confirmed_at ?? null,
      },
    }
  }

  /*
    One function as the person standing under it sees it: what was planned, who planned it, and what
    the two tables say about this address. The reads under the function are keyed on the
    (function_id, user_email) pair that makes each answer unique, so this costs two single-row reads
    rather than the whole list `details` pulls, and the one users read covers both the planner and
    whoever signed off a payment.
  */
  async rsvp({ community_id, function_id, user_email }) {
    this.#id(user_email, 'user_email')
    const one = await this.#one(community_id, function_id)
    return this.#view(one, user_email)
  }

  /*
    The member's own two writes, and the only place in this file that puts rows in the child tables.

    Coming or not coming is always recorded — it is the answer every function asks for. What happens
    to the money depends on `requires_payment`, because a free function has no reason to hold a money
    row and a date or receipt sent for one is dropped rather than written, and on what was handed in:

      a receipt   → paid = true, the file and the moment, and no promised date   (paid_fields_match)
      a date only → paid = false, that date, and no receipt fields at all
      neither     → no money row is written or touched. The check on the table will not hold a promise
                    with no date in it, and a person who has nothing to give yet has nothing recorded;
                    the page says that out loud rather than saving a row it cannot have.

    A money row is written whether or not this person is coming, because somebody who paid does not
    lose the right to put the receipt in because they changed their mind about attending.

    Both writes are upserts on (function_id, user_email), so answering twice edits the first answer
    rather than starting a second one. `confirmed_by` and `confirmed_at` are never sent from here: a
    confirmation is a leader's signature, and a member re-saving their own receipt cannot sign it. What
    comes back is the fresh read, so the page shows what the table says rather than what it typed.
  */
  async respond({
    community_id,
    function_id,
    user_email,
    attending,
    proof_path,
    expected_pay_date,
  }) {
    this.#id(user_email, 'user_email')
    if (attending !== true && attending !== false) {
      throw new Error('attending is either true or false — nobody is an answer')
    }
    const one = await this.#one(community_id, function_id)
    const receipt = typeof proof_path === 'string' && proof_path.trim() ? proof_path.trim() : null
    const promised =
      typeof expected_pay_date === 'string' && expected_pay_date.trim()
        ? expected_pay_date.trim()
        : null

    const answer = await this.client.from(ATTENDING).upsert(
      { function_id: one.id, user_email, attending },
      { onConflict: 'function_id,user_email' },
    )
    if (answer.error) throw answer.error

    if (one.requires_payment && (receipt || promised)) {
      const money = receipt
        ? {
            paid: true,
            proof_path: receipt,
            proof_submitted_at: new Date().toISOString(),
            expected_pay_date: null,
          }
        : {
            paid: false,
            proof_path: null,
            proof_submitted_at: null,
            expected_pay_date: promised,
          }
      const wrote = await this.client.from(PAID).upsert(
        { function_id: one.id, user_email, ...money },
        { onConflict: 'function_id,user_email' },
      )
      if (wrote.error) throw wrote.error
    }

    return this.#view(one, user_email)
  }
}

/*
  The number Postgres counted for one function. An aggregate embed comes back as a one-row array
  holding the count as text; anything else — no embed at all, or a shape this read did not ask for —
  is nought, because a tally nobody can read is not a number a leader should be shown.
*/
function tallied(embedded) {
  const count = Number(embedded?.[0]?.count)
  return Number.isFinite(count) ? count : 0
}
