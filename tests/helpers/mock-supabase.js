/*
  A chainable stand-in for the Supabase client the Session class talks to. Every builder method
  records what it was called with on the same `state` object, and awaiting the builder resolves
  to whatever canned data this mock was given for the table under query. The point is not to
  re-implement PostgREST; it is to (a) hand back rows the class-under-test will filter, and
  (b) let a test assert on the exact filter chain that was built — which is how we lock the
  `cancel.eq.false,cancel.is.null` and the `lte(started_at)`/`gte(ended_at)` window invariants
  that a careless `.eq('cancel', false)` would break.
*/
export function makeSupabaseMock({
  session = [],
  event = [],
  users = [],
  functions = [],
  function_attending = [],
  function_paid = [],
  feedback = [],
  testimony = [],
  community = [],
  community_members = [],
  insertReturns = null,
  singleAsRow = false,
} = {}) {
  const calls = []

  function builder(table) {
    const state = {
      table,
      select: null,
      filters: [],
      or: null,
      order: null,
      orders: [],
      limit: null,
      range: null,
      insert: null,
      upsert: null,
      onConflict: null,
      update: null,
      delete: false,
      single: false,
      maybeSingle: false,
    }
    const b = {
      select(cols) { state.select = cols; return b },
      insert(row) { state.insert = row; return b },
      /*
        `upsert` is the write the member's answer uses, and the conflict target is half of what makes
        it an edit rather than a second row — so it is recorded on its own, where a test can insist on
        the pair the tables are actually keyed on.
      */
      upsert(row, options) {
        state.upsert = row
        state.onConflict = options?.onConflict ?? null
        return b
      },
      update(patch) { state.update = patch; return b },
      delete() { state.delete = true; return b },
      eq(col, val) { state.filters.push({ kind: 'eq', col, val }); return b },
      neq(col, val) { state.filters.push({ kind: 'neq', col, val }); return b },
      or(expr) { state.or = expr; return b },
      lte(col, val) { state.filters.push({ kind: 'lte', col, val }); return b },
      gte(col, val) { state.filters.push({ kind: 'gte', col, val }); return b },
      lt(col, val) { state.filters.push({ kind: 'lt', col, val }); return b },
      gt(col, val) { state.filters.push({ kind: 'gt', col, val }); return b },
      in(col, vals) { state.filters.push({ kind: 'in', col, vals }); return b },
      // `order` stays the last one asked for, which is what the older tests read; `orders` keeps the
      // whole sequence, for a read whose second ordering matters as much as its first.
      order(col, opts) {
        state.order = { col, opts }
        state.orders.push({ col, opts })
        return b
      },
      limit(n) { state.limit = n; return b },
      /*
        PostgREST's window, written as the pair offset and to rather than offset and count. A read that
        walks a table page by page only means something if the stand-in answers the window, so a test can
        seed three pages and watch the walk stop when one comes back short.
      */
      range(from, to) { state.range = [from, to]; return b },
      single() { state.single = true; return b },
      maybeSingle() { state.maybeSingle = true; return b },
      // The real Supabase PostgrestBuilder is awaited directly (thenable) — so we mirror that.
      then(resolve, reject) {
        calls.push(state)
        return Promise.resolve(pick(table, state)).then(resolve, reject)
      },
    }
    return b
  }

  function pick(table, state) {
    // An insert or an upsert echoes back a caller-supplied row (matching `.insert().select().single()`
    // against PostgREST, which returns the row the DB actually stored, defaults and generated
    // ids included). Without `insertReturns`, the mock falls back to echoing the payload.
    if (state.insert || state.upsert) {
      const echo = insertReturns || state.insert || state.upsert
      return { data: state.single ? echo : [echo], error: null }
    }
    if (state.update) {
      return { data: state.update, error: null }
    }
    if (state.delete) {
      return { data: null, error: null }
    }
    const rows =
      table === 'session'
        ? session
        : table === 'event'
          ? event
          : table === 'users'
            ? users
            : table === 'functions'
              ? functions
              : table === 'function_attending'
                ? function_attending
                : table === 'function_paid'
                  ? function_paid
                  : table === 'feedback'
                    ? feedback
                    : table === 'testimony'
                      ? testimony
                      : table === 'community'
                        ? community
                        : table === 'community_members'
                          ? community_members
                          : []
    // A windowed read gets its slice of the seeded table; nothing else changes which rows are held.
    const windowed = state.range ? rows.slice(state.range[0], state.range[1] + 1) : rows
    /*
      PostgREST's filtered aggregate, which is how the register's three tallies are made: an embed
      named in the select string (`going:function_attending(count)`) and the rows it counts named by a
      filter on that same alias (`going.attending`). Counting them here, rather than handing the child
      rows back for the class to add up, is what lets a test seed answers and still assert on the
      numbers — so a rewrite that counts the wrong column, or drops a function whose tally is nought,
      fails here instead of returning a list that merely looks right.
    */
    const tallies = [...String(state.select || '').matchAll(/(\w+):(function_attending|function_paid)\(count\)/g)]
    if (tallies.length) {
      const under = { function_attending, function_paid }
      return {
        data: windowed.map((parent) => {
          const counted = {}
          for (const [, alias, child] of tallies) {
            const gates = state.filters.filter((one) => one.col.startsWith(`${alias}.`))
            counted[alias] = [
              {
                count: under[child].filter(
                  (one) =>
                    one.function_id === parent.id &&
                    gates.every((gate) => one[gate.col.slice(alias.length + 1)] === gate.val),
                ).length,
              },
            ]
          }
          return { ...parent, ...counted }
        }),
        error: null,
      }
    }
    /*
      PostgREST hands back one object rather than a one-row array when a read ends in .single() or
      .maybeSingle(), and a class that reads a row by its id expects that shape. `singleAsRow` gives
      it; the default is left as this mock has always behaved — handing the whole table back — so the
      tests written against rows a class iterates over keep reading what they always read. A mock that
      turns it on has to hold only the rows the read is meant to find, because nothing here filters.
    */
    if (singleAsRow && (state.single || state.maybeSingle)) {
      return { data: windowed[0] ?? null, error: null }
    }
    return { data: windowed, error: null }
  }

  return {
    from: (table) => builder(table),
    // Test hooks: read the recorded chain back to assert on the filters that were built.
    calls,
    lastCall: () => calls[calls.length - 1],
    callsFor: (table) => calls.filter((one) => one.table === table),
  }
}

// Session's constructor calls `createClient(url, key)`; that returns an object we do not need
// to talk to because every test overwrites `#client` immediately after with the mock.
export function sessionWith(mock) {
  // Import lazily so a test file that only imports helpers does not need env vars set.
  return import('../../src/functions/session.js').then(({ Session }) => {
    const instance = new Session('http://example.invalid', 'fake-key')
    instance.client = mock
    return instance
  })
}

// The same trick for the functions class, which is built the way Session is and talks to three
// tables instead of one.
export function churchFunctionWith(mock) {
  return import('../../src/functions/church_functions.js').then(({ ChurchFunctions }) => {
    const instance = new ChurchFunctions('http://example.invalid', 'fake-key')
    instance.client = mock
    return instance
  })
}

/*
  And for the feedback pile, which reads two tables for the same reason the register does: the rows
  carry an address and the names live in `users`, so a test that cares about which of the two a reader
  is handed has to be able to seed both.
*/
export function feedbackWith(mock) {
  return import('../../src/functions/feedback.js').then(({ Feedback }) => {
    const instance = new Feedback('http://example.invalid', 'fake-key')
    instance.client = mock
    return instance
  })
}
