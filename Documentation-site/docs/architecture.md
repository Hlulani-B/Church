# Architecture

Everything the app knows about people lives in one Postgres database on Supabase,
and Firebase Authentication is the only login. Between the React page and that
database there are two paths:

    page ──> src/page_functions/<area>.js ──┬──> POST /api/{self,leader,admin} ──> Supabase   (the service key is here)
                                            │
                                            └──> Supabase directly            (the testimonies file only)

## Path 1 — through the function

Most pages do not talk to Supabase at all. They call `callGod(action, params)` in
`src/page_functions/god.js`, which POSTs — with the Firebase ID token of whoever is signed in as
the bearer value — to one of three endpoints, chosen by the auth tier that owns the call:
`api/self.js`, `api/leader.js` or `api/admin.js`. god.js used to be a single endpoint for all of
it; it was split by who may call something, and the shared engine now lives in `lib/god.js`.
Those three files are the only place in the codebase that reads `SUPABASE_SERVICE_ROLE_KEY`, so
the key that can see every table never reaches a browser: the built bundle under `dist/` was
checked for it and does not contain it.

Each endpoint answers in a fixed order, sharing the `lib/god.js` dispatcher and checks:

1. `POST` only.
2. The bearer is either the deployment's own `GOD_SERVER_KEY`, or a Firebase ID token
   whose signature, issuing project, audience, subject and expiry are verified against
   Google's signing keys. A caller cannot pick the address it asks about: the email
   comes out of the verified token and overwrites whatever the body claimed.
3. Without the server key, an endpoint answers only the (action, function) pairs on its own
   whitelist — `SELF_ACTIONS`, `LEADER_ACTIONS`, `ADMIN_ACTIONS` — which is what makes the split
   hold: `callGod` picks the door by tier, and a browser that guesses a different door is refused
   by the whitelist before it can borrow another tier's power. The `params.function` is then
   matched against the real method name on the class that was picked, so a name that is not on
   that class is a 400 before it reaches the database.
4. The **leader** tier (`attendance` reads, `admin` `roster`, the `session` write/manage calls)
   and the **admin** tier (`admin` `changeCode` and `assign`, `member` `remove`, `community`
   `find`) each ask one role question of every browser request through `roleGate`: a
   `community_id` in the body, and a matching `community_members` link for the caller read off
   the token's address rather than the body's. A leader-tier call is let through by a `leader` or
   `admin` link; an admin-tier call only by an `admin` link. `admin` `roster` is settled on the
   leader door — `callGod` routes it there — because reading the roster is what the leader role
   exists to do, and `community` `find` sits on the admin tier only because the row it returns
   carries `join_id`.
5. `event` `record` — the not-attending notice — lives on the **self** tier and is checked on its
   own, because it is about the caller rather than about anybody else, so a member of any role may
   make it. Five
   things are decided there and none of them is left to the guesswork of a form: the address the row
   names is the token's, the answer is always `false`, the gathering is read back off the session
   opened for that day rather than typed (a day with no session, or with more than one, is refused
   rather than guessed), a reason is optional and handwritten — whoever gives notice words it as they
   please, an empty box is sent as `null`, and the function no longer matches the wording against a
   list — and
   only those columns are passed on — a body that also carries
   `recorded_by`, a `session_id` or a latitude has those dropped before the insert. Then one
   refusal: the row for that person, that day, that gathering is read first, and if it already
   says present the write is refused. A yes is a fact about a day that has gone by; letting it
   be talked back into a no would make the record say whoever edited the list rather than who
   was in the room.
6. The **member's half of a function** — `church_function` `available`, `rsvp` and `respond` — answers
   to the **self** door, and it is the one place on that door where a `community_id` is checked rather
   than taken on trust: the endpoint reads `community_members` for the address on the token and refuses
   `403` when there is no link, so an id typed into a url cannot open another fellowship's function.
   The rest is shape: `function_id` has to be digits, `attending` has to be `true` or `false`, a
   `proof_path` has to look like a web address, and an `expected_pay_date` has to be `YYYY-MM-DD`. The
   address written on both child rows is the token's, and `confirmed_by` and `confirmed_at` are never
   forwarded — signing a receipt off is a leader's act, and the screen for it has not been built.

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
in `src/page_functions/table_files.js` assemble the file there, from bytes, with no
library and no server step. They are given a column list rather than knowing a table's
shape, which is how testimony (four columns) and feedback (seven) share one pair of
writers. One page, one connection — the cost is that its guards are
in two different places.

So the split today is:

| Page | Path |
| --- | --- |
| Login, create account, forgot password | Firebase, `src/functions/auth.js`, no database |
| Profile, menu, community | `/api/self` |
| Admin dashboard — roster, roles, code, leaving, opening a community | `/api/admin` (roster via `/api/leader`) |
| Admin attendance — gatherings and who was at one | `/api/leader` |
| Admin testimonies — list, search, save, export | direct Supabase, plus `/api/leader` for names |
| Leader dashboard — the people of the community, read only | `/api/leader` `admin` `roster` |
| Leader attendance, leader testimonies | the same two paths the admin pages take |
| Member dashboard — the not-attending notice and the PIN check-in | `/api/self` |
| Member dashboard — the live/scheduled check-in notice | `/api/self` `session` `live` |
| Leader/admin dashboards — watching and managing open check-ins | `/api/leader` `session` `manage` |
| Take attendance — leader opens a session, sees its PIN and QR | `/api/leader` `session` `create` |
| `/qr` landing — phone that scanned the QR; also signs a first-timer up inline and adds them to the fellowship | Firebase auth + `/api/self` `event` `checkin`, `community` `join_at_session` |
| Feedback — the form every member can reach from the menu, and the pile everyone can read | `/api/self` `feedback` `create` / `all` |
| Functions — a leader or an admin plans a gathering, reads its tallies, and opens one out to see who has answered | `/api/leader` `church_function` `list` / `create` / `details` |
| Available functions and the RSVP — any member sees what is still to come and answers for themselves | `/api/self` `church_function` `available` / `rsvp` / `respond` |

The leader pages are the admin ones with nothing to click: the roster arrives without the
⋮ menu that changes a role or takes somebody out, and no leader page asks the function for
the community row, so the join code is never fetched into a leader's browser. What a leader
cannot do is not hidden on the page — it is refused by the function, and the table above is
the list of which tier answers what. The admin dashboard does hide one thing: the row that
holds the signed-in address carries no menu, because that page is not how an admin hands
their own role on or leaves.

## Where a way out lives

Every page that is about one community carries three things in the same order at the top:
the header bar with the menu, the back link and the logo; then the eyebrow, the community's
name and the caller's address; then, immediately, the buttons that leave this page for
another. Attendance cards, the roster and the join code come after.

That ordering was reversed until recently. The `.links` block on the three dashboards used
to sit under everything — below the live-check-in card, the leader's own attendance control
and (on admin) the whole roster — which meant scrolling two or three screens on a phone to
reach "View testimonies". The `Back to the dashboard` anchor at the bottom of the long
attendance and testimonies pages had the same problem: a page whose whole purpose is a
hundred-row list is not the place to put the exit at the end.

The rule now: on any screen that can grow, the navigation is above the content, not below
it. Duplicating it at the bottom is fine and is what the testimonies pages do, but only
after a version at the top. A one-line comment above each block says why the placement is
deliberate, so it does not get "tidied" back into reading order later.

The way back to a dashboard was, until recently, only a way back to the communities list. Six pages
that a dashboard opens — the register of functions, one function opened out, the servings list, the
take-attendance page, the list of what is still to come and a member's RSVP under it — carried
`Back to your communities` and nothing else, so a leader who came from the admin dashboard had to open
the menu and find the dashboard among the links.
They now show `Back to the dashboard` in the same corner of the header whenever the navigation that
arrived carried a role, and keep the communities link when it did not: every one of these pages is also
reachable from the community list, and from there a dashboard is not where the reader came from. The
role travels as navigation state — the three dashboards put it on the way down, and the pages that sit
between a dashboard and an answer pass it on rather than dropping it — because it is a fact the click
already knew. Re-reading `community_members` to rediscover it would cost a request per page for a fact
the caller never forgot, and guessing is not a better answer than knowing: the three dashboards
are three different screens, and the wrong one is not the way back. A page reached without a role, by a
bookmark or a typed address, renders no dashboard link at all rather than inventing one. The route each
role was looking at lives in `src/components/back.jsx` beside the link itself, so the three names
cannot be re-spelled differently per page. The two feedback pages take the same way back in their own
shape — a link above the pile, a button beside the thank-you — because they are mounted outside the
header pattern that the community pages share.

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
- **The three function tables are gated the same way**, and this one was asked on 2026-11-24
  rather than 2026-11-14, through the dispatcher the endpoints use and against every community
  in the project. The browser key read **0 rows** out of `functions` where the service key read
  the table unhindered; the service key found 0 planned functions across all seven communities at
  that moment, which is what the functions page shows as "nothing has been planned for this
  community yet" — the dummy fellowships have since been given a calendar of 42 and 18 planned
  functions, with 763 answers under them, by `seed-dummy-data.mjs`. That seed now also tops up
  whichever of the four tables a person on either dummy roster came up short in, so none of the
  twenty-two dummy people reads as a blank on a screen. What it invents for the money tables sits only
  beside a *coming* answer, so no dummy person appears in two of the opened function's sections at
  once; the rule is in [Database](database.md).
  A `church_function` `list` with no `community_id` is refused by the dispatcher, in words:
  `params.community_id is required for 'list'`. The same was then asked of `details`, the read
  behind an opened function: both halves are required (`params.function_id is required for
  'details'` and its community twin), an id matching no row is answered as `there is no such
  function` rather than as an empty page, and the browser key was turned away the same way the
  list read was. Writing has been asked of the same door since, through the member's `respond`: one
  paid function was created, answered with a receipt, then with a promised day, then with neither, and
  both child tables took exactly the rows `paid_fields_match` allows — three answers left one row, and
  a free function wrote no money row at all. What still has not been answered is a *refused* insert: no
  row has been pushed against either check on purpose to hear `23514` come back. The browser key could
  neither list nor write, and the anon-key write is turned away as `there is no such function`, because
  RLS hides the `functions` row before the class ever compares its community.
- **The register's tallies are counted by the database**, in the one read that lists the functions,
  and the shape was checked against the seeded calendar rather than assumed: 42 functions came back in
  one request with `going`, `paid` and `promised` on each row, every count matched a tally made row by
  row over the 440 answers, and the read went from 26 KB in three requests to 13 KB in one. The trap
  this found is in [Database](database.md): the condition each tally counts has to be sent as a filter
  on the aggregate's alias, because the same condition written inside the `select` string is accepted
  without an error and counts the wrong rows.
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
  reached the table; that test has since come out of the function (now `api/self.js`), because the
  wording is the
  member's to choose and a notice they cannot finish typing is no use to anybody. What remains is
  the column's own check, named below.
  A notice with no community was `400`, and a notice for a day with no session is now refused
  outright rather than filed under a blank — the gathering is read back off that day's session, not
  typed — and a community the
  caller is not in was `403` with its row count unmoved. The
  probe community, its rows, its link, its `users` row and the sign-in account were all
  deleted afterwards, and community A was re-read at 3450 attendance rows.

  What that guard does **not** do is stand in front of the table: `event` has no row level
  security, so the same insert made with the browser key instead of through the function is
  not refused at all. See the next section.
- **Leaving cannot empty a community, and a role change cannot unmanage it**: a browser
  may not remove the last member, nor demote the only admin, and may not add itself with
  `role` `leader` to a community that already has members. All four refusals are in
  `api/self.js` and `api/admin.js` and were each confirmed against live data.
- **A browser cannot move a user row onto another address.** `api/self.js` filters
  `params.changes` down to `name` and `surname` before the update is sent, so an `email`
  in the request is dropped there rather than reaching the table. The address is only
  ever read from the verified sign-in.
- **A member marking themselves present goes through the server, and cannot lie about it.**
  Two doors — the card on `session_live.jsx` and the `/qr` landing — both POST the same
  `event` `checkin` call to `/api/self`, which matches `(community_id, pin)` with the
  `cancel` filter, checks the window against the server's clock, checks the haversine against
  the session's `radius`, and either writes the row or refuses. A body that names
  `user_email` is ignored: the address on the row is the one the ID token carried. A second
  POST after the first has landed returns the original `checked_in_at` with `already: true`
  rather than a duplicate row, backed by the `unique (community_id, event_date, event_name,
  user_email)` constraint on `event`. The full flow is written up in
  [Check-in and QR flow](check-in.md).
- **Joining from a scan is worth only what the open check-in is worth.** The `/qr` landing posts
  `community` `join_at_session` before the arrival, which is how a first-timer gets added without
  anybody hunting for a code. It refuses unless those four digits name a session whose window holds
  *now*, on the server's clock and through the same `pickOpenSession` the check-in uses — so the
  community is read off that session's row and an id claimed in the body decides nothing, the role
  is written as `member` by the function, and the address comes off the ID token, which is what
  stops a scan from enrolling anybody who is not holding the phone. A photographed screen and a
  whispered PIN are therefore worth exactly as much here as they already were at the register:
  until that gathering ends.
- **`feedback` is app-wide and the write ignores what the body claims.** Both its doors —
  `create` and `all` — sit on the self tier. The pile is about the app rather than about a
  community, and the table has no `community_id` for a per-community question to ask, so the
  only gate on reading it is being signed in. The email that lands on a row is always the
  token's and never the body's: every note is signed, which is what makes it count as evidence
  rather than noise. What a reader is handed instead is a name — the read matches its addresses
  against `users` and the exports print `Submitted by` from that, so no screen and no file in
  the app carries an address that is not the reader's own. Details in
  [Feedback](feedback.md).

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
- **A proof of payment is a public link, and nobody signs it off.** The receipt goes from the browser
  straight into the `kopano` bucket on the anon key and the row stores the public url, so anybody
  holding that link opens the document — the name is a `crypto.randomUUID()`, so it is not guessable,
  but it is forwardable, and nothing stands between the url and the file. It is the reach a
  testimony's pictures already have, now over a bank statement. The app has also stopped hiding that
  reach: the RSVP page and the leader's *Proof* column open the file on the screen through
  `src/components/proof_viewer.jsx` instead of printing its address, which makes the document easier to
  look at without putting anything between the url and the file. The dialog hands out no address of its
  own — the file, a maximise and a *Save the file*, and that last one fetches the bytes and stores them
  rather than being a link dressed as a download, which the bucket's cross-origin answer allows and a
  `download` attribute on another host's file does not. The second half is a missing feature
  rather than a hole: no path writes `confirmed_by` or `confirmed_at`, so a receipt a member uploaded
  sits in *waiting for a leader* on the opened function until somebody builds the confirm action.
- **The PIN, the time window and the distance are checked in the request handler, not by a
  Postgres function.** No `supabase.rpc(...)` call exists anywhere in `src/` or `api/` — the
  rule lives in `src/functions/session.js` and is enforced every time a browser asks for
  `event` `checkin`, in `api/self.js`. That is fine for every path the app itself takes, and it is not fine for
  a caller with the anon key that talks to PostgREST directly, which is why `event` still has
  no RLS and this rule has no teeth in front of the table.
- **Session creation is guarded in the function, not the database.** The take-attendance page
  opens one through `api/leader.js`, which puts `session` on the leader tier — `roleGate` demands
  a `leader` or `admin` link for the `community_id` before the create runs — so a plain member's
  browser cannot open a session, but nothing in the database would stop a caller who held the
  service key. A create is also refused `409` when its window overlaps any un-cancelled session
  already standing on that community, so two leaders cannot hold two check-ins open at once; the
  overlap is settled on the server rather than by a page that might be looking at a stale list. The
  two reads a plain member makes both answer on the self tier and carry no PIN: `open` returns only
  the windows taking arrivals right now, and `live` adds the sessions scheduled for later so every
  phone in the fellowship can be shown what is coming; the leader's `manage` is the one read that
  carries a PIN, and only to its opener or an admin.
- **An address is hidden by the pages, and one function now withholds it too.** `admin` `roster`
  still answers `email` for every person in the community, and `attendance` `service` still answers
  `email` for every attendee, because the roster row, the ⋮ menu and the two write calls are keyed
  by that address. What changed is what is drawn: no column, popup, card, tooltip or exported cell
  prints an address that is not the reader's own, and no search box matches on one either — the For-who
  picker finds people by name now, which is what its own placeholder has always said it does.
  The weak half of that claim was never the columns but the fallbacks: a label the `users` read could
  not name comes back as the address it was keyed on, and a page printing that label prints the
  sign-in with it. Two helpers settle the wording, one per kind of source — `named` in
  `src/components/view_functions.jsx` for what a read hands over, `displayName` in
  `src/components/absence_for.jsx` for a person picked out of a list — and every page that shows a
  person goes through one of them. Two screens that had slipped through an earlier pass are closed
  with it: the servings table no longer carries an *Address* column, and the dashboard's attendance
  card says *A leader opened this register* where it had printed whoever opened it as their sign-in.
  The read that goes further is the feedback pile, which names its rows before they leave the server
  because a downloaded file is the same pile and the rule cannot stop at the edge of a screen.
  So a leader who opens their browser's network tab reads the whole list of roster addresses today
  exactly as they did yesterday. Turning that into a refusal means giving the roster rows an id the
  function resolves for itself, which is a change to what `assign` and `member` `remove` are asked for
  rather than to what is drawn — deliberately not made here.
- **The notice is written in the member's own words, and the live column has not been told it
  may.** `api/self.js` stopped matching the reason against the five, and the box on both attendance
  pages takes any wording with the five offered only as suggestions. `Documentation-site/docs/database.md`
  documents the column as a plain nullable `text` for that reason. The database this runs against
  still carries `event_reason_check`, so until
  `alter table event drop constraint event_reason_check;` is run in the SQL Editor a handwritten
  reason comes back as `23514` and only the five suggested words write. Nothing in the app can do
  this: PostgREST answers queries and inserts, not DDL, and there is no `psql`, CLI or Management
  API credential in the project.
- **Nothing throttles the check-in endpoint.** A browser that guessed four digits by trying
  every combination hits `/api/self` as fast as its network allows, and the function has no
  rate limit and no lockout — the only cost is a wrong-PIN refusal per attempt. Vercel's
  per-function concurrency and the project's request quota stand in front of the worst case,
  but neither is a designed guard. A real fix is a per-(email, pin) attempt counter kept
  either in the function's edge config or on the `session` row, and it is worth building
  before the app is used by a community large enough for someone to bother.

The closing paragraph is about the check-in path, and it matters now that the path is real: a
member's phone does write a yes as soon as the PIN, the window and the distance agree. That
write goes through `api/self.js` today, so every rule is checked. What is not yet true is
that the same rule holds for a caller who talks to PostgREST directly with the anon key. The
fix is RLS on `event` with a policy that a member's insert can only carry their own
`user_email`, and the PIN/window/distance check moved into a Postgres function that the
endpoint calls rather than a JavaScript class the endpoint happens to import. `testimony`
wants the same treatment: RLS, and the address taken from the sign-in rather than the request.

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
