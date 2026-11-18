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
*/
const TABLE = 'feedback'
const MAX_FIELD = 4000

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
  */
  async all({ limit = 500 } = {}) {
    const capped = Math.max(1, Math.min(Number(limit) || 500, 500))
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(capped)
    if (error) throw error
    return data
  }
}
