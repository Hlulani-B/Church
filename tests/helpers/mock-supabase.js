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
      limit: null,
      insert: null,
      update: null,
      delete: false,
      single: false,
      maybeSingle: false,
    }
    const b = {
      select(cols) { state.select = cols; return b },
      insert(row) { state.insert = row; return b },
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
      order(col, opts) { state.order = { col, opts }; return b },
      limit(n) { state.limit = n; return b },
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
    // An insert echoes back a caller-supplied row (matching `.insert().select().single()`
    // against PostgREST, which returns the row the DB actually stored, defaults and generated
    // ids included). Without `insertReturns`, the mock falls back to echoing the payload.
    if (state.insert) {
      const echo = insertReturns || state.insert
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
                  : []
    /*
      PostgREST hands back one object rather than a one-row array when a read ends in .single() or
      .maybeSingle(), and a class that reads a row by its id expects that shape. `singleAsRow` gives
      it; the default is left as this mock has always behaved — handing the whole table back — so the
      tests written against rows a class iterates over keep reading what they always read.
    */
    if (singleAsRow && (state.single || state.maybeSingle)) {
      return { data: rows[0] ?? null, error: null }
    }
    return { data: rows, error: null }
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
