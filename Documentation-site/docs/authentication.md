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
| `/login` | `src/pages/login.jsx` | Firebase sign-in and Google sign-in; no email-verification gate |
| `/signup` | `src/pages/create_account.jsx` | Creates the account, then the `users` row through `/api/god`, then on to `/community` |
| `/forgot-password` | `src/pages/forgot_password.jsx` | `sendPasswordResetEmail`, with a resend button |
| `/terms` | `src/pages/TCs.jsx` | The policy text, linked from the agree checkbox on `/signup` |
| `/community` | `src/pages/community.jsx` | The signed-in home page: reads the visitor's own `users` row and greets them |
| `/profile` | `src/pages/profile.jsx` | Changes **name and surname only**, through `/api/god` `user` `update` |

`/community` is the page every successful sign-in lands on, from both `/login` and
`/signup`. It greets the visitor from their own `users` row and lists the communities
their `community_members` links point at. It is thin for now: the fellowship list, marking
attendance and logging testimonies are not built. It does prove the sign-in round trip
works, and it warns when the address has no `users` row. `/terms` is no longer a step in
the sign-up path; the terms remain reachable from the agree checkbox.

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

Both signed-in pages carry the same slide-over menu, `src/components/menu.jsx`: a
hamburger in the top bar opens a panel with **Profile** and **Log out**. It closes on the
backdrop, its own close button, or Escape. Logging out calls `Auth.signOut()` and sends
the visitor to `/login`.

`/profile` posts `{ action: "user", params: { function: "update", changes: { name,
surname } } }`. The email field is rendered read-only because `users.email` is the
primary key that links every attendance and testimony row to a person, and moving a row
onto someone else's address would move their `community_members` links with it.

Pages never talk to Supabase and never hold a key. They call the fetch functions in
`src/page_functions/`, one file per area — `user.js` for the person's own row,
`community.js` for the communities they belong to — and each of those goes through
`callGod(action, params)` in `src/page_functions/god.js`, which signs the request with the
caller's Firebase ID token from `getIdToken(auth.currentUser)` and posts it to `/api/god`,
where `God.call()` runs on the server. A new page read is a new method in the matching
`src/page_functions/` file, never a raw fetch written inside a page. That token is what
`api/god.js` verifies. A
browser token is held to `SELF_ACTIONS` — `user` `find`, `create` and `update`, plus
`community` `memberOf` — and the email is taken from the token rather than the body, so a
member can only ever list the communities they belong to. For `update`, `SELF_FIELDS`
keeps only `name` and `surname` and drops every other key from `changes`, so the allowlist
lives on the server and not in the form. Anything else needs `GOD_SERVER_KEY`. See
[Finding 7](findings.md#7-apigod-rejected-every-genuine-firebase-id-token-fixed) for the
bug that made the endpoint reject every token until 2026-11-14, and the rest of what it
still exposes.

One config caveat: `src/firebase.js` holds the hardcoded config and the pages under
`src/pages/` build theirs from `VITE_FIREBASE_*`. They name the same project, and both
now go through a `getApps().length ? getApp() : initializeApp(...)` guard, because a
second `initializeApp` on the default app throws `app/duplicate-app`. Whichever module
loads first owns the app, so keep the two in step until one source of truth wins.

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
