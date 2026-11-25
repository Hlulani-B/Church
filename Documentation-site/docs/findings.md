# Findings

Audit of the data layer on 2026-11-13 at commit `f7b25be`, against the live Supabase
project. Every claim below was checked by running code, not by reading it. No writes
were made to the live database during the audit.

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| 1 | Attendance and testimony data is world-readable and world-writable | Critical | Enable RLS on both tables — **done, and it emptied `/admin-testimonies`** |
| 2 | `event` queries silently truncate at 1000 rows | Major | Add pagination |
| 3 | A check-in session cannot be opened | Major | Drop the `ended_at` not-null |
| 4 | A session with attendance rows cannot be deleted | Minor | Add an FK action |
| 5 | Service-role key was disclosed in plaintext | Major | Rotate it |
| 6 | Data-access classes are inconsistent about environment and guards | Minor | Shared client and guards |
| 7 | `/api/god` rejected every genuine Firebase id token | Critical | Parse only the two JSON segments |
| 8 | An admin screen could show another community's roster | Major | Tag every read with the community that answered |
| 9 | The four digits never reached the leader who opened the check-in | Major | Decide `mine` off the row, not off the object being built — **[Fixed]** |
| 10 | One button handed every feedback author's address to whoever downloaded the pile | Major | Name the rows at the read, and close the last fallbacks — **[Fixed]** |

Findings 1 to 6 are the 2026-11-13 data-layer audit. Findings 7 and 8 are the sign-in path
and the admin screens, both found on 2026-11-14; 7 is marked **[Fixed]** below. Finding 9 is
not from an audit at all — it was found on 2026-11-25 by the test that specifies it, which had
been failing quietly while the suite was read as a whole. Finding 10 came from the same day's
sweep, taken once the rule about addresses was written down as a rule for the whole app rather
than a rule for the page being looked at.

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

**Changed 2026-11-14.** `/admin-testimonies` reads that table from the browser itself, on
`VITE_SUPABASE_ANON_KEY` — the key this finding is about — rather than through the `/api`
functions.
So a visitor no longer has to write the request by hand: the app puts the key in their
bundle and makes the call for them. `event` is not read this way, because the attendance
page needs the names in `users`, and a browser on the anon key cannot see them.

**Measured again on 2026-11-14, and it is still open.** That key now answers 466 `testimony`
rows and 4650 `event` rows with no filter of any kind, while `users`, `community`,
`community_members` and `session` answer it with nothing at all — the four tables that were
protected still are. `src/page_functions/testimonies.js` runs on exactly this key, so the
export it writes is a browser read of a table anybody can read — and since the page gained an
add button, so is the write: an `insert` and a `delete` on `testimony` were both accepted by
this key while checking that button. It is also why the names in an
export cannot come from that read: a join to `users` on the anon key answers zero rows, so the
names are asked for separately through `admin` `roster` on `/api/leader`.

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

Five table classes covered the schema under `src/functions/` when this was written, next to
`admin_dashboard.js` and, since 2026-11-14, `attendance.js` for the reads that belong to a
screen rather than to a row. `testimony.js` is gone: the testimonies page reads that table
from the browser, so nothing on the server builds it any more. Three differences showed
up while testing them:

- `Event` reads `import.meta.env` only, so `new Event()` throws in
  `api/`; they need the url and key passed explicitly there. (`Testimony` did the same, and
  left with the class.)
- `User` has no primary-key guard, unlike the others. It is harmless, because
  `email=eq.undefined` matches no row, but it is the odd one out.
- They all repeat the same three-line constructor. Worth one shared client module
  now that there are seven.

## 7. `/api/god` rejected every genuine Firebase id token — **[Fixed]**

Found 2026-11-14. Every new sign-up failed with `401 that sign-in is not valid`, so no
browser could ever write its own `users` row.

**Cause.** The token parser in the old `api/god.js` monolith (since split into `api/self.js`,
`api/leader.js` and `api/admin.js`, its shared checks now in `lib/god.js`) destructured a `map`
over all three JWT
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

## 8. An admin screen could show another community's roster

Reported 2026-11-14 as "members from community A show in community B". The queries were
not at fault. Measured against the live project with the same `admin` `roster` call the
dashboard makes:

| Community | Links in `community_members` | Rows the roster returned | Addresses shared with the other community |
| --- | --- | --- | --- |
| Kopano Youth Fellowship `11111111-…` | 50 | 50 | 1 — your own address, which is admin of both |
| UBF `5eb210c3-…` | 16 | 16 | |

`roster` filters `.eq('community_id', …)`, `attendance.services` and `attendance.service`
filter it too, and the testimonies read does as well — A answers with `@example.com`
people and B with `@mock.kopano`, 19 gatherings against 66. Nothing on the server mixes
them.

**What did mix was the screen.** Each admin page held its last answer in React state with
no record of which community it was read for. Two `/admin-dashboard` history entries —
click A's card, then B's, then press the browser's back button — change the community
under a page that is still mounted, so B's heading sat over A's 50 rows until A's own read
happened to answer. The same thing happens whenever an earlier response lands last, which
is ordinary on a slow link: the page had no way to notice it was showing an answer to a
question it no longer asks. The roster, the community row, the gathering list, the opened
gathering and the testimonies page were all exposed.

`rememberAdmin` made a second one possible: filling the community name field by field could
put A's name on B's id when a link carried only an id, which is exactly the older history
entries written before the state grew a name.

**Fix.** An answer now carries the id it was read for, and a screen renders only an answer
whose tag matches the community on screen — `shown`, `rows`, `list`, `chosen`, `gathering`
and `page` are all derived that way in `src/admin/`. A mismatch shows the loading line,
never the wrong people. `adminState` no longer fills the name from a source that is
talking about another community, so a heading cannot borrow one, and the testimonies page
offset belongs to the community it was walked through instead of carrying over.

**Lesson, for the next read added here.** A page whose subject can change underneath it
must tag what it holds with that subject. Passing the id into the query is necessary and
not enough; the state on the other side of the promise needs it too.

## 9. The four digits never reached the leader who opened the check-in — **[Fixed]**

Found 2026-11-25 by `tests/session-manage.test.js`, which asserts that the person who opened a
session is sent their own PIN. The assertion had been red: `session.manage` answered `pin: null`
for every caller except an admin.

**Cause.** Two keys of one object literal, in `manage` in `src/functions/session.js`:

```js
return (data || []).map((one) => ({
  ...one,
  mine: one.created_by === email,
  pin: one.mine || admin ? one.pin : null,
}))
```

`one` is the row that came back from the table, and `mine` is a key of the object being built, not of
that row — an object literal cannot read a key it is still writing. So `one.mine` was `undefined` for
every caller and the ternary fell through to `null`: the dashboard's card never carried digits for the
person who opened it, only for an admin. The take-attendance page still showed them straight after the
create, because there the row arrives from the write itself rather than from `manage`, which is why
using the app did not notice. Back on the dashboard the card stood there with `mine: true` on it and
neither a PIN line nor a QR, because `src/components/attendance_control.jsx` renders both only
`if (one.pin)` — the honest reaction to a row that says nothing, and the reason nothing looked broken
in the way a crash would.

**Fix.** Decide `mine` once, off the row, in a block body, and let both keys read that local.

**Lesson, for the next field derived in a `map`.** A key built in an object literal is not on the
object yet, so a second key that depends on it is reading `undefined` and not the value you can see a
few lines above. Two derived keys that talk to each other want a local and a block body. And a red
test in a suite that mostly passes is a finding, not background noise: this one was specified, written
and left failing.

## 10. One button handed every feedback author's address to whoever downloaded the pile

**Found.** On 2026-11-25, once the rule about addresses had been written down — a person sees only
their *own* email address, and everybody else by name and surname — the whole app was swept for the
ones still breaking it. Nearly every page was already clean: what a reader sees in a heading or in
"Recorded against …" is their own address, and the roster, the register and the RSVP page all name
their people. Two things were not. `displayName` in `src/components/absence_for.jsx` fell back to a
person's address when their `users` row held no name, and that string is what the For-who picker
prints and what both attendance pages put into "Recorded for X". And the pile's export carried an
`email` column, so *Export Excel* and *Download PDF* wrote the sign-in of every person who had ever
left a note.

**Cause.** The rule had been enforced where a value is drawn and not where it is decided, so a
fallback written as keying advice — *a label the `users` read could not name comes back as the address
it was keyed on*, which is sound advice for a row that has to be keyed on something — became a leak the
moment a page printed that label as a name. The export was the same mistake with a longer fuse. Its
own comment argued the case: the address "belongs in a file somebody chose to download, not on a page
every signed-in stranger can scroll". That is a rule about screens and no rule at all about files, and
a file is the half that gets forwarded.

**Fix.** `displayName` answers a nameless row in words, and the For-who search matches names only —
which is what its own placeholder has always said it does. `Feedback.all` now reads `users` once over
the addresses on the page and returns `submitted_by`, keeping the bare address only where the note is
the caller's own, so the export column cannot print what the response never carried. `email` reaches
that method through `api/self.js`, which already writes the token's address into every browser
request, so no endpoint, no dispatcher and no table changed. Locked by `tests/feedback.test.js`.

**Lesson.** A rule about what is displayed is only a rule about the last mile. Wherever one read feeds
both a screen and a file, the check belongs at the read: a page can be rewritten, a tooltip can be
added, and tomorrow's export will happily carry whatever today's response shipped. Keeping the caller's
own address in the answer is the part that needs stating out loud, too — otherwise the honest reading of
"nobody sees an address" is a page that cannot tell a reader whose note is theirs.

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
