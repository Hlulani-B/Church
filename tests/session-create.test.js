import { describe, expect, it } from 'vitest'
import { makeSupabaseMock, sessionWith } from './helpers/mock-supabase.js'

/*
  Only one leader may hold a community's attendance at a time. `session.create` refuses any
  insert whose window overlaps an existing, un-cancelled session in the same community. This
  is what stops two leaders in one room from reading out two different PINs, and it also
  enforces the invariant that a PIN is unique per (community, day). Two rules on the row:

  1. The overlap query must respect the same `cancel.eq.false,cancel.is.null` invariant that
     `live()` does — otherwise a cancelled session would block a new one.
  2. The overlap condition is "neither finishes before the other begins", which in PostgREST
     filter language is `started_at <= newEndedAt AND ended_at >= newStartedAt`. If either
     side of that flips, either a real collision is let through, or a back-to-back session
     is refused with no reason.
*/
const baseArgs = {
  community_id: 'c1',
  pin: '1234',
  created_by: 'leader@x',
  date: '2026-11-15',
  started_at: '2026-11-15T17:00:00.000Z',
  ended_at: '2026-11-15T19:00:00.000Z',
  event_name: 'sunday',
  latitude: -26.2,
  longitude: 28.0,
  radius: 149,
  allow_any_radius: false,
}

describe('Session.create — overlap guard', () => {
  it('queries with the same cancel-null invariant that live() uses', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.create(baseArgs)

    const [held] = mock.callsFor('session')
    expect(held.or).toBe('cancel.eq.false,cancel.is.null')
  })

  it('checks started_at ≤ newEndedAt and ended_at ≥ newStartedAt', async () => {
    const mock = makeSupabaseMock({ session: [] })
    const session = await sessionWith(mock)
    await session.create(baseArgs)

    const [held] = mock.callsFor('session')
    const lte = held.filters.find((one) => one.kind === 'lte' && one.col === 'started_at')
    const gte = held.filters.find((one) => one.kind === 'gte' && one.col === 'ended_at')
    expect(lte.val).toBe(baseArgs.ended_at)
    expect(gte.val).toBe(baseArgs.started_at)
  })

  it('throws 409 with a "you already have" message when the caller owns the blocker', async () => {
    const mock = makeSupabaseMock({
      session: [{ event_name: 'sunday', created_by: 'leader@x' }],
    })
    const session = await sessionWith(mock)
    await expect(session.create(baseArgs)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/You already have a check-in open over that window/),
    })
  })

  it('throws 409 naming the other gathering when a different leader holds the window', async () => {
    const mock = makeSupabaseMock({
      session: [{ event_name: 'prayer tower', created_by: 'someone@else' }],
    })
    const session = await sessionWith(mock)
    await expect(session.create(baseArgs)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/Attendance is already being taken for prayer tower/),
    })
  })

  it('falls back to "this community" when the blocker has no event_name', async () => {
    const mock = makeSupabaseMock({
      session: [{ event_name: null, created_by: 'someone@else' }],
    })
    const session = await sessionWith(mock)
    await expect(session.create(baseArgs)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/Attendance is already being taken for this community/),
    })
  })
})

describe('Session.create — happy path', () => {
  it('inserts a full row and returns what came back', async () => {
    const inserted = { session_id: 's-new', ...baseArgs, cancel: false }
    const mock = makeSupabaseMock({ session: [], insertReturns: inserted })
    const session = await sessionWith(mock)
    const row = await session.create(baseArgs)
    expect(row).toMatchObject({ session_id: 's-new', cancel: false })
    // The insert payload carries the fields the check-in path later depends on — a null
    // `event_name` here is exactly the seeded-legacy-session bug that live() and self.js
    // both have to guard against, so pin it from the create side too.
    const [call] = mock.callsFor('session').filter((one) => one.insert)
    expect(call.insert).toMatchObject({
      community_id: 'c1',
      event_name: 'sunday',
      cancel: false,
      started_at: baseArgs.started_at,
      ended_at: baseArgs.ended_at,
    })
  })
})
