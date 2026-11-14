# Findings

Audit of the data layer on 2026-11-13 at commit `f7b25be`, against the live Supabase
project. Every claim below was checked by running code, not by reading it. No writes
were made to the live database during the audit.

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | Attendance and testimony data is world-readable and world-writable | Critical | Enable RLS on both tables |
| 2 | `event` queries silently truncate at 1000 rows | Major | Add pagination |
| 3 | A check-in session cannot be opened | Major | Drop the `ended_at` not-null |
| 4 | A session with attendance rows cannot be deleted | Minor | Add an FK action |
| 5 | Service-role key was disclosed in plaintext | Major | Rotate it |
| 6 | Data-access classes are inconsistent about environment and guards | Minor | Shared client and guards |
| 7 | `/api/god` rejected every genuine Firebase id token | Critical | Parse only the two JSON segments |

Findings 1 to 6 are the 2026-11-13 data-layer audit. Finding 7 is the sign-in path and
was found on 2026-11-14; it is marked **[Fixed]** below.

## 1. Attendance and testimony data is world-readable and world-writable

`event` and `testimony` are the two tables where row level security was left off
(see [Database](database.md)). The anon key is not a secret: Vite inlines
`VITE_SUPABASE_ANON_KEY` into the browser bundle, which the dev server confirms —
the served copy of `src/functions/user.js` begins with the values substituted in.

Measured with only that key, from a plain `fetch`-equivalent client:

| Table | Rows returned to the anon key |
| --- | --- |
| `users` | 0 |
| `community` | 0 |
| `community_members` | 0 |
| `session` | 0 |
| `event` | **1000** |
| `testimony` | **242** |

So any visitor can read every attendance record and every testimony, and can also
insert, update and delete them, because nothing on those tables checks who is asking.
The four tables with RLS enabled correctly returned nothing.

**Fix.** Enabling RLS with zero policies closes the hole immediately, which is exactly
the behaviour the four protected tables showed above:

```sql
alter table event enable row level security;
alter table testimony enable row level security;
```

Do that first, then decide where permissions are enforced. Note the constraint in
[Authentication](authentication.md): a Firebase identity is invisible to Supabase
row level security, so per-user policies are not available to you today unless the
requests carry a Supabase session token.

## 2. `event` queries silently truncate at 1000 rows

`Event.all()` returned exactly 1000 rows. That is PostgREST's default limit, not the
size of the table, so the real total is unknown from the client and the first page is
indistinguishable from the whole set. Filtering to one community and one date returned
50 rows, so the leader dashboards are safe today but not for long.

**Fix.** Give `all()` a `.range(from, to)` and require a date or community filter on
dashboard queries.

## 3. A check-in session cannot be opened

The schema declares `ended_at timestamptz not null` with no default, while
`started_at` does have one. A leader opening a session has no end time to give, so
every insert must invent one. `Session.create()` therefore requires an `ended_at`
argument, which is backwards for the flow the table is meant to support.

**Fix.**

```sql
alter table session alter column ended_at drop not null;
```

Then set it when the session is closed: `session.update(session_id, { ended_at })`.

## 4. A session with attendance rows cannot be deleted

`event.session_id` references `session(session_id)` with no `on delete` clause, so
deleting a session that already recorded attendance fails on the foreign key. Compare
`community_id` on the same table, which cascades.

**Fix.** Choose deliberately: `on delete set null` keeps the attendance history and
detaches it from the removed session.

## 5. Service-role key was disclosed in plaintext

A `sb_secret_` key was pasted into a chat session. It bypasses row level security
completely, so treat it as compromised and rotate it in the Supabase dashboard. It is
stored only in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`, which is git-ignored, and
it was verified absent from `dist/`. The `VITE_` prefix publishes a value to the
browser, so a service-role key must never use it.

## 6. Data-access class inconsistencies

Six classes now cover the schema, all under `src/functions/`. Three differences showed
up while testing them:

- `Event` and `Testimony` read `import.meta.env` only, so `new Event()` throws in
  `api/`; they need the url and key passed explicitly there.
- `User` has no primary-key guard, unlike the other five. It is harmless, because
  `email=eq.undefined` matches no row, but it is the odd one out.
- All six repeat the same three-line constructor. Worth one shared client module
  now that there are six.

## 7. `/api/god` rejected every genuine Firebase id token — **[Fixed]**

Found 2026-11-14. Every new sign-up failed with `401 that sign-in is not valid`, so no
browser could ever write its own `users` row.

**Cause.** The token parser in `api/god.js` destructured a `map` over all three JWT
segments:

```js
const [header, payload] = parts.map((part) => JSON.parse(...))
```

Destructuring keeps two values, but `map` has already called the function on all three.
The third segment is a 342-byte RSA signature, so `JSON.parse` threw on every request —
even a perfectly valid one. A JWT is `header.payload.signature` where only the first two
parts are JSON, and the signature is not even valid UTF-8.

**What hid it.** That throw landed in `catch { return null }`, which collapsed eight
different failures into the one message the client showed, and logged nothing. The
message pointed at the user's sign-in, so the first hours of investigation went to the
environment variables, the Firebase project id and Google's signing certificates — all
three of which measured clean:

| Checked | Result |
| --- | --- |
| `FIREBASE_PROJECT_ID`, `GOD_SERVER_KEY`, Supabase keys in the dev runtime | all set |
| `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` | HTTP 200, two `kid`s, both import as RSA keys, valid to 2027 |
| Server clock against the browser | agreed to the second |

Only a dump of the rejected value settled it: `length 932`, segments `[102, 486, 342]`,
the first decoding to `{"alg":"RS256","kid":"81805e76…` and the second to
`{"iss":"https://securetoken.google.com/k…`. A valid token, rejected while trying to read
its own signature.

**Fix.** Parse the two segments that are JSON:

```js
const [header, payload] = parts.slice(0, 2).map((part) => JSON.parse(...))
```

`verifiedEmail()` now returns `{ email, reason }` instead of `null`, each rejection
reason is named (wrong issuer, wrong audience, expired token, unknown `kid`, bad
signature, anonymous sign-in), the reason is logged server-side, and it is returned to
the browser **only when `VERCEL_ENV` is not `production`**. Verified with synthetic
tokens: correct claims plus a forged signature now reaches
`reason: "token signature does not verify"`, and a wrong project reports
`token was signed in for '…some-other-project', not project 'kopano-a0554'`.

**Two things this invalidates.** First, every sentence in
[Authentication](authentication.md) that described the sign-up round trip was written
against an endpoint that had never once accepted a browser — treat that flow as
untested until it is walked in a browser. Second, `users` rows created through `/api/god`
cannot exist from before this fix, so any expectation about signup-populated data is
wrong.

**General lesson.** `const [a, b] = array.map(fn)` runs `fn` over the whole array. If
`fn` throws on the tail, destructuring does not save you. Use `array.slice(0, 2).map(fn)`,
and never collapse a validation function's failure modes into a bare `catch { return null }`.

## How this was tested

Read-only queries against the live project, plus 29 requests against a local mock
PostgREST server that exercised full CRUD on all six tables, eight guard paths that
must not reach the network, and the fail-fast behaviour when credentials are absent.

```bash
npm run lint            # oxlint
npm run build           # vite build
npm run dev             # serves on [::1]:5199, use http://localhost:5199
cd Documentation-site && .venv/bin/mkdocs build --strict
```

Type checks and the mock suite verify code correctness, not that the deployed
dashboard behaves. Those still need checking in a browser once the UI exists.
