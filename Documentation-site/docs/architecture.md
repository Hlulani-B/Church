# Architecture

Everything the app knows about people lives in one Postgres database on Supabase,
and Firebase Authentication is the only login. Between the React page and that
database there are two paths:

    page ──> src/page_functions/<area>.js ──┬──> POST /api/god ──> Supabase   (the service key is here)
                                            │
                                            └──> Supabase directly            (the testimonies file only)

## Path 1 — through the function

Most pages do not talk to Supabase at all. They call `callGod(action, params)` in
`src/page_functions/god.js`, which POSTs to `api/god.js` with the Firebase ID token
of whoever is signed in as the bearer value. That function is the only place in the
codebase that reads `SUPABASE_SERVICE_ROLE_KEY`, so the key that can see every table
never reaches a browser: the built bundle under `dist/` was checked for it and does
not contain it.

`api/god.js` answers in a fixed order:

1. `POST` only.
2. The bearer is either the deployment's own `GOD_SERVER_KEY`, or a Firebase ID token
   whose signature, issuing project, audience, subject and expiry are verified against
   Google's signing keys. A caller cannot pick the address it asks about: the email
   comes out of the verified token and overwrites whatever the body claimed.
3. Without the server key, only what is listed in `SELF_ACTIONS` is answered — the
   caller's own `user` row, the communities it belongs to, opening a community, joining
   an empty one, leaving one, the roster, the join code, role assignment, attendance, and
   one attendance write: recording that the caller is not attending.
   `params.function` is then matched against the real method name on the class that was
   picked, so a name that is not on that class is a 400 before it reaches the database.
4. Anything that speaks about other people — `admin` `roster`, `admin` `changeCode`,
   `admin` `assign`, `attendance` `services` and `service`, `community` `find`,
   `member` `remove` — additionally requires a `community_id` in the request and a link
   for the caller in that community, read from `community_members` off the token's
   address rather than off the body. That link is then settled on one of two answers,
   because reading about people and changing them are different permissions:

   | Request | Link needed |
   | --- | --- |
   | `admin` `roster`, `attendance` `services` and `service` | `leader` or `admin` of that community |
   | `admin` `changeCode`, `admin` `assign`, `member` `remove`, `community` `find` | `admin` of that community |

   The roster is what the leader role exists to read, so it is settled on the leader tier
   first: `admin` `roster` would otherwise match the admin test too, and a leader would be
   refused the one read that is the whole point of the role. `community` `find` sits on the
   admin tier only because the row it returns carries `join_id` — the code people type to
   find the community is an admin's to see, so no leader page asks for it.
5. `event` `record` — the not-attending notice — is checked on its own, because it is about
   the caller rather than about anybody else, and so a member of any role may make it. Four
   things are decided there and none of them is left to the request: the address the row names
   is the token's, the answer is always `false`, a reason is optional and handwritten — whoever
   gives notice words it as they please, an empty box is sent as `null`, and the function no
   longer matches the wording against a list — and
   only those six columns are passed on — a body that also carries
   `recorded_by`, a `session_id` or a latitude has those dropped before the insert. Then one
   refusal: the row for that person, that day, that gathering is read first, and if it already
   says present the write is refused. A yes is a fact about a day that has gone by; letting it
   be talked back into a no would make the record say whoever edited the list rather than who
   was in the room.

`api/health.js` is the only other endpoint, and it reads nothing.

## Path 2 — the page that reads Supabase itself

`src/page_functions/testimonies.js` makes its own client with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, the browser key that is also inlined into the bundle. Two screens
run on it — `/admin-testimonies` and `/leader-testimonies` — and they are the one place in
the app where a browser talks to the database itself: the
paginated list, the search by date and name, the Excel and PDF exports, and the insert when a
member saves a testimony. Its own reads of who is who — the names on the rows and the
matching of a typed name — go through the function, on the `admin` `roster` action.

The reason it is this way is the shape of the work. That page fetches a hundred
testimonies at a time, then another hundred as you scroll, and searches by date and by name
— a page load that has to wait for a cold function start before the first row appears feels
broken, and each round trip also spends against the plan's request quota. The exports
need every matching row in the browser anyway, because the `.xlsx` and `.pdf` writers
in `src/page_functions/testimony_files.js` assemble the file there, from bytes, with no
library and no server step. One page, one connection — the cost is that its guards are
in two different places.

So the split today is:

| Page | Path |
| --- | --- |
| Login, create account, forgot password | Firebase, `src/functions/auth.js`, no database |
| Profile, menu, community | `/api/god` |
| Admin dashboard — roster, roles, code, leaving, opening a community | `/api/god` |
| Admin attendance — gatherings and who was at one | `/api/god` |
| Admin testimonies — list, search, save, export | direct Supabase, plus `/api/god` for names |
| Leader dashboard — the people of the community, read only | `/api/god` `admin` `roster` |
| Leader attendance, leader testimonies | the same two paths the admin pages take |
| Member dashboard | placeholder that reads nothing yet |

The leader pages are the admin ones with nothing to click: the roster arrives without the
⋮ menu that changes a role or takes somebody out, and no leader page asks the function for
the community row, so the join code is never fetched into a leader's browser. What a leader
cannot do is not hidden on the page — it is refused by the function, and the table above is
the list of which tier answers what. The admin dashboard does hide one thing: the row that
holds the signed-in address carries no menu, because that page is not how an admin hands
their own role on or leaves.

## The one place the read disagrees with the table

`services` and `service` in `src/functions/attendance.js` compare each gathering's day with
today. A row that answers present for a day that has not come is read as nothing taken yet:
the list shows no present for that gathering and the page says *Not yet* beside each name,
because a register for a Sunday three weeks away has not been called. An apology for that
same future gathering is still a no with its reason — somebody really sent it — and nothing is
rewritten: the yeses stay in `event` exactly as they were seeded, and only this read declines
to show them. Both attendance pages go through this one class, so the rule is stated once.

What the read does not do is make the notice overwrite such a row. `event` `record` still
refuses a person who already has a yes, future or not — *a yes is never taken back* — so an
apology for a seeded future gathering is refused while the same gathering shows *Not yet*.

## What is enforced today

Asked of the live project on 2026-11-14, this is what actually refuses a request. The
counts and error codes below came from running the requests, not from reading the schema
file; where a guard is in the request handler rather than the database, that is said
instead.

- **Row level security is on** for `users`, `community`, `community_members` and
  `session`. Reading each of them with the browser key returns **0 rows** while the same
  query with the service key returns 67, 2, 66 and 10.
- **A member has one attendance row per event.** `event` is unique on
  `(community_id, event_date, event_name, user_email)`; a second insert with those four
  values is refused with `23505`. A check-in can be sent as many times as the network
  likes — the first one writes, the rest are refused — and this holds even with RLS off,
  because a unique constraint is not a policy.
- **A PIN is one session per community per day.** `session` is unique on
  `(community_id, date, pin)`; the same probe returned `23505`.
- **`join_id` is unique**: two communities cannot hold the same code, which is what
  makes the collision test in `AdminDashboard.changeCode` trustworthy rather than a
  courtesy. A second insert with a code already taken came back `23505`.
- **A role is one of three words**, checked by a `check` constraint in the table: an insert with
  `role` `president` came back `23514` with nothing written. The reason column carried the same
  kind of check — a `reason` of `Nope` came back `23514` too, and `Sick` was accepted — and that
  one is on its way out, because a notice is now written in the member's own words. See *What is
  not enforced yet* for the one statement that takes it off the live table.
- **A leader reads the people and the attendance; only an admin changes anything.** Asked
  today of the live function with a real Firebase ID token: one address that `leader`s one
  throwaway community and `admin`s another was answered `200` for `roster` and
  `services` in both, and `403` for `changeCode`, `assign`, `member` `remove` and
  `community` `find` in the one it leads — with that community's `join_id` and the target's
  role re-read from the table afterwards, both unchanged. The same six requests from the
  community it administers all came back `200`, which is what shows the refusals answer the
  role rather than the shape of the request. A third check put the same address in as a
  plain `member`: `roster` and `services` then both refused, so the leader tier did not
  open the reads to everyone. The two probe communities, their links and the sign-in
  account were deleted afterwards, and the real community was re-read at 50 people and the
  same code.
- **A browser can record only that it is not attending, and a yes cannot be taken back.**
  Asked today of the live function, again with a real Firebase ID token and a throwaway
  community whose caller `leader`s it: a notice for 2027-02-07 came back `200` and the row read
  back with `attend = false`, `reason = Transport`, and `user_email` the token's own. The same
  request with `attend: true` in the body was stored `false`; one that also named
  `user_email: lerato@example.com`, a `recorded_by`, a `session_id` and a latitude wrote a row
  about the caller with those three left `null`. A notice for a day already recorded as present
  came back `403` — *you are recorded as present at that gathering, and a yes is never taken
  back* — and that row re-read as `attend = true`. The same notice twice left one row with the
  second reason, because the four columns are unique. A reason is optional: a notice with an
  empty one and one with the box missing altogether both came back `200` and stored
  `reason = null`, and a reason typed onto such a notice replaced it without writing a second
  row. A wording outside the five — `Nope` — was `400` then, refused by the function before it
  reached the table; that test has since come out of `api/god.js`, because the wording is the
  member's to choose and a notice they cannot finish typing is no use to anybody. What remains is
  the column's own check, named below.
  A notice with no community and one with no gathering were `400` too, and a community the
  caller is not in was `403` with its row count unmoved. The
  probe community, its rows, its link, its `users` row and the sign-in account were all
  deleted afterwards, and community A was re-read at 3450 attendance rows.

  What that guard does **not** do is stand in front of the table: `event` has no row level
  security, so the same insert made with the browser key instead of through the function is
  not refused at all. See the next section.
- **Leaving cannot empty a community, and a role change cannot unmanage it**: a browser
  may not remove the last member, nor demote the only admin, and may not add itself with
  `role` `leader` to a community that already has members. All four refusals are in
  `api/god.js` and were each confirmed against live data.
- **A browser cannot move a user row onto another address.** `api/god.js` filters
  `params.changes` down to `name` and `surname` before the update is sent, so an `email`
  in the request is dropped there rather than reaching the table. The address is only
  ever read from the verified sign-in.

## What is not enforced yet

The two tables the browser writes to have no protection of their own, the check-in rule that
needs the database has not been written, and an address taken off the screen is not an address
withheld. The first two are still ahead of us, not behind us:

- **RLS is off on `event` and `testimony`.** The browser key reads all 4650 `event` rows
  and all 467 `testimonies` today. A probe row was updated and then deleted with the
  public key alone, and both were accepted. So anyone holding the key that is in the
  bundle can read, change or delete attendance and testimonies for every community.
- **`addTestimony` records whatever `user_email` the caller passes**, and a `date` that
  need not be today, because the insert runs in the browser and nothing between that page
  and the table checks either.
- **There is no database function that checks the PIN, the time window and the distance
  before recording a check-in.** No `supabase.rpc(...)` call exists anywhere in `src/` or
  `api/`. The columns that such a function would read are all there — `session.pin`,
  `started_at`, `ended_at`, `latitude`, `longitude`, and `event.checked_in_at`,
  `checkin_latitude`, `checkin_longitude`, `recorded_by`, `session_id` — and no screen
  writes any of them.
- **No screen opens a session or takes a PIN either.** `src/functions/session.js` exists
  and `api/god.js` has a `session` action, but `SELF_ACTIONS` has no `session` entry, so
  only the server key could create one today, and nothing holds that key except the
  function itself.
- **An address is hidden by the pages, not withheld by the function.** `admin` `roster` still
  answers `email` for every person in the community, and `attendance` `service` still answers
  `email` for every attendee, because the roster row, the ⋮ menu and the two write calls are keyed
  by that address. What changed is what is drawn: no column, popup, card, tooltip or exported cell
  prints an address that is not the reader's own, and the dashboard search no longer matches on one.
  So a leader who opens their browser's network tab reads the whole list of addresses today exactly
  as they did yesterday. Turning that into a refusal means giving the roster rows an id the function
  resolves for itself, which is a change to what `assign` and `member` `remove` are asked for rather
  than to what is drawn — deliberately not made here.
- **The notice is written in the member's own words, and the live column has not been told it
  may.** `api/god.js` stopped matching the reason against the five, and the box on both attendance
  pages takes any wording with the five offered only as suggestions. `Documentation-site/docs/database.md`
  documents the column as a plain nullable `text` for that reason. The database this runs against
  still carries `event_reason_check`, so until
  `alter table event drop constraint event_reason_check;` is run in the SQL Editor a handwritten
  reason comes back as `23514` and only the five suggested words write. Nothing in the app can do
  this: PostgREST answers queries and inserts, not DDL, and there is no `psql`, CLI or Management
  API credential in the project.
- **A member still cannot mark themselves attending.** The only screen that writes attendance
  is the notice at the top of the admin and leader attendance pages, it is about whoever is
  signed in, and it always answers no. `src/member/Dashboard.jsx` is still a placeholder, so a
  plain member has no page to make even that notice from — today it is reachable only by
  somebody who leads or administers the community. Nothing in the app writes `attend = true`,
  and nobody is checking a whole room in from phones, which is what the PIN function above is
  for.

That last point is the one to settle before the burst arrives, because it decides where
the rule lives. The plan is for a member to POST a check-in straight from the page — no
function call per person in the room — which means the row is written by the browser and
has to be policed by the database. So before that page is switched on: RLS on `event`
with a policy that a member's insert can only carry their own `user_email`, and the PIN,
time window and distance as a Postgres function that the page calls instead of an insert
it can forge. `testimony` wants the same treatment: RLS, and the address taken from the
sign-in rather than the request.

## Postgres

Supabase is Postgres underneath. What the app avoids is a **second database**, not
Postgres: `supabase-js` does not open a Postgres wire connection from the browser, it
calls Supabase's REST interface (PostgREST), which turns a query string into one
parameterised statement and answers JSON. That is also why no browser path needs pooling
— there are no connections to pool, only HTTP requests, and a function invocation per
request is the cost that made the direct path worth taking for the testimonies page.

## The trade-off

Rules in the request handler are easy to reason about and impossible to route around
only as long as every path goes through it. Rules in the database hold whatever the
client is, but they are checked per column and per action, and forgetting one table is
silent: that is exactly how `event` and `testimony` ended up wide open while the four
tables next to them were locked. So the honest version of this design is one guard that
is genuinely in force everywhere — Firebase signs the caller in, and its email decides
what it may ask for — plus a second pass that is still to be finished, which is to say
policies in the database for the two tables a browser writes to.
