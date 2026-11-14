# Database

The schema is written for Postgres on Supabase and uses the Kopano table names.
Run it once in the Supabase SQL Editor.

## Tables

| Table | Purpose |
| --- | --- |
| `users` | One row per person, keyed by `email`. |
| `community` | A group of people, such as a fellowship. |
| `community_members` | Links a person to a community and carries their `role`: `member`, `leader` or `admin`. |
| `session` | A check-in session opened by a leader, with a `pin`, a date and a location. |
| `event` | One row per member per event: whether they attended, the reason if they did not, and who recorded it. |
| `testimony` | A testimony body written by a member for a given date. |

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
  name text not null
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
  reason text check (reason in ('Work', 'Transport', 'Sick', 'Family', 'Other')),
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
  user_email text not null references users(email) on delete cascade,
  date date not null default current_date,
  body text not null
);

/* RLS is on for these four. It is left off for event and testimony. */
alter table users enable row level security;
alter table community enable row level security;
alter table community_members enable row level security;
alter table session enable row level security;
```

## Notes

- Removing a user cascades to their `community_members`, `event` and `testimony`
  rows. Removing a community cascades to its `community_members`, `session`,
  `event` and `testimony` rows.
- `session` is unique per `(community_id, date, pin)`, and `event` per
  `(community_id, event_date, event_name, user_email)`, so a member cannot be
  recorded twice for the same event.
- Row level security is enabled on `users`, `community`, `community_members` and
  `session`. Enabling RLS without policies blocks access to those tables, so
  policies need to be added before they can be read or written.
- `event` and `testimony` have RLS left off, which means any authenticated
  request can read and write them.
- A person's communities take two reads, because `community_members` holds only the
  ids: `Community.memberOf(email)` collects the `community_id`s for that address, then
  selects `community_id, name` from `community` with `.in(...)`. It returns `[]` for
  someone with no links, and is reached from the browser through
  `CommunityFetch.getCommunities()` in `src/page_functions/community.js`.
- Reads of `users`, `community` and `community_members` only return rows when the query
  runs on the service-role key. `new User()` defaults to `SUPABASE_ANON_KEY` and gets
  zero rows back from these RLS-protected tables; `new God()` passes the service key to
  every class, which is why page data arrives through `/api/god` and not directly.
