import { createClient } from '@supabase/supabase-js'

const BUCKET = 'kopano'

// The shape every upload in this app comes back as. A url from anywhere else — a link somebody
// typed into a box, a file in another project's bucket — is not this code's to delete.
const PUBLIC = `/storage/v1/object/public/${BUCKET}/`

/*
  One community's accumulated record, in the order it is taken back out.

  The order is not decoration. `function_attending`, `function_paid` and the two extra tables are
  keyed on `function_id` and carry no community of their own, so they can only be reached through
  the list of this community's functions — and they have to go before the functions themselves,
  because those rows are what `functions` cascades to and a cascade leaves nothing to count. The
  same reason puts `extra_members` after the two tables that name one of them.

  What is deliberately not in this list is the point of the page: `community` and `community_members`
  stay. This is a clearing-out to free space, not a leaving — the fellowship, its people, their roles
  and its join code are all still there afterwards, and the admin who pressed the button is still the
  admin of it. `users` and `feedback` stay for the same kind of reason: a person belongs to the app,
  not to the pile of attendance rows being cleared, and the feedback table carries no community_id at
  all, so it is not this request's to touch.
*/
const TABLES = [
  { table: 'function_attending', under: 'function' },
  { table: 'function_paid', under: 'function' },
  { table: 'extra_function_attending', under: 'function' },
  { table: 'extra_function_paid', under: 'function' },
  { table: 'functions', under: 'community' },
  { table: 'extra_event', under: 'community' },
  { table: 'extra_servings', under: 'community' },
  { table: 'extra_testimony', under: 'community' },
  { table: 'extra_members', under: 'community' },
  { table: 'event', under: 'community' },
  { table: 'session', under: 'community' },
  { table: 'servings', under: 'community' },
  { table: 'prayer_topics', under: 'community' },
  { table: 'testimony', under: 'community' },
]

/*
  Where a file can be hiding. A receipt is its own column on the two payment tables; a testimony
  that was shared as a picture or a document keeps its url in `body`, the same column that holds
  somebody's written words (encrypted, and worthless once the row is gone). These are read before
  anything is deleted, because afterwards there is nothing left that says what was uploaded.
*/
const FILES = [
  { table: 'function_paid', column: 'proof_path', under: 'function' },
  { table: 'extra_function_paid', column: 'proof_path', under: 'function' },
  { table: 'testimony', column: 'body', under: 'community' },
  { table: 'extra_testimony', column: 'body', under: 'community' },
]

// A stored value → the path of the object inside the bucket, or '' when it is not one of ours.
export function bucketPath(value) {
  const text = String(value || '').trim()
  const at = text.indexOf(PUBLIC)
  if (at < 0) return ''
  const rest = text.slice(at + PUBLIC.length).split('?')[0]
  if (!rest) return ''
  try {
    return decodeURIComponent(rest)
  } catch {
    // A path with a stray `%` in it cannot be a name the uploader wrote; leave it be.
    return ''
  }
}

/*
  Emptying a community of its record.

  This is the write an admin makes when a fellowship has filled up with years of attendance, receipts
  and testimonies and the space has to come back: rows and files both, because either half left behind
  is still taking room. The community itself is not part of it — the row, its members and its join code
  survive, so the same admin can carry on using the group after the clear-out. It is deliberately the
  only class in this folder that opens the storage bucket, and it is only ever built by God with the
  service key — a browser cannot reach it except through /api/admin, where the caller has already been
  shown to be the address that opened the community.

  Files go first. If the bucket refuses, nothing has been deleted and the admin is told so; if the
  rows had gone first, an unsuccessful remove would leave objects nobody can point at again.
*/
export class CommunityPurge {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  async deleteAll({ community_id }) {
    if (!community_id) throw new Error('community_id is required')

    const { data: planned, error: readError } = await this.client
      .from('functions')
      .select('id')
      .eq('community_id', community_id)
    if (readError) throw readError
    const functions = (planned || []).map((one) => one.id)

    const paths = await this.#attached(functions, community_id)
    const files = paths.length ? await this.#removeFiles(paths) : { removed: 0, refused: 0 }

    const rows = {}
    for (const one of TABLES) {
      rows[one.table] = await this.#clear(one, functions, community_id)
    }

    return { community_id, functions: functions.length, files, rows }
  }

  // Every object this community's rows point at, deduplicated and in bucket-path form.
  async #attached(functions, community_id) {
    const found = new Set()
    for (const one of FILES) {
      if (one.under === 'function' && !functions.length) continue
      const read =
        one.under === 'function'
          ? await this.client.from(one.table).select(one.column).in('function_id', functions)
          : await this.client.from(one.table).select(one.column).eq('community_id', community_id)
      if (read.error) throw read.error
      for (const row of read.data || []) {
        const path = bucketPath(row?.[one.column])
        if (path) found.add(path)
      }
    }
    return [...found]
  }

  /*
    The bucket answers per file, so a path that was already gone arrives as a line in the data
    rather than as a failed request. That file is not taking up room either way, so it counts as
    removed. What is refused and still exists is counted and said out loud, because an admin who
    came here to free space is owed the difference between "it is gone" and "the bucket said no".
  */
  async #removeFiles(paths) {
    const { data, error } = await this.client.storage.from(BUCKET).remove(paths)
    if (error) throw new Error(`the files could not be removed (${error.message})`)
    const each = data || []
    // A bucket that answers with no error and no per-file lines took everything it was given.
    if (!each.length) return { removed: paths.length, refused: 0 }
    const refused = each.filter(
      (one) => one?.error && !/not be found|not found/i.test(String(one.error)),
    )
    return { removed: each.length - refused.length, refused: refused.length }
  }

  // One table, one count. `exact` asks PostgREST to report how many rows the delete took, so the
  // answer is a number rather than every deleted row carried back across the network.
  async #clear(one, functions, community_id) {
    const scoped = one.under === 'function'
      ? this.client.from(one.table).delete({ count: 'exact' }).in('function_id', functions)
      : this.client.from(one.table).delete({ count: 'exact' }).eq('community_id', community_id)
    const { count, error } = await scoped
    if (error) throw new Error(`${one.table} could not be cleared (${error.message})`)
    return count ?? 0
  }
}
