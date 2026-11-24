import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, sessionWith } from './helpers/mock-supabase.js'

/*
  `manage` is the read the leader and admin dashboards poll for the check-ins they can act on, and
  it is the only session read that carries a PIN. Three invariants follow from that:

  1. A cancelled session never comes back. Whoever opened it called it off, so there is nothing
     left to manage — but the row still holds its four digits, and the dashboard renders the QR
     built from them. Sending a dead check-in's PIN to a screen that cannot use it is a leak with
     no upside, and dropping the row here (not in the page) is what makes the card vanish the
     instant Cancel is pressed.
  2. `cancel` is nullable and has no default, so the guard is the same
     `.or('cancel.eq.false,cancel.is.null')` that `live()` and the `create()` overlap check use.
     A bare `.eq('cancel', false)` silently drops every seeded row, because NULL = false is never
     true in Postgres.
  3. The PIN travels only to the address that opened the session, and to an admin of the community.
*/
describe('Session.manage — query shape', () => {
  it('carries the cancel-null invariant, so a called-off session is not answered at all', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.manage({ community_id: 'c1', email: 'leader@x', admin: false })

    const [first] = mock.callsFor('session')
    expect(first).toBeTruthy()
    expect(first.or).toBe('cancel.eq.false,cancel.is.null')
  })

  it('filters by community_id and bounds the read at ended_at ≥ now', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.manage({ community_id: 'c1', email: 'leader@x', admin: false })

    const [first] = mock.callsFor('session')
    const eqs = first.filters.filter((one) => one.kind === 'eq')
    expect(eqs).toContainEqual({ kind: 'eq', col: 'community_id', val: 'c1' })

    // A session whose window has run out is history, not something to manage.
    const gte = first.filters.find((one) => one.kind === 'gte' && one.col === 'ended_at')
    expect(gte).toBeTruthy()
    expect(typeof gte.val).toBe('string')
    expect(Number.isNaN(Date.parse(gte.val))).toBe(false)
  })
})

describe('Session.manage — who the PIN reaches', () => {
  const row = (over = {}) => ({
    session_id: 's1',
    event_name: 'sunday',
    date: '2026-11-15',
    started_at: '2026-11-15T09:00:00.000Z',
    ended_at: '2026-11-15T11:00:00.000Z',
    radius: 150,
    allow_any_radius: false,
    cancel: false,
    created_by: 'leader@x',
    pin: '4321',
    ...over,
  })

  it('sends the digits to the person who opened the session', async () => {
    const mock = makeSupabaseMock({ session: [row()] })
    const session = await sessionWith(mock)
    const [one] = await session.manage({ community_id: 'c1', email: 'leader@x', admin: false })

    expect(one.mine).toBe(true)
    expect(one.pin).toBe('4321')
  })

  it('sends them to an admin of the community as well', async () => {
    const mock = makeSupabaseMock({ session: [row()] })
    const session = await sessionWith(mock)
    const [one] = await session.manage({ community_id: 'c1', email: 'admin@x', admin: true })

    expect(one.mine).toBe(false)
    expect(one.pin).toBe('4321')
  })

  it('withholds them from a second leader, who still gets the row', async () => {
    // Enough to say "attendance is being taken for sunday until 11:00" without handing over the
    // digits somebody else is standing on.
    const mock = makeSupabaseMock({ session: [row()] })
    const session = await sessionWith(mock)
    const [one] = await session.manage({ community_id: 'c1', email: 'other@x', admin: false })

    expect(one.mine).toBe(false)
    expect(one.pin).toBeNull()
    expect(one.session_id).toBe('s1')
  })

  it('derives near_required from the radius, not from the page', async () => {
    const mock = makeSupabaseMock({ session: [row({ radius: null, allow_any_radius: false })] })
    const session = await sessionWith(mock)
    const [one] = await session.manage({ community_id: 'c1', email: 'leader@x', admin: false })

    expect(one.near_required).toBe(false)
  })
})
