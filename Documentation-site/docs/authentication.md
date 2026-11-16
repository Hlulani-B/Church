# Authentication

Identity is Firebase Auth with email and password. Data stays in Supabase Postgres.
Those are two separate systems, and the pages below describe how they meet.

| Concern | System | Where the code lives |
| --- | --- | --- |
| Account, password, session | Firebase Auth (`kopano-a0554`) | `src/firebase.js`, `src/functions/auth.js` |
| Person record, name, surname | Supabase `users` | `src/functions/user.js` |
| Role in a community | Supabase `community_members` | `src/functions/community_members.js` |
| Attendance | Supabase `event` | `src/functions/attendance.js`, read through `/api/leader` |
| Testimonies | Supabase `testimony` | `src/page_functions/testimonies.js`, read by the browser itself |

## Status: enabled, and wired to the pages

Email/Password is switched on for `kopano-a0554`. A sign-in probe with an address
that does not exist now returns `auth/invalid-credential` (it used to return
`auth/configuration-not-found`), and `sendPasswordResetEmail` resolves without an
error.

`auth/invalid-credential` for both a wrong password and an unknown address is what
**email enumeration protection** does: the API deliberately refuses to tell the two
apart. So `auth/user-not-found` and `auth/wrong-password` never reach the client, and
the log-in page cannot safely guess that an address is unregistered — it shows one
message with a link to create an account instead of redirecting there.

## What the auth pages do

| Route | Page | What it does |
| --- | --- | --- |
| `/login` | `src/pages/login.jsx` | Firebase sign-in and Google sign-in; no email-verification gate; a visitor who still holds a session goes straight to `/community` |
| `/signup` | `src/pages/create_account.jsx` | Creates the account, then the `users` row through `/api/self`, then on to `/community` |
| `/forgot-password` | `src/pages/forgot_password.jsx` | `sendPasswordResetEmail`, with a resend button |
| `/terms` | `src/pages/TCs.jsx` | The policy text, linked from the agree checkbox on `/signup` |
| `/community` | `src/pages/community.jsx` | The signed-in home page: greets the visitor from their own `users` row, lists their communities and opens new ones from a popup |
| `/profile` | `src/pages/profile.jsx` | Changes **name and surname only**, through `/api/self` `user` `update` |
| `/admin-dashboard` | `src/admin/Dashboard.jsx` | Headed **Admin**, the community's name and the signed-in address, over the roster of that community — name, surname and role from `users` joined onto `community_members`, with no address in the table but the caller's own, in the heading — searchable by name or surname, with that community's join code beside it to copy or draw again, and a ⋮ menu on every row but the signed-in one to put that person in another role or remove them |
| `/admin-attendance` | `src/admin/attendance.jsx` | Every gathering this community has recorded, newest first, with how many of its rows were present; pressing one lists everyone recorded at it, present and absent, by name. At the top is the page's one write: a notice that whoever is signed in will not be at a gathering, whose day may not have come yet, with a reason written in their own words and offered the usual five as suggestions, which they may leave blank |
| `/admin-testimonies` | `src/admin/testimonies.jsx` | The community's testimonies, newest first, a hundred at a time, searched by date and by name — read by the browser straight from Supabase, which is why the names on those rows come from the roster rather than from a join |
| `/leader-dashboard` | `src/leader/Dashboard.jsx` | Headed **Leader**, the same roster read, in the same table and behind the same search box — and that is the whole page: no ⋮ menu on any row, so there is nothing here to give a role or take anybody out, and no join code, because this page never asks for the community row that carries it |
| `/leader-attendance` | `src/leader/attendance.jsx` | The same gatherings and the same per-gathering list the admin page shows, read-only — with the same notice at the top, because writing that one is what a member does about their own attendance, and a leader is a member first |
| `/leader-testimonies` | `src/leader/testimonies.jsx` | The same testimony list, search and exports, including writing **their own** testimony — which is what a member does, and a leader is a member first |
| `/member-dashboard` | `src/member/Dashboard.jsx` | The member's own screen, reached by opening a community you belong to: a notice that you will not be at the day's gathering (whose name the server reads back off the session, not a box you type), the check-in box that appears only while a session's window is open, and a standing read-only notice of what is live or scheduled in the fellowship |

`/community` is the page every successful sign-in lands on, from both `/login` and
`/signup`. It greets the visitor from their own `users` row and lists the communities
their `community_members` links point at. It is thin for now: the fellowship list, marking
attendance and logging testimonies are not built. It does prove the sign-in round trip
works, and it warns when the address has no `users` row. `/terms` is no longer a step in
the sign-up path; the terms remain reachable from the agree checkbox.

**Create Community** is a popup on this page, not a route.
`CommunityFetch.createCommunity(name)` in `src/page_functions/community.js` calls the
server twice — `community` `create`, then
`member` `create` with the `community_id` the first call returned — because that id does
not exist until the row does. The page then re-reads `getCommunities()` so the new card
appears, and Escape, the backdrop or Cancel closes the popup without writing anything. The
first response also carries `join_id`, which the database generates rather than the app —
see [Database](database.md) — and the confirmation names that code, which is also what the
admin dashboard of that community shows beside its roster.

Clicking a community card sends the visitor to the dashboard for their role in **that**
community. `CommunityFetch.navigateTo(community, email, navigate)` takes the whole card,
reads the `community_members` row for it through `/api/self` `member` `find`, then maps the
role — `admin` to `/admin-dashboard`, `leader` to `/leader-dashboard`, `member` to
`/member-dashboard` — and puts `{ community_id, name, email }` in the route state on the
way. Every screen behind that card is opened with the same three values, which
`adminState()` in `src/admin/state.js` builds and no page is allowed to shorten. The
dashboard reads the id and does nothing else with it: `AdminDashboardFetch` in
`src/page_functions/admin_dashboard.js` answers the roster with `getMembers(community_id)`
and the name and code with `getCommunity(community_id)`, and `changeJoinCode(community_id)`
asks `/api/admin` `admin` `changeCode` for a brand new code — the button on the page is
the only way to change it, there is no field to type into. Every roster row carries a ⋮
menu with **Assign role** and **Remove member** — except the row holding the signed-in
address itself, which carries nothing: this page changes other people, and it is neither how
an admin hands their own role on nor how they leave. The endpoint would still answer a
self-removal of a community that has more than one member; nothing in the app asks for it.
`removeMember(community_id, email)` unlinks that address
from this community and then draws a new code in the same action, so a removal cannot
leave the old code standing for somebody who memorised it. The popup spells out both
halves before anything is written, because the code that everyone else types changes too.
One search box sits above the list, on this page and on the leader's: a name or a surname, or
any words from both, matched case-blind against the roster
already read rather than asked of the server again, and it reports how many of the whole it
shows and offers a Clear. It does not match on the address, and it is not only the column that
is gone: matching an address would let the count of matches answer whether some address belongs
to this community.
There is no list of the other communities
on this page to switch between and no default to whichever row comes back first, because
that is how an admin ends up editing the wrong fellowship. Arriving without a chosen
community — a typed URL, a bookmark, a link that lost its state — opens the community this
browser administered last, which `rememberAdmin` writes down every time a screen shows one;
only a browser that has never opened a community says so and links back to `/community`.
On a landscape screen wide enough for two columns the join code sits to the right
of the roster, and it drops below the list on a narrow one. The leader dashboard,
`src/leader/Dashboard.jsx`, lays the same roster out without either of those two things: no
⋮ menu, and no code, because fetching the community row is what carries the code and a
leader has no use for it. The heading comes from the card that was clicked, the same three
values every other screen is opened with.
All three wait for the session the way the other signed-in pages do, and none of them sends
anybody to `/login` on its own. Two things keep the destination honest: the server answers
`member` `find` with the address on the caller's
own id token, so nobody can ask for another person's role, and `navigateTo` returns `null`
rather than navigating when there is no link at all — the page then says so instead of
dropping the visitor into a dashboard they have not earned.

## Email verification happens once, at creation

`sendEmailVerification` is called in `src/pages/create_account.jsx` and nowhere else.
Nothing gates on `emailVerified`: `/login` signs people in whether or not they clicked
the link, and `/community` no longer nags an unverified address. That is deliberate — the
congregation shares accounts, so a member who never clicked a link, or who signs in on a
phone or a borrowed device, still has to reach the app. Firebase keeps `emailVerified` on
the user and `Auth.current()` passes it through, so a leader-facing screen can show it as
a fact later without blocking anyone on it.

The trade worth knowing: nobody proves they read that inbox, so a sign-up at an address
the person does not own succeeds and holds a `users` row. If testimonies or attendance
ever become sensitive, revisit this rather than assuming the address was checked.

Every signed-in page carries the same slide-over, `src/components/menu.jsx`: a
hamburger in the top bar opens a panel with **Profile** and **Log out**. It closes on the
backdrop, its own close button, or Escape. Logging out calls `Auth.signOut()` and sends
the visitor to `/login`.

The three screens of one community — `/admin-dashboard`, `/admin-testimonies` and
`/admin-attendance` — take the panel through `src/admin/menu.jsx` instead, which is the same
slide-over with **Admin dashboard**, **Testimonies** and **Attendance** above Profile. The
leader has the same three, at `/leader-dashboard`, `/leader-testimonies` and
`/leader-attendance`, through `src/leader/menu.jsx`: one list of links, and nothing that a
leader cannot do is on it — the refusals are the function's, not the menu's, so hiding a
link is not what makes a leader read-only. Both sets of three are opened with one object,
`{ community_id, name, email }`, built by `adminState()`
in `src/admin/state.js`, and each set wears the same heading: **Admin**, or **Leader**, then
the community's name and the address. Each page hands that object to its menu unchanged and
hands the same
one to any link it makes itself, so moving between the three carries the community id and
the address with you. `src/member/Dashboard.jsx` is no longer a placeholder: it is the member's
own screen — the not-attending notice, the PIN check-in box, and a read-only notice of the
community's live and scheduled check-ins. `adminState` takes what the page has just read first, the route second
and what this browser last opened third — known beats linked beats remembered — so a screen
still knows which community it is on when a link arrives empty. `rememberAdmin` writes that
object down from every screen, which is what makes a reload, a bookmark and the back button
come back to the same community, and **Log out** calls `forgetAdmin()` so the next person
signed in on that browser is not shown somebody else's address. A screen only ever renders
an answer tagged with the community it was read for, so pressing the back button between two
communities, or a slow response arriving after the community changed, shows the loading line
rather than the previous community's roster — see [Findings](findings.md) finding 8. Where no
community is known at all — a browser that has never opened one — those three links are not
offered, because every one of them would open on nothing to show.

`/profile` posts `{ action: "user", params: { function: "update", changes: { name,
surname } } }`. The email field is rendered read-only because `users.email` is the
primary key that links every attendance and testimony row to a person, and moving a row
onto someone else's address would move their `community_members` links with it.

Pages do not talk to Supabase and do not hold a key — with one exception, written out below.
They call the fetch functions in `src/page_functions/`, one file per area — `user.js` for the
person's own row, `community.js` for the communities they belong to, `admin_dashboard.js` for
the roster and join code of a community, `attendance.js` for its gatherings — and each of
those goes through
`callGod(action, params)` in `src/page_functions/god.js`, which waits for `ready`, signs the
request with the caller's Firebase ID token from `getIdToken(auth.currentUser)` and posts it
to the endpoint whose auth tier owns the call — `/api/self`, `/api/leader` or `/api/admin` —
where `God.call()` in `lib/god.js` runs on the server. Nobody settles into a signed-out
visitor, so that first read of the session cannot be the slow one, and a request made while
signed out stops as `You are signed out, so this could not be loaded.` rather than as
`Cannot read properties of null (reading 'getIdToken')`. A page fetches from a listener that
has reported a person (see below), never from a mount effect that runs while the session is
still unknown — which is what made `/admin-dashboard` show that error. A new page read is a new method in the matching
`src/page_functions/` file, never a raw fetch written inside a page. That token is what the
endpoint verifies. A browser token is held to the whitelist of whichever door it knocked on —
**self**: `user` `find`/`create`/`update`, `community` `memberOf`/`create`/`join`, `member`
`find`/`create`, `event` `record`/`checkin`, `session` `open`/`live`; **leader**: `attendance`
`services`/`service`, `admin` `roster`, `session` `create`/`pin`/`manage`/`revise`; **admin**:
`admin` `changeCode`/`assign`, `member` `remove`, `community` `find` — and the email
is taken from the token rather than the
body, so a member can only ever list the communities they belong to and read the role they
hold in one. That allowlist says only that a browser may ask — and which door it may knock on;
a second test says who may be
answered, and it is settled by `roleGate` against the role in `community_members` for the
`community_id` in the request — a leader-tier call wants `leader` or `admin`, an admin-tier call
only `admin` — see below.
`member` `create` is checked further: the server reads `community_members` for that
`community_id` and refuses the write once the group has any members, and it overwrites
`role` with `admin`, so a browser can attach itself only to a community it has just opened,
never into an existing one where it would take over other people's attendance.

**The pages that read Supabase themselves** are `/admin-testimonies` and its leader copy,
`/leader-testimonies`.
`src/page_functions/testimonies.js` builds a client in the browser out of `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY`, both of which Vite inlines from `.env.local`, and asks that table
for the community's testimonies directly — no id token, no action name, no server class. Two
consequences are worth knowing before another read is written this way. The anon key is public
by design and `testimony` has no row level security, so the key this page holds can list and
change any community's testimonies from outside it: the `community_id` in the query is what the
screen asks for, not a permission, and the role check that guards every other read guards
nothing here. And `users` *does* have row level security, so the same read cannot see who gave
a testimony — measured today, that key is answered 467 rows of `testimony` and none of `users`.
Attendance is a server read for exactly that reason: `src/functions/attendance.js` runs on the
service key, where the join works and the names arrive.

Names are the one thing that read cannot give, so the page asks for them the way the export
always has: `admin` `roster` — the server read, which answers a leader or an admin of that
community and nobody else — for the community's
people, joined onto the rows by address in this file. That is what titles a testimony on screen
as well as what fills the name and surname columns of a file. Somebody removed since sharing is
not on the roster, and the card says **Someone who has left**: the address the row carries is the
one thing that must not reach the screen, because it is that person's own to keep. The same rule
holds for the file — the name and surname cells of such a row are left empty rather than filled
with the address. When the roster cannot be read the testimonies still come, everyone of them
unnamed; only a search by name is refused, because there would be nobody to match it
against.

The search is those names and those dates together. A word typed as a name is matched against
every roster entry's name, surname and address, and the read is then narrowed with `in` on
`user_email` to the addresses it picked out, so a word that matches nobody is an empty list and
not the full one; how many people it picked out comes back as `matched`, which is what lets the
page say "nobody here answers to that" instead of "nothing was shared". The same search is what
the file is written out of (`gte`/`lte` on `testimony.date`, either bound able to stand alone),
so the sheet and the screen answer for the same people on the same days; the writer walks every
page of it rather than only the hundred on screen, and the name goes into the file's own name
and into the line under the count on its first page.

The same page also writes: `addTestimony` inserts on the same browser client, and it takes the
`community_id` and the `user_email` from the caller rather than from the popup, which only ever
offers a day and some words. That is the whole of the popup's contract — a testimony is
recorded against whoever is signed in, in the community on screen — and it is why neither field
is in the form.

`admin` and `attendance` are the actions that do not name a table. Every class in
`src/functions/` is one table's record — `user.js`, `community.js`, `community_members.js` —
and `God.#case` maps an action onto one of them, so the reads that belong to a screen rather
than to a row get a class of their own: `admin_dashboard.js` answers `roster`, which joins
`community_members` onto `users` for one `community_id`, and `changeCode`, which draws a join
code and writes it, and `attendance.js` answers `services` — the gatherings, counted out of
more rows than one read returns — and `service`, one gathering with everyone recorded at it.
Nothing about those describes the caller, so they are gated on the caller's link instead —
and on two different answers, because reading about people and changing them are not the
same permission. The server looks up the role the caller's own token address holds in that
`community_id` once, then settles the request on it:

| Asked by a browser | Link the lookup has to find |
| --- | --- |
| `admin` `roster`, `attendance` `services` and `service` | `leader` **or** `admin` |
| `admin` `changeCode` and `assign`, `member` `remove`, `community` `find` | `admin` |

`admin` `roster` is matched on the leader tier first, deliberately: it is an `admin` action,
so a rule that asked the admin test of everything under that action would refuse a leader the
one read the role exists for. `community` `find` is on the admin tier for one reason — the row
it returns carries `join_id`, and the code is an admin's to show. So a leader of one community
is refused an admin of another everything, and a leader is refused a change in their own. The
lookup cannot be
argued with: `params.email` is overwritten with the token address before it happens, and
those requests take a `community_id` rather than an email anyway. `session` splits across the two
doors: `create`/`pin`/`manage`/`revise` sit on the leader tier behind the same `roleGate`, while
`open`/`live` sit on the self tier and ask only that the caller be a member of that community.
`event` opened exactly one write to a
browser — `record`, the not-attending notice at the top of both attendance pages — and because
it describes the caller rather than anybody else it is not gated on the leader or admin tier:
any role's link in that `community_id` answers it, since a leader or an admin is a member
first. What the request cannot decide is the address (the token's), the answer (always `false`) or
the gathering — `event` `record` now reads that name back off the session opened for the day, so a
day with no session, or with more than one, is refused rather than guessed, and there is no gathering
box on the page any more — or
the columns (so a `recorded_by`, a `session_id` or a latitude in the
body is dropped); a reason may be left out, which stores `null`, and when one is given it is the
caller's own wording — the function no longer matches it against the five, so the only thing that
can still refuse a phrase is the column's own check constraint, which
`Documentation-site/docs/database.md` documents as dropped. The one refusal is a gathering already
recorded as present: a yes is never taken back. The `testimony` action left the old `api/god.js`
monolith (since split into `api/self.js`, `api/leader.js` and `api/admin.js`) along with
`src/functions/testimony.js` when that page started reading the table
itself; the only server call it makes now is the `roster` one above, which the leader tier
opens as well.

Both tiers were asked of the live function today with a real Firebase ID token — one address
placed as `leader` of one throwaway community and `admin` of another. Read as a leader it came
back `200` for `roster` and `services` and `403` for `changeCode`, `assign`, `remove` and
`community find`, with that community's `join_id` and the target's role re-read from the table
to prove nothing was written; the same six requests on the community it administers all came
back `200`, which is what shows the refusals answer the role and not the shape of the request.
Put in as a plain `member`, `roster` and `services` were both refused — the leader tier did not
open those reads to everybody. The probe rows and the sign-in account were deleted afterwards,
and the real community re-read at 50 people and the same code.

Removing somebody is the one table-level action that names another person, so the target
arrives as `params.member_email` and only becomes `params.email` — what
`CommunityMember.remove` deletes on — after the caller has been shown to be an admin of that
community. Three things sit between the two: an address with no link in that community is a
`400` rather than a silent no-op, one admin cannot delete another's row, and the last member
cannot be removed at all. The second is what stops any admin from emptying a group of its
managers; the third is what keeps the `member` `create` check honest, since that only refuses
a browser once a community has members, and a community drained to zero would be waiting for
whoever guessed its id to join it as admin. For `update`, `SELF_FIELDS` keeps only `name` and
`surname` on a user and drops every other key from
`changes`, so the allowlist lives on the server and not in the form. `community` has no
entry there because **a join code is never read off a request**: `changeCode` draws one on
the server with `generateJoinId()` in `src/functions/admin_dashboard.js`, and writing a code
somebody typed by hand needs `GOD_SERVER_KEY`. Anything outside all of this needs
`GOD_SERVER_KEY` too. See
[Finding 7](findings.md#7-apigod-rejected-every-genuine-firebase-id-token-fixed) for the
bug that made the endpoint reject every token until 2026-11-14, and the rest of what it
still exposes.

## One Firebase instance, and the session outlives the tab

`src/firebase.js` is the only place that builds a Firebase app, and `login.jsx` and
`forgot_password.jsx` used to build a second config from `VITE_FIREBASE_*`. Both called
`getApps().length ? getApp() : initializeApp(...)`, so whichever module the bundler ran
first owned the default app — same values, but a coin toss for the storage key the session
is kept under, and a real `app/duplicate-app` throw the moment one of them stopped
checking. Every page and every `src/page_functions/` file now imports `auth` from that one
module, so there is a single instance and one place for the config to be wrong.

`setPersistence(auth, browserLocalPersistence)` runs in the same module, because the
default is IndexedDB and a browser that refuses it silently drops to memory-only: you
appear signed in until the next reload, which looks exactly like the app signing people
out. The rejection is logged rather than swallowed, and the promise is exported as `ready`.
`Auth.onChange` waits for `ready` before attaching `onAuthStateChanged`, so a slow storage
read is never reported as a signed-out visitor. It then reports a **change of person and
nothing else**: the first settled callback always goes through, and after that the listener
is silent while the same uid, or the same nobody, comes round again. Firebase re-reports the
signed-in user whenever it reloads the account, and a page that navigates or fetches in its
listener would fetch or redirect again on every one of those — which is what made the app
look like it kept checking and kept refreshing. That is the only auth listener in the app —
`/login` uses it too rather than calling `onAuthStateChanged` itself, so no page can see a
state from before storage settled. A page reads its own data from inside that listener, or
from an effect gated on the **address** it reported — never on the session object, which is
rebuilt on every report, and never from mount alone; the dashboards and `/profile` do exactly
that.

**No page navigates to `/login` on its own.** Every signed-in screen used to: a settled null
sent the visitor there, so a browser that could not read its saved session was thrown out of
whatever it was looking at, and `/login` throws a session-holder straight back to
`/community`. Two pages answering the same fact in opposite directions is how one reload
turned into a bounce between them. A null now leaves the person where they are and the screen
says what it knows — *this browser holds no saved session* — with a link to `/login` that
only moves when they click it. `Log out` in the menu is still the only call to `signOut()`
anywhere in `src/`, and it is the only automatic trip to `/login` left; `/signup` sends a
person there when an address is already taken, and `/login` forwards a visitor who still
holds a session straight to `/community`, which cannot loop now that nothing sends anybody
the other way.

## The `Auth` class

```js
import { Auth } from './functions/auth.js'

const auth = new Auth()

await auth.signUp('member@example.com', 'a password')
const session = await auth.signIn('member@example.com', 'a password')
auth.current()                       // { uid, email, emailVerified, displayName } or null
const stop = auth.onChange((user) => render(user))   // returns an unsubscribe function
const token = await auth.idToken()   // null while signed out
await auth.signOut()
```

`signUp` and `signIn` reject with a `FirebaseError` carrying a `code`. Map those to
messages in the UI rather than showing `error.message`; the common ones are
`auth/email-already-in-use`, `auth/weak-password`, `auth/invalid-credential`,
`auth/too-many-requests` and `auth/user-not-found`.

Name and surname are deliberately **not** stored on the Firebase account. They belong
in the `users` table, keyed by email, so `displayName` stays empty and the database
remains the single source of who someone is.

## Analytics was left out

The snippet from the Firebase console includes `getAnalytics(app)`. It is not in
`src/firebase.js`, because `getAnalytics` throws outside a browser and `api/`
functions import from the same tree. The `measurementId` is kept in the config so
analytics can be added later with the documented `isSupported()` guard.

## How a Firebase login reaches the data

Two problems to solve before this is a working system.

**1. Supabase row level security cannot see a Firebase user.** RLS policies test
`auth.uid()` against a Supabase-issued JWT. A Firebase token means nothing to it, so a
request from a signed-in browser still arrives as "whoever holds the anon key". No
policy of the form "members may read their own attendance" is expressible today. The
two ways out:

- Enforce permissions in `api/` functions: verify the Firebase token server-side, then
  query with `SUPABASE_SERVICE_ROLE_KEY`. This keeps the service key off the browser
  and puts the rules in one reviewable place. Recommended, and what the existing
  `user.js` and `community_members.js` classes are already shaped for.
- Or move login to Supabase Auth, which makes the RLS policies in
  [Findings](findings.md) straightforward but abandons Firebase. Worth deciding now
  rather than after the UI exists.

Either way, keep `event` and `testimony` RLS-enabled so the anon key stops returning
1000 attendance rows and 242 testimonies to any visitor.

**2. The 50 existing members have no accounts.** `users` holds 50 rows reached through
`community_members`, but there is no Firebase identity for any of them, and the
passwords were never stored here. Existing rows cannot log in until accounts are
created for those emails — normally an invite flow that sends a setup link, not a
sign-up form they have to guess.

And a new sign-up must create its `users` row plus a `community_members` row or the
person exists in Firebase but has no data. That write has to go through `api/`, since
`users` has RLS enabled and would reject an anon-key insert from the browser.

## Security note on the config file

`apiKey`, `appId` and the other values in `src/firebase.js` are public by design and
are shipped to every visitor; that is normal for a Firebase web app. It does not make
the app secure, any more than the Supabase anon key does. What protects the project is
provider settings, authorized domains and server-side permission checks.
`src/firebase.js` is safe to commit; the Supabase service-role key is not, and appears
only in the git-ignored `.env.local`.
