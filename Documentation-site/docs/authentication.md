# Authentication

Identity is Firebase Auth with email and password. Data stays in Supabase Postgres.
Those are two separate systems, and the pages below describe how they meet.

| Concern | System | Where the code lives |
| --- | --- | --- |
| Account, password, session | Firebase Auth (`kopano-a0554`) | `src/firebase.js`, `src/functions/auth.js` |
| Person record, name, surname | Supabase `users` | `src/functions/user.js` |
| Role in a community | Supabase `community_members` | `src/functions/community_members.js` |
| Attendance, testimonies | Supabase `event`, `testimony` | `src/functions/event.js`, `src/functions/testimony.js` |

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
| `/signup` | `src/pages/create_account.jsx` | Creates the account, then the `users` row through `/api/god`, then on to `/community` |
| `/forgot-password` | `src/pages/forgot_password.jsx` | `sendPasswordResetEmail`, with a resend button |
| `/terms` | `src/pages/TCs.jsx` | The policy text, linked from the agree checkbox on `/signup` |
| `/community` | `src/pages/community.jsx` | The signed-in home page: greets the visitor from their own `users` row, lists their communities and opens new ones from a popup |
| `/profile` | `src/pages/profile.jsx` | Changes **name and surname only**, through `/api/god` `user` `update` |
| `/admin-dashboard` | `src/admin/Dashboard.jsx` | Roster of **the community you clicked** — name, surname, email and role from `users` joined onto `community_members` — with that community's join code beside it to copy or draw again, and a ⋮ menu on every row to remove that person |
| `/leader-dashboard` | `src/leader/Dashboard.jsx` | Placeholder leader screen, reached by opening a community you lead |
| `/member-dashboard` | `src/member/Dashboard.jsx` | Placeholder member screen, reached by opening a community you belong to |

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
community. `CommunityFetch.navigateTo(community_id, email, navigate)` reads the
`community_members` row for that pair through `/api/god` `member` `find`, then maps the
role — `admin` to `/admin-dashboard`, `leader` to `/leader-dashboard`, `member` to
`/member-dashboard` — and puts the `community_id` in the route state on the way. The
dashboard reads that id and does nothing else with it: `AdminDashboardFetch` in
`src/page_functions/admin_dashboard.js` answers the roster with `getMembers(community_id)`
and the name and code with `getCommunity(community_id)`, and `changeJoinCode(community_id)`
asks `/api/god` `admin` `changeCode` for a brand new code — the button on the page is
the only way to change it, there is no field to type into. Every roster row carries a ⋮
menu with **Remove member**, and `removeMember(community_id, email)` unlinks that address
from this community and then draws a new code in the same action, so a removal cannot
leave the old code standing for somebody who memorised it. The popup spells out both
halves before anything is written, because the code that everyone else types changes too.
There is no list of the other communities
on this page to switch between and no default to whichever row comes back first, because
that is how an admin ends up editing the wrong fellowship; arriving without a chosen
community — a typed URL, a bookmark — says so and links back to `/community` instead of
guessing. On a landscape screen wide enough for two columns the join code sits to the right
of the roster, and it drops below the list on a narrow one. The two other dashboards,
`src/leader/Dashboard.jsx` and `src/member/Dashboard.jsx`, are still placeholders. All
three redirect signed-out visitors like the other signed-in pages do. Two things keep the
destination honest: the server answers `member` `find` with the address on the caller's
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

Every signed-in page — `/community`, `/profile` and the three dashboards — carries the
same slide-over menu, `src/components/menu.jsx`: a
hamburger in the top bar opens a panel with **Profile** and **Log out**. It closes on the
backdrop, its own close button, or Escape. Logging out calls `Auth.signOut()` and sends
the visitor to `/login`.

`/profile` posts `{ action: "user", params: { function: "update", changes: { name,
surname } } }`. The email field is rendered read-only because `users.email` is the
primary key that links every attendance and testimony row to a person, and moving a row
onto someone else's address would move their `community_members` links with it.

Pages never talk to Supabase and never hold a key. They call the fetch functions in
`src/page_functions/`, one file per area — `user.js` for the person's own row,
`community.js` for the communities they belong to, `admin_dashboard.js` for the roster and
join code of a community they administer — and each of those goes through
`callGod(action, params)` in `src/page_functions/god.js`, which signs the request with the
caller's Firebase ID token from `getIdToken(auth.currentUser)` and posts it to `/api/god`,
where `God.call()` runs on the server. A new page read is a new method in the matching
`src/page_functions/` file, never a raw fetch written inside a page. That token is what
`api/god.js` verifies. A browser token is held to `SELF_ACTIONS` — `user` `find`, `create`
and `update`, `community` `memberOf`, `create` and `find`, `member` `find`, `create` and
`remove`, and the whole of `admin` — and the email is taken from the token rather than the
body, so a member can only ever list the communities they belong to and read the role they
hold in one.
`member` `create` is checked further: the server reads `community_members` for that
`community_id` and refuses the write once the group has any members, and it overwrites
`role` with `admin`, so a browser can attach itself only to a community it has just opened,
never into an existing one where it would take over other people's attendance.

`admin` is the action that does not name a table. Every class in `src/functions/` is one
table's record — `user.js`, `community.js`, `community_members.js` — and `God.#case` maps an
action onto one of them, so the two reads that belong to a screen rather than to a row get
their own class in `src/functions/admin_dashboard.js`: `roster`, which joins
`community_members` onto `users` for one `community_id`, and `changeCode`, which draws a join
code and writes it. Nothing about either describes the caller, so the whole action is
admin-gated, along with the two table reads that also speak about other people — `community`
`find` and `member` `remove`. The server looks up the role the caller's own token address
holds in that `community_id` and answers `403` unless it is `admin`. The lookup cannot be
argued with: `params.email` is overwritten with the token address before it happens, and
those requests take a `community_id` rather than an email anyway.

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
read is never reported as a signed-out visitor. That is the only auth listener in the app —
`/login` uses it too rather than calling `onAuthStateChanged` itself, so no page can see a
state from before storage settled. Log out in the menu is the only call to `signOut()`
anywhere in `src/`, and `/login` reads the session too: arriving there while signed in goes
straight to `/community` instead of asking for credentials again.

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
