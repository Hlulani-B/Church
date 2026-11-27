import { describe, expect, it } from 'vitest'
import {
  LEAD_MINUTES,
  isHeldBack,
  minutesUntilStart,
  sessionStatus,
  waitUntilStart,
} from '../src/page_functions/session_timing.js'

/*
  What a dashboard is allowed to say about a check-in row, and nothing else. These three functions
  decide one real thing: whether a card stands on the leader and admin dashboards or folds into the
  line underneath it. Get the boundary wrong one way and a register opened for next Sunday keeps
  pushing today's gathering off the top of the screen with a PIN nobody is reading out yet; get it
  wrong the other way and a session that is live in the hall disappears from the page of the person
  who has to cancel it.

  `now` is handed in rather than read off a clock, which is the whole reason the helpers are not
  inside the card.
*/

const MIN = 60_000
const at = (iso) => new Date(iso).getTime()
const NOW = at('2026-11-27T08:00:00.000Z')

const row = (over = {}) => ({
  session_id: 's1',
  event_name: 'Sunday Service',
  date: '2026-11-29',
  started_at: '2026-11-29T09:00:00.000Z',
  ended_at: '2026-11-29T11:00:00.000Z',
  cancel: false,
  ...over,
})

describe('sessionStatus', () => {
  it('calls a row inside its window open', () => {
    expect(sessionStatus(row({ started_at: '2026-11-27T07:30:00.000Z', ended_at: '2026-11-27T09:30:00.000Z' }), NOW)).toBe('open')
  })

  it('calls a row before its window upcoming, and after it ended', () => {
    expect(sessionStatus(row({ started_at: '2026-11-27T09:00:00.000Z', ended_at: '2026-11-27T11:00:00.000Z' }), NOW)).toBe('upcoming')
    expect(sessionStatus(row({ started_at: '2026-11-27T05:00:00.000Z', ended_at: '2026-11-27T07:00:00.000Z' }), NOW)).toBe('ended')
  })

  it('answers cancelled first, whatever the two times claim', () => {
    // Cancelling is one-way, so a called-off window is never an open one — and never a scheduled
    // one either, which is what keeps a cancelled row from being held back and then unfolded as
    // though it were still coming.
    expect(sessionStatus(row({ cancel: true, started_at: '2026-11-27T07:30:00.000Z', ended_at: '2026-11-27T09:30:00.000Z' }), NOW)).toBe('cancelled')
  })

  it('reads a null cancel as not cancelled', () => {
    // The column is nullable with no default, so every seeded row is NULL. `cancel === true` is the
    // only honest test for it; a truthy check would do the same here, but an equality check would
    // not survive the day somebody writes cancel: 'true'.
    expect(sessionStatus(row({ cancel: null }), NOW)).toBe('upcoming')
  })

  it('leaves a row with unreadable times as open, as the card always did', () => {
    expect(sessionStatus(row({ started_at: 'not a time', ended_at: 'not a time' }), NOW)).toBe('open')
  })
})

describe('minutesUntilStart', () => {
  it('counts forward to a register that has not opened', () => {
    expect(minutesUntilStart(row({ started_at: '2026-11-27T10:00:00.000Z' }), NOW)).toBe(120)
  })

  it('goes negative once the window has begun', () => {
    expect(minutesUntilStart(row({ started_at: '2026-11-27T07:15:00.000Z' }), NOW)).toBe(-45)
  })

  it('says nothing rather than NaN for a row whose time cannot be read', () => {
    expect(minutesUntilStart(row({ started_at: undefined }), NOW)).toBeNull()
    expect(minutesUntilStart({}, NOW)).toBeNull()
  })
})

describe('isHeldBack', () => {
  it('holds back the reported case — a register opened days ahead', () => {
    // The card this whole rule exists for: opened on the 27th for the 6th, standing on the
    // dashboard with a PIN to read out and a QR to scan for a room that is nine days away.
    expect(isHeldBack(row({ started_at: '2026-12-06T09:00:00.000Z' }), { now: NOW })).toBe(true)
  })

  it('shows a register opening inside the lead window', () => {
    const inside = row({ started_at: new Date(NOW + (LEAD_MINUTES - 1) * MIN).toISOString() })
    const outside = row({ started_at: new Date(NOW + (LEAD_MINUTES + 1) * MIN).toISOString() })
    expect(isHeldBack(inside, { now: NOW })).toBe(false)
    expect(isHeldBack(outside, { now: NOW })).toBe(true)
  })

  it('puts the boundary on the showing side, so two hours out is still the room\'s business', () => {
    // `>` and not `>=`: a leader who set a window for exactly two hours from now is about to stand
    // in a room with it, and a card that vanishes one minute early is the failure mode reported.
    expect(isHeldBack(row({ started_at: new Date(NOW + LEAD_MINUTES * MIN).toISOString() }), { now: NOW })).toBe(false)
  })

  it('never holds back what is running, finished or called off', () => {
    const running = row({ started_at: '2026-11-27T07:30:00.000Z', ended_at: '2026-11-27T09:30:00.000Z' })
    const finished = row({ started_at: '2026-11-26T09:00:00.000Z', ended_at: '2026-11-26T11:00:00.000Z' })
    const called_off = row({ started_at: '2026-12-06T09:00:00.000Z', cancel: true })
    expect(isHeldBack(running, { now: NOW })).toBe(false)
    expect(isHeldBack(finished, { now: NOW })).toBe(false)
    expect(isHeldBack(called_off, { now: NOW })).toBe(false)
  })

  it('shows a row it cannot read instead of hiding a possibly live one', () => {
    // Hiding is the irreversible error here: a folded card is a register nobody thinks to cancel,
    // while a broken one is at least visible enough to be called off.
    expect(isHeldBack(row({ started_at: 'not a time' }), { now: NOW })).toBe(false)
  })

  it('takes a different lead when asked, so the rule has one number to change', () => {
    const inFourHours = row({ started_at: new Date(NOW + 240 * MIN).toISOString() })
    expect(isHeldBack(inFourHours, { now: NOW, lead: 120 })).toBe(true)
    expect(isHeldBack(inFourHours, { now: NOW, lead: 300 })).toBe(false)
  })
})

describe('waitUntilStart', () => {
  /*
    The collapsed line used to explain only the window — "it opens more than two hours from now" — and
    a reader on the 27th looking at a register for the 6th heard a clock that had not been set. The
    folded rows are days out by definition, so the line leads with the wait and keeps the window as the
    reason behind it.
  */
  it('says nine days for the reported register, not two hours', () => {
    expect(waitUntilStart(row({ started_at: '2026-12-06T09:00:00.000Z' }), NOW)).toBe('9 days')
  })

  it('sizes the number to the wait a reader would use', () => {
    expect(waitUntilStart(row({ started_at: new Date(NOW + 45 * MIN).toISOString() }), NOW)).toBe('45 min')
    expect(waitUntilStart(row({ started_at: new Date(NOW + 5 * 60 * MIN).toISOString() }), NOW)).toBe('5 h')
    expect(waitUntilStart(row({ started_at: new Date(NOW + 26 * 60 * MIN).toISOString() }), NOW)).toBe('1 day')
  })

  it('says nothing for a row whose time cannot be read', () => {
    // Same shape as `minutesUntilStart`: an empty string would print "it opens in ,", which is worse
    // than no number. Such a row is never folded in the first place.
    expect(waitUntilStart(row({ started_at: 'not a time' }), NOW)).toBeNull()
    expect(waitUntilStart({}, NOW)).toBeNull()
  })
})
