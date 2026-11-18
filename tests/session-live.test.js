import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, sessionWith } from './helpers/mock-supabase.js'

/*
  The five invariants `live()` has to hold, each earned the hard way this project's history:

  1. The query is bounded by the session's own window (started_at ≤ now ≤ ended_at). A card
     that appears before the leader has read the PIN out is a card that lets the whole
     fellowship pre-mark itself from the sofa.
  2. `cancel` is nullable. The filter has to accept both false AND null, which is why the
     query uses `.or('cancel.eq.false,cancel.is.null')` and never the shorter `.eq('cancel',false)`
     that would drop every seeded row and every freshly-inserted one before this column
     defaulted. This invariant has a memory attached to it for a reason.
  3. A session whose register already holds the caller as attending is dropped. That single
     rule does triple duty: it hides the card from a member who has already checked in, and
     it hides the card from the leader who just opened the session because /api/leader writes
     their own row as attend=true the moment the session insert succeeds (the creator auto-yes).
  4. `near_required` is false when `allow_any_radius` is true, and false when the row carries
     no radius; only an explicit number turns it on. Getting this wrong shows a location prompt
     the leader never asked for, or hides one they did.
  5. The PIN is not in the projection. If it leaks here, the poll every member's dashboard
     runs hands the four digits out before the leader says them.
*/
describe('Session.live — query shape', () => {
  it('filters by community_id and asserts the cancel-null invariant in one .or()', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.live({ community_id: 'c1' })

    const [first] = mock.callsFor('session')
    expect(first).toBeTruthy()
    expect(first.or).toBe('cancel.eq.false,cancel.is.null')

    const eqs = first.filters.filter((one) => one.kind === 'eq')
    expect(eqs).toContainEqual({ kind: 'eq', col: 'community_id', val: 'c1' })
  })

  it('bounds the read with lte(started_at,now) and gte(ended_at,now)', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.live({ community_id: 'c1' })

    const [first] = mock.callsFor('session')
    const lte = first.filters.find((one) => one.kind === 'lte' && one.col === 'started_at')
    const gte = first.filters.find((one) => one.kind === 'gte' && one.col === 'ended_at')
    expect(lte, 'started_at must be lte now — a future session is not live yet').toBeTruthy()
    expect(gte, 'ended_at must be gte now — a past session is closed').toBeTruthy()
    // Both were handed an ISO string, not a Date or epoch.
    expect(typeof lte.val).toBe('string')
    expect(typeof gte.val).toBe('string')
    expect(Number.isNaN(Date.parse(lte.val))).toBe(false)
  })

  it('does not project the pin column at this tier', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.live({ community_id: 'c1' })

    const [first] = mock.callsFor('session')
    expect(first.select).toBeTruthy()
    // The whole point: the poll response cannot hand out the PIN before the leader speaks it.
    expect(first.select.split(',').map((one) => one.trim())).not.toContain('pin')
  })
})

describe('Session.live — already-marked filter (also covers creator auto-yes)', () => {
  it('drops a session whose event row already says the caller attends', async () => {
    const mock = makeSupabaseMock({
      session: [
        { session_id: 's1', event_name: 'sunday', date: '2026-11-15', started_at: 'x', ended_at: 'y', created_by: 'leader@x', radius: null, allow_any_radius: false },
        { session_id: 's2', event_name: 'choir', date: '2026-11-15', started_at: 'x', ended_at: 'y', created_by: 'leader@x', radius: null, allow_any_radius: false },
      ],
      event: [
        // The caller stands marked at 'sunday' but not at 'choir'.
        { event_date: '2026-11-15', event_name: 'sunday' },
      ],
    })
    const session = await sessionWith(mock)
    const rows = await session.live({ community_id: 'c1', email: 'member@x' })

    expect(rows.map((one) => one.session_id)).toEqual(['s2'])
  })

  it('drops the session a caller opened themselves — their attend=true row was written by /api/leader', async () => {
    // This is the "creator should not see their own PIN box" case: the row `session.create`
    // wrote via /api/leader carries attend=true and the same (date, event_name), so the
    // already-marked filter drops the card exactly like it would for any other member.
    const mock = makeSupabaseMock({
      session: [
        { session_id: 's1', event_name: 'sunday', date: '2026-11-15', started_at: 'x', ended_at: 'y', created_by: 'leader@x', radius: null, allow_any_radius: false },
      ],
      event: [
        { event_date: '2026-11-15', event_name: 'sunday' },
      ],
    })
    const session = await sessionWith(mock)
    const rows = await session.live({ community_id: 'c1', email: 'leader@x' })

    expect(rows).toHaveLength(0)
  })

  it('keeps a session whose row says the caller is NOT attending', async () => {
    // The event read the class performs is `.eq('attend', true)`, so a marked absence must not
    // match it. A row here that carries `attend: false` in the fixture should still be a live
    // card, because the person is allowed to change their mind by showing up.
    const mock = makeSupabaseMock({
      session: [
        { session_id: 's1', event_name: 'sunday', date: '2026-11-15', started_at: 'x', ended_at: 'y', created_by: 'leader@x', radius: null, allow_any_radius: false },
      ],
      event: [],
    })
    const session = await sessionWith(mock)
    const rows = await session.live({ community_id: 'c1', email: 'member@x' })

    expect(rows.map((one) => one.session_id)).toEqual(['s1'])
    // The event read was asked for attend=true only, so a false row cannot accidentally match.
    const [eventCall] = mock.callsFor('event')
    const attend = eventCall.filters.find((one) => one.kind === 'eq' && one.col === 'attend')
    expect(attend).toEqual({ kind: 'eq', col: 'attend', val: true })
  })

  it('skips the event read entirely when there are no live sessions', async () => {
    const mock = makeSupabaseMock({ session: [], event: [] })
    const session = await sessionWith(mock)
    await session.live({ community_id: 'c1', email: 'member@x' })

    expect(mock.callsFor('event')).toHaveLength(0)
  })
})

describe('Session.live — near_required column', () => {
  async function liveWith(session) {
    const mock = makeSupabaseMock({ session, event: [] })
    const s = await sessionWith(mock)
    return s.live({ community_id: 'c1' })
  }

  it('is false when allow_any_radius is true', async () => {
    const [one] = await liveWith([
      { session_id: 's1', event_name: 'e', date: '2026-11-15', radius: 149, allow_any_radius: true, created_by: 'l@x' },
    ])
    expect(one.near_required).toBe(false)
  })

  it('is false when radius is null', async () => {
    const [one] = await liveWith([
      { session_id: 's1', event_name: 'e', date: '2026-11-15', radius: null, allow_any_radius: false, created_by: 'l@x' },
    ])
    expect(one.near_required).toBe(false)
  })

  it('is true when radius is a number and allow_any_radius is false', async () => {
    const [one] = await liveWith([
      { session_id: 's1', event_name: 'e', date: '2026-11-15', radius: 149, allow_any_radius: false, created_by: 'l@x' },
    ])
    expect(one.near_required).toBe(true)
  })
})

describe('Session.live — leader_name resolution', () => {
  it('joins the creator against the users table so the notice can name them', async () => {
    const mock = makeSupabaseMock({
      session: [
        { session_id: 's1', event_name: 'e', date: '2026-11-15', radius: null, allow_any_radius: false, created_by: 'leader@x' },
      ],
      users: [{ email: 'leader@x', name: 'Thabo', surname: 'Mokoena' }],
    })
    const session = await sessionWith(mock)
    const [one] = await session.live({ community_id: 'c1' })
    expect(one.leader_name).toBe('Thabo Mokoena')
  })

  it('is an empty string when the creator row is missing', async () => {
    const mock = makeSupabaseMock({
      session: [
        { session_id: 's1', event_name: 'e', date: '2026-11-15', radius: null, allow_any_radius: false, created_by: 'gone@x' },
      ],
      users: [],
    })
    const session = await sessionWith(mock)
    const [one] = await session.live({ community_id: 'c1' })
    expect(one.leader_name).toBe('')
  })
})
