/*
  Which side of its own window a check-in sits on, and how far ahead of that window it is being
  looked at.

  Both questions used to be answered inside the dashboard card that shows them, which meant a second
  screen asking the same thing had to write its own copy and drift. They live here instead, as pure
  functions of the row and a moment, so the moment can be handed in rather than read off a clock and
  the rule can be tested without a browser.

  Nothing here decides whether a check-in is real. The window is enforced on the server when a PIN is
  typed (`src/functions/session.js`, and /api/self); this only says what a screen is allowed to say
  about a row it has already been handed.
*/

/*
  How far before its start a register that has not opened yet is still worth a card on somebody's
  dashboard: two hours. Inside that, the leader is choosing a radius and a window for a room they are
  standing in; outside it, the row is a plan made days ago and the dashboard is not a calendar. The
  card is held back rather than dropped — the same rows come back from `manage` either way, so the
  person who opened it can still reach it, and cancel it, from the collapsed line underneath.
*/
export const LEAD_MINUTES = 120

// Minutes until a register opens, rounded to the minute a reader would say out loud. Negative once
// the start has passed, and null for a row whose time cannot be read at all — a session with no
// usable window is a broken row, not an infinite wait.
export function minutesUntilStart(one, now = Date.now()) {
  const start = new Date(one?.started_at).getTime()
  if (Number.isNaN(start) || Number.isNaN(now)) return null
  return Math.round((start - now) / 60000)
}

/*
  Which side of its own window a session sits on. A called-off row answers first, because cancel is
  one-way and a cancelled session is not open no matter what its two times claim.

  The comparisons are deliberately the same ones the card has always made: `cancel === true` rather
  than truthy, since the column is nullable with no default and a seeded row reads as null. A row
  whose times cannot be parsed fails both comparisons and lands as `open`, which is what it did
  before — changing that here would quietly rewrite what a half-saved row looks like on screen.
*/
export function sessionStatus(one, now = Date.now()) {
  if (one?.cancel === true) return 'cancelled'
  if (new Date(one?.started_at).getTime() > now) return 'upcoming'
  if (new Date(one?.ended_at).getTime() < now) return 'ended'
  return 'open'
}

/*
  Whether a row is far enough ahead of itself to be kept off the dashboard: not cancelled, not
  running, not finished, and opening later than the lead window. A row with no readable time is
  never held back, because the only thing that can be said about it is that the screen cannot read
  it — and hiding a session whose window might be open right now is the worse error.
*/
export function isHeldBack(one, { now = Date.now(), lead = LEAD_MINUTES } = {}) {
  if (sessionStatus(one, now) !== 'upcoming') return false
  const ahead = minutesUntilStart(one, now)
  return ahead !== null && ahead > lead
}
