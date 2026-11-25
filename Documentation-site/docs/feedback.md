# Feedback

The feedback table is the app's only **cross-community** data: one `feedback` table, not one per
fellowship, and **every signed-in person can read every row**. That decision shapes everything
else on this page — the schema, the tier it lives on, and the wording on the form.

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
- No foreign key on `email` — the column is nullable, so the table *could* hold an unsigned row.
  Nothing writes one any more: the address is the submitter's own and the class refuses a request
  that arrives without it.
- No cascade — the feedback survives the person. If somebody deletes their account, the row
  stays, because it is signal about the product rather than a record about a person. That
  survival is the reason the column has no foreign key to `users`.

## Signed, and unsigned in the UI

One rule runs through the whole feature, and it is easy to get backwards:

| | Rating, dates, the three answers | The author |
| --- | --- | --- |
| **In the database** | yes | **the address** — from the ID token, on every row |
| **In an export (`.xlsx` / `.pdf`)** | yes | **the name and surname** — a `Submitted by` column, never an address |
| **On `/feedback/all`, on any dashboard, in any tooltip** | yes | **nobody at all** |

The address exists so the pile is a record of what real accounts said rather than a wall of
unverifiable opinions, and it is written from the token rather than the body, so it cannot be forged.
It is not, however, what a reader is handed. The app keeps each person's sign-in for that person
alone, so `Feedback.all` matches the addresses on the page against one `users` read and returns
`submitted_by` — the two names that row holds — with the bare address left on only the caller's own
note. A page and a download are held to the same rule, because a file is a screen somebody else ends
up reading.

There is no checkbox. An earlier cut of the form offered "include my email so a reply is possible"
and left the column `null` when it was off; that made the honest pile sparse, and a table whose
rows cannot be traced to an account is not evidence of anything. The trade is stated plainly on
the form itself, above the submit button, rather than being something a person finds out later.

## Both doors, one endpoint

The table has no `community_id`, so the ordinary `roleGate` — which asks *"is this caller a
leader/admin of the community in the body?"* — has nothing to check. Rather than invent a
gate, the whole action sits on the self tier: both writing a row and reading them back need
only a signed-in browser.

### Submit

`feedback: ['create', 'all']` is on the SELF whitelist. The handler in `api/self.js` needs no
feedback-specific branch any more, because it already does the one thing this table requires of
every action:

```js
params = { ...params, email };   // `email` came from the verified ID token, not the body
```

The `email` on the row is therefore the one the **Firebase ID token carried**, never the one the
body named — a browser that submits `email: "somebody.else@example.com"` alongside a feedback form
gets its own address written instead. Nothing downstream is allowed to blank it: `Feedback.create`
in `src/functions/feedback.js` answers a request with no address with a 400 that names the reason,
so an unsigned row cannot arrive by some path nobody thought about.

### Read

`feedback` `all` needs no gate beyond the sign-in itself: anyone who uses the app is allowed to
see what the rest of them have said about it. That is a deliberate change from the first cut of
the feature, which put the read behind *"are you an admin of at least one community"*. The pile
is about Kopano, not about a fellowship, so restricting it to the small set of people who
administer one was the wrong shape — the people whose problems the app is supposed to solve are
exactly the people who should be able to see whether the app has solved them.

The tier map on the browser side, `TIER` in `src/page_functions/god.js`, reflects the same
single door:

```js
feedback: 'self',
```

Both calls go to `/api/self`, and the browser cannot pick a different one — `/api/admin` does
not carry `feedback` at all anymore, so a body that names the admin endpoint is refused by the
whitelist before it reaches the dispatcher.

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

`all({ limit, email })` is capped at 500 rows per read, ordered by `created_at desc`, and it is the
one method on this class that reads a second table: the addresses on the page are matched against one
`in` over `users` so each row can leave as `submitted_by`, and `email` — always the token's, which
`api/self.js` writes into every browser request before the dispatcher runs — decides whose own
address is kept on the way out. The page that uses it today fits well inside the cap; if the pile
grows, the next step is a cursor on `id`.

## The pages

**`/feedback`** (`src/pages/feedback.jsx`) is a submit form mounted from `App.jsx`, reachable
from the **Feedback** link at the bottom of every page's menu. It holds:

- Five stars, one button each — a rating you can read at a glance on a phone.
- *Does it solve your problem?* yes / no.
- Three optional textareas: what to improve, what to add, what was most challenging.
- A plain statement, not a control: the note is signed with the address you signed in with, and
  that address is never printed next to your words.

After a successful submit the form is replaced by a thank-you panel and the button is dead for
the remainder of the visit — the table has no "my submissions" view and there is no reason to
spam the same person with a second form if they navigate back.

**`/feedback/all`** (`src/pages/feedback_list.jsx`) is the read side, and every signed-in
member can open it — from the **See everyone's notes** item on the feedback page, from the
**Read feedback** button on an admin dashboard, or by typing the URL. It lists every row, newest
first, with three summary counts at the top:

- Total submissions.
- Mean rating, one decimal.
- Percentage who answered *yes* to *solves_problem*.

Each row shows its stars, the date, its yes/no, and any of the three text fields that came back
non-null. Nothing on the page identifies a person at all: the note is about the app, the pile is read
by people who have never met its authors, and the one place a name appears is the `Submitted by`
column of a file somebody chose to download.

!!! info "The read is where the rule is settled"
    The page renders no address because the *response* carries none to render. `Feedback.all` names
    every row before it leaves the server and drops the address unless it belongs to the caller, so
    an address a browser was never sent cannot be printed by that browser — in a table cell, in a
    tooltip, or in a file built from the same read. This closes what used to be an open question here:
    "not displayed" used to be a statement about the interface and nothing about the transport.

## Exports

The pile page carries two buttons: **Export Excel** and **Download PDF**. They are not a feedback
feature so much as a second use of the writers that produce testimony exports, which is why
`src/page_functions/table_files.js` takes a column list instead of knowing what a table looks
like; `FeedbackFetch` names seven columns and the rest follows.

| Column | In the file | On the screen |
| --- | --- | --- |
| Rating | `4/5` as text | stars, drawn |
| Submitted by | **the name and surname — in the file only** | not rendered |
| Submitted | date and time, as the reader's locale renders them | the same, top right of each card |
| Solved problem | `yes` / `no` | same |
| Most challenging / Improvements / Missing | one column each, wrapped, never merged | three blocks under the header, each omitted when empty |

The two formats carry the same seven columns; the difference is that a file is an artefact
somebody chose to download and a page is what everybody sees on the way past.

Three things about the write path are worth stating plainly:

- **It never leaves the browser.** The file is assembled from bytes already fetched; there is no
  `/api` route for an export, nothing is uploaded, and a download works on a train with no signal
  once the page is open. See [File exports](dependencies.md#file-exports) for why no library does
  this.
- **The export re-reads the table.** Pressing the button asks for the pile again at the same
  500-row cap, so the file matches the question "what is in there now" rather than "what was on
  my screen when I arrived". Empty pile, empty click: the writer refuses with a sentence instead
  of producing a file with a header row in it.
- **A file with names in it has no access control.** That is still the point of it — it is the
  version that can be handed over as evidence — and it is also why the button is on a page rather
  than in a scheduled report: somebody has to decide to take the pile with them. What it no longer
  carries is a sign-in. The rule that an email address belongs only to the person it names is
  enforced at the read, so a download cannot leak what the server never sent.

## Deliberate limits

- **No per-community view.** Any reader sees submissions from people who have never heard of
  their fellowship. This is uncomfortable on purpose; splitting the table by `community_id`
  would make the numbers tidier and the signal worse.
- **No edit or delete.** Once a submission is in, nobody can change it — not the author, not an
  admin. A delete would let a bad week's feedback be quietly tidied away.
- **No moderation queue.** Because the pile is open to every signed-in reader, the discipline
  is social rather than technical: whatever you write can be read by your own fellow-members,
  so write what you would say out loud. The submit page says this at the top.
- **A reply is possible in the database and nowhere in the app.** The address is on every row, so
  whoever can read the table can answer a note; there is no reply form, no inbox and no "we'll be in
  touch" copy, and the exports no longer carry the address. If a reply happens it is arranged outside
  the app by somebody with more access than a download.
- **The naming read is app-wide, the way the table is.** One `in` over `users` answers for every note
  on the page, and `users` knows nothing about which fellowship an address belongs to — so a name can
  reach a reader who has never shared a community with the person who wrote it. That is what a
  cross-community pile costs, and the alternative was the address itself.
