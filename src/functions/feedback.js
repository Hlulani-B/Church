import { createClient } from '@supabase/supabase-js'

/*
  The one table on this app that is not about a community. `feedback` speaks about the whole
  product, so nobody else's attendance is exposed by reading it and every admin, in every
  fellowship, is looking at the same pile. That is also why nothing here takes a community_id:
  the row has none, and inventing one at the class boundary would only lie about what the
  table actually stores.

  Every row carries the address of whoever wrote it. The column is nullable on the schema — a
  row can be unsigned — but nothing on this path writes an empty one: /api/self fills `email`
  from the verified ID token and a submission without it is refused here rather than filed
  anonymously. The point of the pile is that it is a record of what real people said, so the
  address is not an optional extra that a caller can be talked out of.

  Writing a row and reading one back are two different questions, though, and the answer to the
  second one changed: what `all` hands out is a name, not an address. See its comment.
*/
const TABLE = 'feedback'
const MAX_FIELD = 4000

// The pile is about the app rather than about one fellowship, so this is the app's own wording for a
// note whose author the `users` table cannot name. It never falls back to the address, because the
// address is the one thing this read used to give away.
const UNNAMED = 'Somebody this app has not named'

function clean(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_FIELD)
}

export class Feedback {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  async create({ stars, solves_problem, improvements, additions, most_challenging, email }) {
    const s = Number(stars)
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      throw Object.assign(new Error('stars must be an integer between 1 and 5'), { status: 400 })
    }
    if (typeof solves_problem !== 'boolean') {
      throw Object.assign(new Error('solves_problem must be true or false'), { status: 400 })
    }
    // The address is not a caller's choice: it is the one the endpoint read off the ID token, and
    // a request that arrives without it did not come from a signed-in browser. Refusing beats
    // filing an anonymous row, because an anonymous row is exactly what this table no longer has.
    if (!email) {
      throw Object.assign(new Error('feedback is signed with your address; this request had none'), { status: 400 })
    }
    const row = {
      stars: s,
      email: String(email).trim().toLowerCase(),
      solves_problem,
      improvements: clean(improvements),
      additions: clean(additions),
      most_challenging: clean(most_challenging),
    }
    const { data, error } = await this.client.from(TABLE).insert(row).select().single()
    if (error) throw error
    return data
  }

  /*
    Every row, newest first, capped at a page. There is no server-side paging on purpose: this
    is a pile somebody scrolls to see whether the same complaint keeps showing up rather than a
    report. If it ever outgrows 500, an "older" button becomes a real need — before that it is
    decoration.

    What leaves here is a name rather than an address. The pile is read by every signed-in person,
    and the app's rule is that nobody is shown anybody else's email but their own — and a downloaded
    file answers to that rule exactly as a screen does, because a file is a screen somebody else ends
    up reading. So each row goes out with `submitted_by`, the two names the `users` table holds for
    that address off one read over the addresses on this page, and the bare address is kept only on
    the caller's own note. `email` is the token's, which /api/self puts into every browser request
    before it gets here; a call that arrives without one — a server-key read, a test — gets names for
    everybody and an address for nobody, which is the safe half of the mistake.
  */
  async all({ limit = 500, email } = {}) {
    const capped = Math.max(1, Math.min(Number(limit) || 500, 500))
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(capped)
    if (error) throw error
    const rows = data || []
    const called = await this.#named(rows.map((one) => one.email))
    const own = String(email || '').trim().toLowerCase()
    return rows.map((one) => {
      const address = String(one.email || '').trim().toLowerCase()
      const mine = Boolean(address) && address === own
      return {
        ...one,
        email: mine ? one.email : null,
        submitted_by: called.get(address) || (mine ? one.email : null) || UNNAMED,
      }
    })
  }

  /*
    The naming read, in the shape the function register already uses for the same question: one `in`
    over the addresses rather than one request per note. Both halves of a name are joined with the
    single space a page prints them with, and an address the `users` table has never heard of is left
    out of the map entirely, so the caller can tell "there is no name for this one" from "here is the
    name" instead of guessing from a value that happens to look like an email.
  */
  async #named(addresses) {
    const wanted = [
      ...new Set(
        addresses
          .filter(Boolean)
          .map((one) => String(one).trim().toLowerCase()),
      ),
    ]
    if (!wanted.length) return new Map()
    const { data, error } = await this.client
      .from('users')
      .select('email, name, surname')
      .in('email', wanted)
    if (error) throw error
    return new Map(
      (data || [])
        .map((person) => [
          String(person.email).trim().toLowerCase(),
          `${person.name || ''} ${person.surname || ''}`.trim(),
        ])
        .filter(([address, words]) => address && words),
    )
  }
}
