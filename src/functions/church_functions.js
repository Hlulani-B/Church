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
  the service key, and why the page comes through /api/leader: the community named in the request
  has already been shown to be one the caller leads or admins before anything here runs.

  The tallies are counts, not the columns they are counted from. `going` is how many said they
  will be there, `paid` how many have put money in, and `promised` how many gave a date instead.
  A function with no rows under it answers nought rather than vanishing from the list, because a
  function nobody has answered yet is the normal state of one that was just created.
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
    Every function this community has, soonest-relevant first, each with its three counts. The
    rows of the two child tables come back in one read each — `in` over the ids just listed — and
    are grouped here rather than asked for function by function, so a community with thirty
    functions costs three queries instead of sixty-one. An id with nothing under it keeps its
    place in the list with noughts beside it.
  */
  async list({ community_id }) {
    this.#id(community_id)
    const { data: functions, error } = await this.client
      .from(FUNCTION)
      .select()
      .eq('community_id', community_id)
      .order('function_date', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw error
    if (!functions.length) return []

    const ids = functions.map((one) => one.id)
    const [attending, paid] = await Promise.all([
      this.client.from(ATTENDING).select('function_id, attending').in('function_id', ids),
      this.client.from(PAID).select('function_id, paid').in('function_id', ids),
    ])
    for (const read of [attending, paid]) {
      if (read.error) throw read.error
    }

    const going = tally(attending.data, (one) => one.attending === true)
    const moneyIn = tally(paid.data, (one) => one.paid === true)
    const promised = tally(paid.data, (one) => one.paid === false)

    return functions.map((one) => ({
      ...one,
      going: going.get(one.id) || 0,
      paid: moneyIn.get(one.id) || 0,
      promised: promised.get(one.id) || 0,
    }))
  }

  /*
    One function in full: its own row, and everybody who has answered it with a name beside their
    address. The function is read first and compared with the community in the request before
    either child table is touched, because the id comes in from a url or a click and the caller has
    only been shown to lead *a* community — without this comparison a leader could point the id of
    another fellowship's function at the page and read its list of names.

    The names cost a second read rather than an embed because nothing in the schema ties
    `function_attending.user_email` or `function_paid.user_email` to `users` — those tables were
    created without that foreign key, so PostgREST has no relationship to fold through the way
    Attendance does with `event`. One `in` over the addresses found below the function answers for
    everybody at once. An address with no user row keeps its email as its name rather than dropping
    the answer off the page: somebody paid or said they are coming, and that is still true whoever
    they turned out to be.
  */
  async details({ community_id, function_id }) {
    this.#id(community_id)
    this.#id(function_id, 'function_id')
    const { data: one, error } = await this.client
      .from(FUNCTION)
      .select()
      .eq('id', function_id)
      .maybeSingle()
    if (error) throw error
    if (!one) throw new Error('there is no such function')
    if (one.community_id !== community_id) {
      throw new Error('that function belongs to another community')
    }

    const [attending, paid] = await Promise.all([
      this.client.from(ATTENDING).select().eq('function_id', one.id),
      this.client.from(PAID).select().eq('function_id', one.id),
    ])
    for (const read of [attending, paid]) {
      if (read.error) throw read.error
    }

    const emails = [...new Set([...attending.data, ...paid.data].map((row) => row.user_email))]
    let names = []
    if (emails.length) {
      const read = await this.client
        .from('users')
        .select('email, name, surname')
        .in('email', emails)
      if (read.error) throw read.error
      names = read.data
    }
    const called = new Map(
      names.map((person) => [
        person.email,
        `${person.name || ''} ${person.surname || ''}`.trim() || person.email,
      ]),
    )

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
        confirmed_at: row.confirmed_at,
      })
    }

    return {
      function: one,
      people: [...people.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }
  }
}

// How many of these rows belong to each function, of the ones the test says yes to.
function tally(rows, yes) {
  const counts = new Map()
  for (const one of rows || []) {
    if (!yes(one)) continue
    counts.set(one.function_id, (counts.get(one.function_id) || 0) + 1)
  }
  return counts
}
