import { describe, expect, it } from 'vitest'
import { bucketPath, CommunityPurge } from '../src/functions/community_purge.js'

/*
  Emptying one community is the only write in this app that cannot be undone, so the three things it
  must never get wrong are testable here: which rows it takes (exactly this community's, children
  before the parents that cascade to them), which rows it must leave (the community and its members —
  this is a clearing of space, not a leaving) and which files it takes (only the objects its own rows
  pointed at, removed before any row goes, so a bucket that refuses leaves the community standing).
*/

// A client that records every chain in the order it was run, reads from `rows`, and answers a
// delete with the number of seeded rows for that table so the counts a page reports are honest.
function fakeClient({ rows = {}, remove = null, failOn = null } = {}) {
  const events = []
  const reads = []
  const deletes = []
  const buckets = []

  const builder = (table) => {
    const state = { table, select: null, delete: null, filters: [] }
    const chain = {
      select(column) {
        state.select = column
        return chain
      },
      delete(options) {
        state.delete = options || true
        return chain
      },
      eq(col, val) {
        state.filters.push({ kind: 'eq', col, val })
        return chain
      },
      in(col, vals) {
        state.filters.push({ kind: 'in', col, vals })
        return chain
      },
      then(resolve) {
        events.push(state.delete ? `delete:${table}` : `read:${table}`)
        if (state.delete) {
          // One table refusing is the failure that matters here: the run has to stop and name it.
          if (failOn === table) {
            return Promise.resolve({ count: 0, error: { message: 'foreign key keeps the rows' } }).then(resolve)
          }
          const seeded = rows[table] || []
          deletes.push({ ...state, count: seeded.length })
          return Promise.resolve({ count: seeded.length, error: null }).then(resolve)
        }
        reads.push({ ...state })
        return Promise.resolve({ data: rows[table] || [], error: null }).then(resolve)
      },
    }
    return chain
  }

  return {
    events,
    reads,
    deletes,
    buckets,
    callsFor: (table) => reads.filter((one) => one.table === table),
    deleted: () => deletes.map((one) => one.table),
    from: (table) => builder(table),
    storage: {
      from(bucket) {
        return {
          remove(paths) {
            events.push('files')
            buckets.push({ bucket, paths })
            return Promise.resolve(
              typeof remove === 'function' ? remove(paths) : remove || { data: [], error: null },
            )
          },
        }
      },
    },
  }
}

async function purgeWith(client) {
  const purge = new CommunityPurge('http://example.invalid', 'fake-key')
  purge.client = client
  return purge
}

const URL = 'https://example.supabase.co/storage/v1/object/public/kopano/'
const ENCODED = 'https://example.supabase.co/storage/v1/object/public/kopano/functions/ana%40x.co/9/'

describe('bucketPath — which stored values are ours to delete', () => {
  it('takes the path out of a public url from this bucket', () => {
    expect(bucketPath(`${URL}functions/ana@x.co/9/receipt.png`)).toBe('functions/ana@x.co/9/receipt.png')
  })

  it('drops the signature a signed url carries after the path', () => {
    expect(bucketPath(`${URL}testimonies/ana@x.co/2026-11-01/a.pdf?token=abc`)).toBe(
      'testimonies/ana@x.co/2026-11-01/a.pdf',
    )
  })

  it('decodes the escapes an upload path is stored with', () => {
    expect(bucketPath(`${ENCODED}note%20one.jpg`)).toBe('functions/ana@x.co/9/note one.jpg')
  })

  it('says nothing is there for a bucket that is not this one, a stray percent and plain words', () => {
    expect(bucketPath('https://example.supabase.co/storage/v1/object/public/other/a.png')).toBe('')
    expect(bucketPath(`${URL}made%2z-up.png`)).toBe('')
    expect(bucketPath('The Lord is my shepherd, I shall not want.')).toBe('')
    expect(bucketPath(null)).toBe('')
    expect(bucketPath(undefined)).toBe('')
  })
})

describe('CommunityPurge.deleteAll — the order the rows go back out', () => {
  it('refuses to guess a community', async () => {
    const client = fakeClient()
    const purge = await purgeWith(client)
    await expect(purge.deleteAll({})).rejects.toThrow('community_id is required')
    expect(client.events).toEqual([])
  })

  it('clears the tables under a function by function id and everything else by community id', async () => {
    const client = fakeClient({
      rows: {
        functions: [{ id: 9 }, { id: 11 }],
        function_attending: [{}, {}, {}],
        testimony: [{}],
        community: [{}],
        community_members: [{}, {}],
      },
    })
    const purge = await purgeWith(client)
    const answer = await purge.deleteAll({ community_id: 4 })

    const taken = client.deleted()
    // The four function-keyed tables before `functions` itself: those rows are what it cascades to,
    // and a cascade deletes them without ever being asked, which would leave their counts at nil.
    expect(taken.slice(0, 4)).toEqual([
      'function_attending',
      'function_paid',
      'extra_function_attending',
      'extra_function_paid',
    ])
    expect(taken.indexOf('functions')).toBe(4)
    expect(taken[taken.length - 1]).toBe('testimony')

    const byId = Object.fromEntries(client.deletes.map((one) => [one.table, one.filters]))
    expect(byId.function_attending).toEqual([{ kind: 'in', col: 'function_id', vals: [9, 11] }])
    expect(byId.functions).toEqual([{ kind: 'eq', col: 'community_id', val: 4 }])
    expect(byId.testimony).toEqual([{ kind: 'eq', col: 'community_id', val: 4 }])

    expect(answer.community_id).toBe(4)
    expect(answer.functions).toBe(2)
    expect(answer.rows.function_attending).toBe(3)
    expect(answer.rows.testimony).toBe(1)
    expect(answer.rows.event).toBe(0)
  })

  it('asks PostgREST for a count rather than the deleted rows', async () => {
    const client = fakeClient({ rows: { functions: [{ id: 9 }] } })
    const purge = await purgeWith(client)
    await purge.deleteAll({ community_id: 4 })
    expect(client.deletes.every((one) => one.delete?.count === 'exact')).toBe(true)
  })

  it('leaves the community, its members, the people and the feedback pile where they are', async () => {
    const client = fakeClient({ rows: { functions: [{ id: 9 }] } })
    const purge = await purgeWith(client)
    await purge.deleteAll({ community_id: 4 })
    // Freeing space is not leaving: whoever cleared the fellowship still administers it.
    expect(client.deleted()).not.toContain('community')
    expect(client.deleted()).not.toContain('community_members')
    expect(client.deleted()).not.toContain('users')
    expect(client.deleted()).not.toContain('feedback')
  })
})

describe('CommunityPurge.deleteAll — the files those rows pointed at', () => {
  it('reads them before anything is deleted, hands the bucket one path per object, and only ours', async () => {
    const client = fakeClient({
      rows: {
        functions: [{ id: 9 }],
        function_paid: [
          { proof_path: `${URL}functions/ana@x.co/9/a.png` },
          { proof_path: `${URL}functions/ana@x.co/9/a.png` },
          { proof_path: 'https://drive.example/not-ours.png' },
          { proof_path: null },
        ],
        testimony: [{ body: `${URL}testimonies/ana@x.co/b.pdf` }],
        extra_testimony: [{ body: 'a testimony that was typed, not photographed' }],
      },
      remove: (paths) => ({ data: paths.map((one) => ({ path: one })), error: null }),
    })
    const purge = await purgeWith(client)
    const answer = await purge.deleteAll({ community_id: 4 })

    expect(client.buckets).toHaveLength(1)
    expect(client.buckets[0].bucket).toBe('kopano')
    expect(client.buckets[0].paths).toEqual([
      'functions/ana@x.co/9/a.png',
      'testimonies/ana@x.co/b.pdf',
    ])
    expect(client.events.indexOf('files')).toBeLessThan(
      client.events.findIndex((one) => one.startsWith('delete:')),
    )
    expect(answer.files).toEqual({ removed: 2, refused: 0 })
  })

  it('deletes no row at all when the bucket refuses the request, and says the files are why', async () => {
    const client = fakeClient({
      rows: {
        functions: [{ id: 9 }],
        function_paid: [{ proof_path: `${URL}functions/ana@x.co/9/a.png` }],
      },
      remove: () => ({ error: { message: 'invalid permissions' } }),
    })
    const purge = await purgeWith(client)
    await expect(purge.deleteAll({ community_id: 4 })).rejects.toThrow(
      'the files could not be removed (invalid permissions)',
    )
    expect(client.deleted()).toEqual([])
  })

  it('counts a file the bucket has never heard of as gone and a real refusal as refused', async () => {
    const client = fakeClient({
      rows: {
        functions: [{ id: 9 }],
        testimony: [
          { body: `${URL}testimonies/ana@x.co/gone.pdf` },
          { body: `${URL}testimonies/ana@x.co/stuck.pdf` },
        ],
      },
      remove: (paths) => ({
        data: paths.map((one) =>
          one.includes('stuck') ? { path: one, error: 'The file could not be deleted' } : { path: one },
        ),
        error: null,
      }),
    })
    const purge = await purgeWith(client)
    const answer = await purge.deleteAll({ community_id: 4 })
    expect(answer.files).toEqual({ removed: 1, refused: 1 })
  })

  it('takes an empty answer from the bucket as everything having gone', async () => {
    const client = fakeClient({
      rows: { functions: [{ id: 9 }], testimony: [{ body: `${URL}testimonies/ana@x.co/a.pdf` }] },
      remove: () => ({ data: [], error: null }),
    })
    const purge = await purgeWith(client)
    const answer = await purge.deleteAll({ community_id: 4 })
    expect(answer.files).toEqual({ removed: 1, refused: 0 })
  })

  it('does not ask the bucket for a community that held no functions and no files', async () => {
    const client = fakeClient({ rows: {} })
    const purge = await purgeWith(client)
    const answer = await purge.deleteAll({ community_id: 4 })
    expect(client.buckets).toEqual([])
    expect(client.callsFor('function_paid')).toEqual([])
    expect(answer.files).toEqual({ removed: 0, refused: 0 })
  })

  it('names the table that would not clear, because a half-empty community has to say where it stopped', async () => {
    const client = fakeClient({ rows: { functions: [{ id: 9 }] }, failOn: 'extra_servings' })
    const purge = await purgeWith(client)
    await expect(purge.deleteAll({ community_id: 4 })).rejects.toThrow(
      'extra_servings could not be cleared (foreign key keeps the rows)',
    )
    // It stops where it failed rather than carrying on and calling the rest of it a success: the
    // tables under `extra_servings` were never asked.
    expect(client.deleted()).toEqual([
      'function_attending',
      'function_paid',
      'extra_function_attending',
      'extra_function_paid',
      'functions',
      'extra_event',
    ])
  })
})
