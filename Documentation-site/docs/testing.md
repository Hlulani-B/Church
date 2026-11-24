# Testing

The suite is small on purpose. It exists because a specific kind of bug kept happening on the
check-in path — a one-line change to a filter, or a `.eq('cancel', false)` that quietly dropped
legacy rows — and none of the existing probes would have caught it. Every test here locks down
an invariant that has already broken at least once in principle.

## Running

```bash
npm test           # one run
npm run test:watch # rerun on save
```

Vitest runs in the `node` environment (see `vitest.config.js`); there is no DOM, no jsdom, no
browser. The tests exercise pure functions and classes that talk to a chainable Supabase mock.

## What is under `tests/`

| File | Locks down |
| --- | --- |
| `pure-helpers.test.js` | `distanceInMetres` (haversine), `generatePin`, `pickOpenSession` (the window rule both the check-in and a scanned join go through), and `reading` for a device's coordinates |
| `session-live.test.js` | `Session.live(...)`: the `cancel` null-tolerance, the window filter, the already-marked pass, PIN exclusion, `near_required`, and the `leader_name` join |
| `session-create.test.js` | `Session.create(...)`: the overlap guard, its `cancel` filter, and the two different refusal messages for own-blocker vs. someone-else's |
| `session-manage.test.js` | `Session.manage(...)`: the `cancel` null-tolerance that keeps a called-off session off the leader/admin dashboard, its window bound, and which readers the PIN is released to |
| `church-functions.test.js` | `ChurchFunctions.create(...)`: `amount_matches_payment` mirrored — no amount against a free function, whatever was typed. `ChurchFunctions.list(...)`: the three tallies, and the one `in`-read per child table rather than one per function. `ChurchFunctions.details(...)`: both answers folded onto one line per person, an unknown address kept and named by its email, and a function from another fellowship refused before any name is read |

## What the tests actually assert

They do not run SQL. They assert on **the queries the code builds**, which is what a careless
edit changes.

Each `from(...)` chain on the mock records its filters, so a test reads like a specification:

```js
const [call] = mock.callsFor('session');
expect(call.or).toBe('cancel.eq.false,cancel.is.null');
expect(call.filters).toContainEqual({ kind: 'lte', col: 'started_at', val: expect.any(String) });
expect(call.filters).toContainEqual({ kind: 'gte', col: 'ended_at', val: expect.any(String) });
```

That is enough to catch the failure mode we've actually been afraid of: swapping `.or(...)` for
`.eq('cancel', false)` and letting a legacy row with `cancel = null` be treated as cancelled.
The change compiles, the app runs, one Sunday an entire community cannot see the check-in card.
This test fails on the first `npm test` after that edit.

## The mock

`tests/helpers/mock-supabase.js` exports one factory:

```js
makeSupabaseMock({ session, event, users, functions, function_attending, function_paid, insertReturns, singleAsRow })
```

It returns an object shaped like a `createClient()` result — `.from(table)` gives back a
chainable builder that records every `.eq / .or / .lte / .gte / .in / .select / .order /
.limit / .single / .maybeSingle / .insert / .update / .delete` call and, being **thenable**,
resolves to the preloaded rows for that table when awaited. `.insert(row)` echoes the row back
when `insertReturns` is set, which is what lets a happy-path create test read the row the code
thought it wrote.

`singleAsRow` is the one behavioural switch, and it is off by default. PostgREST answers a read that
ends in `.single()` or `.maybeSingle()` with one object rather than a one-row array, and a class that
reads a row by its id — `ChurchFunctions.details` does — needs that shape. Every test written against
rows a class iterates over keeps getting the whole table, because the default was left as the mock
always behaved rather than changed under the older suites.

Two accessors make the assertions readable:

```js
mock.calls             // every recorded call, in order, each with its .filters and its .or
mock.callsFor('event') // just the ones against a table, oldest first
```

??? info "Why not `supabase-js` with a fake HTTP layer?"
    Because the point of these tests is to see the filters the code chose to build. A network
    interception layer would let the mock return a canned array and the tests would assert on
    that array — a change that silently weakened the query would still pass. Recording the
    builder's calls means the assertion is on the *shape of the query*, which is the thing
    that has to hold.

## What is deliberately not tested

- **The React pages.** No component-level tests. Every page in `src/` reads through the same
  handful of `callGod(...)` wrappers, and those wrappers are thin. What has broken this month
  has been a filter or a rule inside `src/functions/`, which is exactly what these tests do
  cover.
- **Firebase auth in the browser.** Server-side token verification is covered indirectly by
  the endpoint whitelists, and the `/qr` signup path is a sequence of three SDK calls with no
  branching worth asserting on.
- **The Supabase database itself.** The tests never see Postgres; they only see the mock. Unique
  constraints (`event`, `session`, `join_id`) are documented in [Database](database.md) and
  were verified once by running against the live project; the app does not pretend to enforce
  them, and re-verifying them would need a real database.

## Adding a test

1. Under `tests/`, named `<area>.test.js`. The config picks up anything matching
   `tests/**/*.test.js`.
2. Import the class you're testing, and the mock factory:

   ```js
   import { makeSupabaseMock, sessionWith } from './helpers/mock-supabase.js';
   import { Session } from '../src/functions/session.js';
   ```

3. Build the mock with the rows the read should return, then use `sessionWith(mock)` (or the
   equivalent for your class) to construct the class and overwrite its `client` field with the
   mock. That is one line and no dependency injection in production code.
4. Assert on `mock.lastCall(...)`. If the code should have filtered, check the filter. If it
   should not have touched the table, check `mock.callsFor(...)` is empty.

## When the tests are wrong

Twice during development a test that looked correct turned out to encode an assumption the code
never made. The most instructive one:

!!! example "The haversine NaN mistake"
    An early test asserted `distanceInMetres({ lat: 200, ... })` returns `NaN`. That is what
    plain `Math.asin(sqrt(h))` would do — but the implementation clamps its argument
    (`Math.asin(Math.min(1, Math.sqrt(h)))`), which means every finite input yields a finite
    output in `[0, πR]`. `NaN` only propagates from a `NaN` input, and the caller (`api/self.js`)
    is the one that range-checks coordinates before they get here. The test was rewritten to
    state the actual invariant: bounded and finite for any finite input.

If a test starts failing after a change that is otherwise obviously correct, the first question
is whether the test was locking down a bug. The second is whether the change moved the guard
somewhere else — a filter that disappears from `Session.live` and reappears in the caller is
still a filter, but the test's assertion has to follow it.
