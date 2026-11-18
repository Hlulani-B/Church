# Onboarding and guides

A first-timer who opens the admin dashboard should not have to leave it to work out what the
buttons do. Every signed-in page carries the same small onboarding system: a role-aware **Guide**
panel inside the menu, an automatic first-visit open, and a **toast** that confirms a check-in
landed. None of it needs a manual and none of it needs the network.

## The Guide panel

`src/components/guide.jsx` exports one component and two helpers. The component takes a `role`
and an `open` flag; the content is a plain object keyed by role:

| Role key | Shown on | Heading |
| --- | --- | --- |
| `admin` | `/admin-dashboard`, `/admin-attendance`, `/admin-testimonies` | Running a fellowship |
| `leader` | `/leader-*`, `/take-attendance` | Taking attendance |
| `member` | `/member-dashboard` | Being in the room |
| `communities` | `/community` | Communities |
| `feedback` | `/feedback`, `/feedback/all` | Feedback |

Content lives in one file, keyed by role rather than by page. An admin who opens the Guide from
their dashboard and one who opens it from `/admin-attendance` see the same five steps, which is
the point: what they need to know is a fact about their role, not a fact about the screen they
are looking at.

### Auto-open once per role

The menu's mount effect checks a `localStorage` flag the first time it draws:

```js
useEffect(() => {
  if (!role) return;
  if (!shouldAutoOpen(role)) return;
  const t = setTimeout(() => setGuideOpen(true), 400);
  return () => clearTimeout(t);
}, [role]);
```

The 400 ms delay lets the page settle before the scrim slides in, so the first thing a new user
registers is the dashboard behind it, not a wall of text. `shouldAutoOpen` reads
`localStorage.getItem('kopano_guide_seen_' + role)`; `markSeen` writes `"1"`.

??? question "Why localStorage and not a column on `users`?"
    A "have you been shown an intro" flag is not a fact about the person, it is a fact about the
    device. A member who switches phones should probably see the guide again. A person who uses
    the app on a tablet and a laptop wants the guide on whichever one they are new to. Keeping
    it in `localStorage` also means no new column, no migration, and no write on a read path.

### Access is not one-shot

The auto-open is guarded by the flag; **the menu link is not**. Every signed-in page's menu has
`Guide` at the top of the list, and pressing it always works. Someone who dismissed the panel
six months ago and has since forgotten what **Change code** does can reopen it with two clicks.

## How a page picks its role

`src/components/menu.jsx` runs `inferRole()` on the current `window.location.pathname`:

```js
if (path.startsWith('/admin-'))   return 'admin';
if (path.startsWith('/leader-'))  return 'leader';
if (path.startsWith('/member-'))  return 'member';
if (path === '/community')        return 'communities';
if (path === '/feedback' || path.startsWith('/feedback/')) return 'feedback';
if (path === '/take-attendance')  return 'leader';
```

A page that lives inside that convention needs no code at all — mounting the menu is enough. A
page outside it (none currently, but `/qr` would be one if its landing screen ever grew a menu)
passes `guideRole="..."` on the `<Menu>` and the inference is skipped.

The alternative — every dashboard declaring its own role — would work, but it puts the mapping
in fourteen places instead of one. When a new page appears under `/admin-`, it gets its guide for
free.

## The toast bus

`src/components/toast.jsx` exports a `pushToast(...)` function and a `<ToastHost>` component.
`App.jsx` mounts one `ToastHost` above the router, and any component imports `pushToast`
directly. There is no context, no prop drilling and no subscription to remember.

```js
let listeners = new Set();
export function pushToast({ title, detail = '', life = 6000, delay = 0 }) {
  const id = Math.random().toString(36).slice(2);
  const fire = () => listeners.forEach((l) => l({ id, title, detail, life }));
  if (delay > 0) setTimeout(fire, delay);
  else fire();
  return id;
}
```

`ToastHost` adds itself to the set on mount and removes itself on unmount, keeping its own timer
map so unmounting clears pending fades. Toasts stack bottom-right, and go full-width on phones.

### Why the check-in toast is delayed by two seconds

`session_live.jsx` fires it right after `onMarked(session_id)` returns, but with `delay: 2000`:

```js
onMarked(one.session_id);
pushToast({
  title: came.already ? 'Already marked' : 'Register marked',
  detail: `${came.event_name || 'This gathering'} · ${clock(came.checked_in_at)}`,
  delay: 2000,
  life: 6000,
});
```

The card the user was standing on is removed the moment the write succeeds. An instant toast
would land on top of a disappearing card and read as a flicker; two seconds later, the removal
has settled and the notification confirms a screen that has already changed. Six seconds of
life is long enough to read twice and short enough not to hide anything underneath.

## Adding a new guide

1. Add a key to `CONTENT` in `src/components/guide.jsx`. The shape is
   `{ heading, intro, steps: [{ t, d }] }`.
2. If the pages it belongs to don't already match one of `inferRole()`'s branches, add a line
   there. Prefer matching an existing prefix (`/admin-*`) — a new prefix means the mapping stops
   being obvious.
3. Nothing else. The menu will pick up the auto-open, the Guide link and the modal without being
   told.

## The profile page

The menu's **Profile** link — present on every signed-in page — opens `/profile`, which is
deliberately not just a name-edit form. Three things live there:

- **Name and surname.** The only columns the browser may write on the `users` row; the
  address is shown read-only, with a note about who to ask if it is wrong.
- **Send me a reset link.** Calls `Auth.resetPassword()`, which hands
  `sendPasswordResetEmail` the currently signed-in Firebase user rather than any address
  typed into a form. This is different from `/forgot-password`, which is for somebody who
  cannot sign in at all and has to enter their email by hand — the only two paths to the
  same Firebase call, each appropriate to the state the person is actually in.
- **Your communities.** Every fellowship this address belongs to, listed with the caller's
  own role beside each, straight off `Community.memberOf`. Clicking one navigates to the
  dashboard its role maps to without the round trip `/community` has to make (that page's
  cards do not carry the role, so it asks `member` `find` on click). Anyone with more than
  one community used to have to go back through `/community` to move between them.

The last block on the page is the one link to `/feedback` that does not live in the menu —
a signed-in person looking for it is usually already halfway through a task, and Profile is
the page they open when the task has gone badly.

## What a guide is not

It is not documentation for a shipped feature the user has to search for. Anything more than
seven short steps belongs on this site. The in-app guide exists so a first-timer can get to
their first real action — open a check-in, join a community, mark the register — without
leaving the page they are on.
