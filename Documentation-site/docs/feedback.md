# Feedback

The feedback table is the app's only **cross-community** data: one `feedback` table, not one per
fellowship, and every admin can read every row. That decision shapes everything else on this page
— the schema, the tier split, and the wording on the form.

## The table

```sql
CREATE TABLE feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  email TEXT,
  solves_problem BOOLEAN NOT NULL,
  improvements TEXT,
  additions TEXT,
  most_challenging TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Note what is **not** here:

- No `community_id` — a submission is about the app, not about a fellowship. The person who
  wrote it might belong to three.
- No foreign key on `email` — the column is nullable, and a `null` row is anonymous *by design*,
  not by omission. The submitter ticked "keep this anonymous" and the server honoured that.
- No cascade — the feedback survives the person. If somebody deletes their account, the row
  stays, because it is signal about the product rather than a record about a person.

## Two doors, one table

Because the table has no `community_id`, the ordinary `roleGate` — which asks *"is this caller a
leader/admin of the community in the body?"* — has nothing to check. The write and the read take
different endpoints for that reason.

### Submit — `/api/self`

`feedback: ['create']` is on the SELF whitelist, so any signed-in member can post. The handler
in `api/self.js` then does one thing that is easy to miss and matters more than it looks:

```js
if (action === 'feedback' && params.function === 'create') {
  params = { ...params, email: params.include_email ? email : null };
  delete params.include_email;
}
```

The `email` on the row is the one the **Firebase ID token carried**, never the one the body
named. A browser that submits `email: "somebody.else@example.com"` alongside a feedback form
gets its own address written instead, or `null` if it left the checkbox off. `include_email` is
deleted from the params so it cannot reach the insert and get refused by an unknown-column error.

### Read — `/api/admin`

`feedback: ['all']` sits on the ADMIN whitelist, but with its own branch that bypasses the
per-community role gate:

```js
if (action === 'feedback' && params.function === 'all') {
  const links = new CommunityMember(god.url, god.key);
  const everywhere = await links.all({ email });
  if (!everywhere.some((one) => one.role === 'admin')) {
    return res.status(403).json({
      error: 'only an admin of at least one community can read the feedback pile',
    });
  }
  return finish(god, action, params, null, res);
}
```

The check is *"are you an admin of any community"*, not *"of this one"*, because there is no
*this one* on an app-wide table. `finish(..., null, ...)` skips the `community_id` the normal
gate would demand.

The tier map on the browser side, `TIER` in `src/page_functions/god.js`, matches:

```js
feedback: (fn) => (fn === 'all' ? 'admin' : 'self'),
```

So `callGod('feedback', { function: 'create', ... })` goes to `/api/self` and
`callGod('feedback', { function: 'all' })` goes to `/api/admin`, and the wrong door is refused
by the whitelist before it can borrow the right door's power.

## The submitter's function

`src/functions/feedback.js` exports a `Feedback` class in the same shape as every other
functions class — one constructor that takes `(url, key)` so the dispatcher in `lib/god.js` can
instantiate it uniformly:

```js
case 'feedback':
  return { class: Feedback, keys: [] };
```

Its `create(...)` method is where the input is normalised:

| Field | Rule |
| --- | --- |
| `stars` | must be an integer 1–5; anything else is a 400 before the network is touched |
| `solves_problem` | must be `true` or `false`; a missing answer is a 400, not a `null` |
| `improvements` / `additions` / `most_challenging` | trimmed; empty string becomes `null` |
| `email` | lowercased and trimmed if present; `null` stays `null` |

The DB check on `stars` is real (`CHECK (stars BETWEEN 1 AND 5)`) and the class does not
duplicate it out of paranoia — it duplicates it so that a bad request fails at 400 with a
message that names the field, rather than at `23514` with a message that names a constraint.

`all({ limit })` is capped at 500 rows per read, ordered by `created_at desc`. The page that
uses it today fits well inside that; if the pile grows, the next step is a cursor on `id`.

## The pages

**`/feedback`** (`src/pages/feedback.jsx`) is a submit form mounted from `App.jsx`, reachable
from the **Feedback** link at the bottom of every page's menu. It holds:

- Five stars, one button each — a rating you can read at a glance on a phone.
- *Does it solve your problem?* yes / no.
- Three optional textareas: what to improve, what to add, what was most challenging.
- One checkbox: **Include my email so the team can reply**. Off by default.

After a successful submit the form is replaced by a thank-you panel and the button is dead for
the remainder of the visit — the table has no "my submissions" view and there is no reason to
spam the same person with a second form if they navigate back.

**`/admin-feedback`** (`src/admin/feedback.jsx`) is the read side. It lists every row, newest
first, with three summary counts at the top:

- Total submissions.
- Mean rating, one decimal.
- Percentage who answered *yes* to *solves_problem*.

Each row shows its stars, its yes/no, and any of the three text fields that came back non-null.
A row without an email is labelled *anonymous* rather than being left blank — the reader should
not have to know that `null` in this table is a choice rather than a missing value.

The admin dashboard has a fourth link, **Read feedback**, that navigates to `/admin-feedback`
without a community id in the state, because the pile is not scoped to one.

## Deliberate limits

- **No per-community view.** An admin reading the pile sees submissions from people who have
  never heard of their fellowship. This is uncomfortable on purpose; splitting the table by
  `community_id` would make the numbers tidier and the signal worse.
- **No edit or delete.** Once a submission is in, nobody can change it — not the author, not an
  admin. A delete would let a bad week's feedback be quietly tidied away.
- **No moderation queue.** Feedback is submitted straight into the pile. It is not shown to
  other members anywhere, so there is nothing to moderate.
- **The email is optional and only travels one way.** There is no reply form, no "we'll be in
  touch" copy, and no address in the bundle. If a reply ever happens, it happens outside the
  app.
