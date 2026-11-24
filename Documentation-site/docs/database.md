# Database

The schema is written for Postgres on Supabase and uses the Kopano table names.
Run it once in the Supabase SQL Editor. The three `function*` tables are the one part that is
re-runnable, because they drop themselves before they create — see Notes.

## Tables

| Table | Purpose |
| --- | --- |
| `users` | One row per person, keyed by `email`. |
| `community` | A group of people, such as a fellowship, carrying the `join_id` code others use to find it. |
| `community_members` | Links a person to a community and carries their `role`: `member`, `leader` or `admin`. |
| `session` | A check-in session opened by a leader: a `pin`, the gathering it was opened for, a date, a window and the place it was opened from. |
| `event` | One row per member per event: whether they attended, the reason if they did not, and who recorded it. |
| `testimony` | A testimony a member shared for a given date — `body` holds encrypted text or a file URL by `type`, and `allow_all` / `authorise` decide who may read it. |
| `feedback` | One row per submission about the app itself. App-wide and open to every signed-in reader — see [Feedback](feedback.md). |
| `functions` | A gathering that may cost something: a `name`, a `function_date`, a `location`, whether it `requires_payment` and the `amount` when it does. |
| `function_attending` | One row per person per function: whether they are going. |
| `function_paid` | One row per person per function: whether the money is in, the date they expect to pay, the proof they uploaded and who confirmed it. |

## Schema

```sql
/* Kopano schema for Supabase. Run once in the SQL Editor. */

create table users (
  email text primary key,
  name text not null,
  surname text not null
);

create table community (
  community_id uuid primary key default gen_random_uuid(),
  name text not null,
  /* the short code people type to find this community */
  join_id text unique
    default upper(substr(md5(gen_random_uuid()::text), 1, 6))
);

/* links a person to a community and gives their role */
create table community_members (
  email text not null references users(email) on delete cascade,
  community_id uuid not null references community(community_id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'leader', 'admin')),
  primary key (email, community_id)
);

/* a check in session opened by a leader */
create table session (
  session_id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(community_id) on delete cascade,
  pin text not null,
  created_by text not null references users(email),
  date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null,
  latitude double precision,
  longitude double precision,
  /* what the leader called the gathering this session is for */
  event_name text,
  /* how near the room a phone has to be, in metres. null means the leader did not set one */
  radius integer,
  /* true means distance is not asked about at all, whatever radius says */
  allow_any_radius boolean not null default false,
  /* a check-in called off by whoever opened it, or an admin: it stops counting the moment it is true */
  cancel boolean not null default false,
  unique (community_id, date, pin)
);

/* one row per member per event */
create table event (
  event_id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(community_id) on delete cascade,
  event_name text not null,
  event_date date not null,
  latitude double precision,
  longitude double precision,
  user_email text not null references users(email) on delete cascade,
  attend boolean,
  reason text,
  recorded_by text references users(email),
  session_id uuid references session(session_id),
  checked_in_at timestamptz,
  checkin_latitude double precision,
  checkin_longitude double precision,
  unique (community_id, event_date, event_name, user_email)
);

create table testimony (
  testimony_id uuid primary key default gen_random_uuid(),
  community_id uuid not null references community(community_id) on delete cascade,
  /* the author's address, AES-GCM encrypted at rest, so it can no longer key into users */
  user_email text not null,
  date date not null default current_date,
  /* the encrypted words (type text) or the public file URL (image / pdf / docx) */
  body text not null,
  type text not null default 'text',
  /* the addresses allowed to read this when allow_all is false */
  authorise text[] not null default '{}',
  /* true opens the testimony to everybody; false narrows it to authorise */
  allow_all boolean not null default true
);

/* one row per submission about the app itself — deliberately not tied to a community */
create table feedback (
  id bigint generated always as identity primary key,
  stars smallint not null check (stars between 1 and 5),
  email text,
  solves_problem boolean not null,
  improvements text,
  additions text,
  most_challenging text,
  created_at timestamptz not null default now()
);

/* The function tables went in as a drop-and-rebuild, children first: `functions` cannot be dropped
   while `function_attending` and `function_paid` still point at it, and these drops carry no
   `cascade`. Any rows that were in them are gone with them, so a database you mean to keep is
   altered instead of rebuilt. */
drop table if exists function_paid;
drop table if exists function_attending;
drop table if exists functions;

/* a gathering that may cost something. The id is a bigint identity, the way `feedback` does it,
   not a uuid; the two child tables are keyed on (function_id, user_email) and have no id of
   their own. */
create table functions (
  id bigint generated always as identity primary key,
  community_id uuid not null references community(community_id) on delete cascade,
  name text not null,
  function_date date not null,
  location text,
  requires_payment boolean not null default false,
  amount numeric(10,2),
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint amount_matches_payment check (
    (requires_payment = false and amount is null)
    or (requires_payment = true and amount is not null and amount > 0)
  )
);

/* who is going */
create table function_attending (
  function_id bigint not null references functions(id) on delete cascade,
  user_email text not null,
  attending boolean not null,
  created_at timestamptz not null default now(),
  primary key (function_id, user_email)
);

/* who has paid. `paid` true is a receipt, `paid` false is a promise — the check below is what
   keeps a row from being neither or both. */
create table function_paid (
  function_id bigint not null references functions(id) on delete cascade,
  user_email text not null,
  paid boolean not null,
  expected_pay_date date,
  proof_path text,
  proof_submitted_at timestamptz,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (function_id, user_email),
  constraint paid_fields_match check (
    (paid = true
      and proof_path is not null
      and proof_submitted_at is not null
      and expected_pay_date is null)
    or
    (paid = false
      and expected_pay_date is not null
      and proof_path is null
      and proof_submitted_at is null)
  )
);

/* RLS is on for these seven. It is left off for event and testimony. */
alter table users enable row level security;
alter table community enable row level security;
alter table community_members enable row level security;
alter table session enable row level security;
alter table functions enable row level security;
alter table function_attending enable row level security;
alter table function_paid enable row level security;
```

## Notes

- Removing a user cascades to their `community_members` and `event` rows, and, while
  `testimony.user_email` still carried its foreign key, their `testimony` rows. Now that
  `user_email` is encrypted that key is gone, so a person leaving no longer removes their
  testimony rows. Removing a community cascades to its `community_members`, `session`, `event`
  and `testimony` rows, and to its `functions` rows — which in turn take their
  `function_attending` and `function_paid` rows with them.
- Removing a *link* is the small one: `CommunityMember.remove(email, community_id)` deletes
  the single `community_members` row and nothing else, because `event` and `testimony`
  point at `users` and `community`, not at this table. So a person taken out of a
  fellowship stops belonging to it while the attendance and testimonies already recorded
  against their address stay in that community's history.
- `session` is unique per `(community_id, date, pin)`, and `event` per
  `(community_id, event_date, event_name, user_email)`, so a member cannot be
  recorded twice for the same event.
- `community.join_id` at creation is generated by the database, not by the app. The default
  takes `md5` of a fresh `gen_random_uuid()`, keeps the first six characters and upper-cases
  them, so every row gets a short code like `3B1885`. `Community.create({ name })` inserts
  the name only and reads the row back, so the code arrives in the same response that
  created the community.
- Changing that code later is the app's job, because a code somebody reads aloud has to
  avoid the characters that look alike. `AdminDashboard.changeCode(community_id)` in
  `src/functions/admin_dashboard.js` draws six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
  with `crypto.getRandomValues` — no `0`, `O`, `1` or `I` — asks the table whether any
  community already holds that code, draws again until one is free, then writes it and
  returns the row. It gives up after ten draws rather than spinning forever.
- The two generators do not agree yet: the database default is hex, so a brand new
  community can still be handed a code containing `1` or `0`, as `C5EB14` did. Anyone who
  minds clicks **Change code** once and gets a code from the safe alphabet. Making `create`
  call the same generator is a two-line change, and it would leave the column default as a
  safety net for rows inserted by hand.
- A table that already exists takes the column in two statements: the `add column` lets
  the default fill every current row, and only then does `alter column ... set not null`
  make it mandatory. Running the second part first would leave existing rows without a
  code.
- `join_id` is `unique` and only six characters wide. Hex from the database default is
  16.7 million codes, and the safe alphabet is 32⁶, a little over a billion — both are
  reachable by the birthday problem long before you would want to rely on luck. So
  `changeCode` checks the table before it writes, and the constraint is what makes the
  check trustworthy rather than a courtesy: two admins drawing the same code in the same
  instant means one write fails with `23505` and the page says so, instead of two
  fellowships quietly sharing a code. Widening the column is the fix if it ever bites.
- Row level security is enabled on `users`, `community`, `community_members`, `session` and
  the three `function*` tables. Enabling RLS without policies blocks access to those tables,
  so policies need to be added before they can be read or written.
- `event` and `testimony` have RLS left off, which means any authenticated
  request can read and write them. For `testimony` the page functions lean on that: the anon
  key lists rows freely, while the content is protected another way — `user_email` is
  encrypted and `body` holds either encrypted words or a public file URL. `allow_all` true
  opens a testimony to everybody; `allow_all` false limits reading to the addresses in
  `authorise`. That gate lives in the page functions (`canRead` in
  `src/page_functions/testimonies.js`), not in the database, so it only applies to reads that
  go through them.
- `session.cancel` is a plain boolean, defaulted false. It is what the dashboard's **Cancel session**
  sets, and the one switch that decides whether a check-in counts: a session is only offered for
  check-in (`Session.open`), only blocks another from opening (`Session.create`'s one-at-a-time
  lock), only shows as live on a member's dashboard, and only appears on the leader/admin dashboard's
  manage read (`Session.manage`) while `cancel` is false. A called-off session therefore leaves the
  dashboard entirely rather than sitting there marked off — the row still carries its PIN and the QR
  rendered from it, and neither has anything left to do once the session is cancelled. Cancelling is one-way — the
  row keeps its history and is never reopened — so whoever takes the attendance after it is not
  competing with a ghost. A table that already has rows takes it in one statement, because the
  default fills every existing row before the `not null` applies:

  ```sql
  alter table session add column cancel boolean not null default false;
  ```

  Until that runs, every read and write that touches `cancel` — opening a session, the open/listen
  poll and the dashboard manage read — fails, so it is the first thing to run against a live
  database.
- `event.reason` is a plain nullable text column: the person giving notice writes it in their
  own words, and an empty box leaves it null. It used to carry
  `check (reason in ('Work', 'Transport', 'Sick', 'Family', 'Other'))`, which refused any other
  wording with `23514`, and a database built before that change still has it until this is run
  in the SQL Editor:

  ```sql
  alter table event drop constraint event_reason_check;
  ```

  The five words survive only as suggestions in the notice box (`REASONS` in
  `src/page_functions/attendance.js`), and the rows already recorded keep whatever they were
  given. Putting the check back is `alter table event add constraint event_reason_check check
  (reason in ('Work', 'Transport', 'Sick', 'Family', 'Other'));` — which fails the moment one
  row holds wording outside the five, so it is a decision to make about the data as it stands,
  not a switch.
- The roster of a community is one read, not two: `AdminDashboard.roster(community_id)`
  selects `email, role, users!inner(name, surname)` from `community_members` and lets
  Postgres do the join on `users(email)`. `!inner` is what makes it an inner join — a link
  whose `users` row is missing drops out instead of coming back nameless — and the class
  flattens the nested `users` object into `{ email, name, surname, role }`, ordered by role
  then email, so an admin screen reads admins, then leaders, then members.
- A person's communities take two reads, because `community_members` holds only the
  ids: `Community.memberOf(email)` collects the `community_id`s and the caller's own `role`
  for each of them from `community_members`, then selects `community_id, name` from
  `community` with `.in(...)`, and folds the role back onto each row. It returns `[]` for
  someone with no links, and is reached from the browser through
  `CommunityFetch.getCommunities()` in `src/page_functions/community.js`. Both `/community`
  and the communities section of `/profile` read through this one call.
- Reads of `users`, `community` and `community_members` only return rows when the query
  runs on the service-role key. `new User()` defaults to `SUPABASE_ANON_KEY` and gets
  zero rows back from these RLS-protected tables; `new God()` passes the service key to
  every class, which is why page data arrives through `/api/self`, `/api/leader` or `/api/admin`
  and not directly.
- `session.radius` and `session.allow_any_radius` decide whether a check-in is refused for
  being too far from where the leader opened it. Both are set at `Session.create` time, both
  are read by `Session.live` and `Session.checkIn`, and neither is required: a `null` `radius`
  is *no distance limit* rather than a missing number, and `allow_any_radius` overrides any
  `radius` that happens to be there. The class exposes a derived `near_required` boolean
  (`allow_any_radius !== true && radius != null`) so a page does not have to remember the rule.
  A table that predates either column takes them in one statement each:

  ```sql
  alter table session add column radius integer;
  alter table session add column allow_any_radius boolean not null default false;
  ```

- `feedback` is the only table in the schema that is **not** tied to a `community_id`. It
  carries one row per submission about the app itself. Any signed-in member may write to it and
  any signed-in member may read the whole pile — the table is about Kopano rather than about a
  fellowship, so the read is not role-gated. `email` is nullable in the schema but the
  write path never trusts what a browser claims for it — the value that lands in the row is
  the one the Firebase ID token carried, and `Feedback.create` refuses a submission that
  arrives without one. No screen prints it; it is stored and exported only. There is no
  foreign key on it and no cascade; the row is signal about the product rather than a record
  about a person, so it survives the person. Full write-up:
  [Feedback](feedback.md).
- The three `function*` tables are the money side of a gathering, and they keep the same shape
  as `session` and `event`: `functions` is what was planned, the two children are one row per
  person per function. A function is tied to its fellowship by `community_id`, so nothing here
  is app-wide the way `feedback` is.
- `amount_matches_payment` is what stops a price and the flag that explains it from disagreeing.
  `amount` is nullable, but it may only be null when `requires_payment` is false, and it must be
  more than zero when it is true. So a free function cannot be stored as `0.00` and a paid one
  cannot be stored without a number: writing `requires_payment` true with a null `amount`, or
  false with an `amount`, fails with `23514`. The rule reads off the flag, which is why the flag
  is `not null default false` rather than nullable.
- `location` is a plain nullable text column that arrived after the tables were built, so a
  database that already has them takes it in one statement, and every function planned before it
  ran keeps none until somebody writes one in:

  ```sql
  alter table functions add column location text;
  ```

  Nothing is checked about it — no length, no shape, no link to a place record — because it is a
  sentence a leader types and a page prints. The write path keeps blank as a null rather than as
  the empty string: `/api/leader` trims what the page sent and turns nothing at all back into a
  null, so an empty box and a box nobody filled in are the same answer in the table.
- `paid_fields_match` gives the two halves of `function_paid` one meaning each. `paid` true is a
  receipt: `proof_path` and `proof_submitted_at` both filled, and the promised date cleared, so
  a row cannot say the money arrived and still hold the date it was meant to. `paid` false is a
  promise: `expected_pay_date` with no proof against it. A row that is neither — no date, no
  proof — is refused, which is the point: an outstanding payment has to carry the date the
  person gave.
- `confirmed_by` and `confirmed_at` sit outside that check on purpose, because nobody having
  confirmed the money yet is a third state that neither half of the check can demand. A receipt
  waiting on a leader is `paid` true with both of them null. The address that lands in
  `confirmed_by` is the one the token carried rather than the one the browser sent, the way
  `Feedback.create` takes `email` from the Firebase ID token.
- `updated_at` takes its `default now()` on insert only — Postgres does not touch it on update,
  so a row confirmed last month can still show the day it was created. Either the write path
  sets `updated_at` in the same update, or a trigger has to. No trigger is in the schema; this is
  what one would look like:

  ```sql
  create or replace function touch_function_paid() returns trigger language plpgsql as $$
  begin
    new.updated_at := now();
    return new;
  end $$;

  create trigger function_paid_touch before update on function_paid
    for each row execute function touch_function_paid();
  ```

- Neither `user_email` nor `created_by` carries a foreign key here, the way `testimony.user_email`
  no longer does. Two consequences: removing a person from `users` does not clean their function
  rows out, and an address that no longer exists still counts towards the headcount and the takings.
  `event` does carry the key, so the same deleted person stops appearing in attendance and keeps
  appearing against a function — counted in one table's totals and gone from another's.
  Putting `references users(email) on delete cascade` on the two `user_email` columns is the choice
  to make while addresses are plain text; if they are ever encrypted the way testimony addresses
  are, the key cannot exist and the rows have to be reaped by the app.
- The functions page is the only thing that reads or writes these three tables, and it only plans
  them and opens them out. `ChurchFunctions.list`, `ChurchFunctions.create` and
  `ChurchFunctions.details` in `src/functions/church_functions.js` are reached from
  `src/page_functions/church_functions.js` by the page at `/functions`, which both the admin and the
  leader dashboard open: the register in `src/components/view_functions.jsx` lists every planned
  function newest day first, and one button per row opens `src/components/individual_function.jsx`,
  which reads that function's row and every answer under it. All three calls go through
  `/api/leader` — where the role gate settles that the caller leads or admins this community, and
  `created_by` is written off the caller's token rather than off the body. They go through the server
  because RLS is enabled with no policies, which is the same reason `users`, `community`,
  `community_members` and `session` are never read straight from a browser.
- `details` reads the `functions` row first and compares its `community_id` with the one the token
  was gated on, before either child table is asked. That comparison is what stops a leader who
  happens to hold the id of another fellowship's function from reading its list of names — the id
  comes from a click, and nothing else in the request ties it to a community. The names themselves
  cost a second read: because no foreign key connects `function_attending.user_email` or
  `function_paid.user_email` to `users`, the page cannot embed the way `Attendance` does through
  `event`, so the addresses come back and are matched against one `users` read over exactly those
  addresses. An address with no user row keeps its answer and is named by its email.
- Nothing writes `function_attending` or `function_paid` yet. There is no door for a member to say
  they are coming, or to upload a proof, so the three counts the register shows — going, paid,
  promised — read nought against every function, and the four sections an opened function splits
  people into (confirmed receipts, receipts waiting to be checked, dates given instead of money, and
  the people who said they are not coming) are all empty for the same reason. A function planned
  today will therefore look answered-by-nobody forever, which is a fact about the missing member
  screen rather than about the data.
- Asked of the live project on 2026-11-24, both answers the gate depends on held: the browser key
  read 0 rows out of `functions` while the service key read the table, and the seven communities
  then in the project had no planned function among them. `details` was asked the same way: the
  dispatcher turned away a call missing either half (`params.function_id is required for 'details'`
  and its community twin), and an id that matches no row is answered in words rather than as an
  empty page — under the browser key as well, which is the same RLS result said of a second read.
  The two `check` constraints have not been probed with a refused insert — see
  [What is enforced today](architecture.md#what-is-enforced-today).
- Rebuilding rather than altering has one side effect beyond the lost rows: `id` is
  `generated always as identity`, and the sequence belongs to the table, so a fresh `functions`
  starts numbering at 1 again. A `function_id` that a browser, a link or a saved draft picked up
  before the rebuild does not fail when it comes back — it points at whatever the new table puts
  at that number. This is no longer only theoretical: the register holds ids in memory and a click on
  one opens that number out, so a rebuild while a page is standing there can answer with a different
  function and say nothing about it. The `community_id` comparison in `details` keeps it inside the
  same fellowship, which is the only part of the mistake that is caught.
