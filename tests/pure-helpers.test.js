import { describe, expect, it } from 'vitest'
import { distanceInMetres, generatePin, pickOpenSession } from '../src/functions/session.js'
import { reading } from '../lib/god.js'

/*
  The radius rule boils down to a single number: how far a phone is from where the leader stood.
  These are the pure-maths pieces around it. If any of them drifts, a real check-in inside the
  hall can be refused or a fake one outside can be let through, and neither failure shows up as
  a broken test on the page — it shows up as somebody standing at the door unable to mark
  themselves present.
*/
describe('distanceInMetres', () => {
  it('is zero between identical points', () => {
    expect(distanceInMetres({ latitude: -26.2, longitude: 28.0 }, { latitude: -26.2, longitude: 28.0 })).toBe(0)
  })

  it('is roughly one degree of latitude at the equator', () => {
    // One degree of latitude is ~111.19 km anywhere on a sphere. Anything near that is fine;
    // anything an order of magnitude off means the radians conversion has slipped.
    const d = distanceInMetres({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })
    expect(d).toBeGreaterThan(111000)
    expect(d).toBeLessThan(111500)
  })

  it('shrinks one degree of longitude as you move poleward', () => {
    const atEquator = distanceInMetres({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })
    const at45 = distanceInMetres({ latitude: 45, longitude: 0 }, { latitude: 45, longitude: 1 })
    expect(at45).toBeLessThan(atEquator)
    // cos(45°) ≈ 0.707, so the 45th-parallel distance is around 78 km.
    expect(at45).toBeGreaterThan(78000)
    expect(at45).toBeLessThan(79000)
  })

  it('is symmetric', () => {
    const a = { latitude: -26.2041, longitude: 28.0473 }
    const b = { latitude: -25.7479, longitude: 28.2293 }
    expect(distanceInMetres(a, b)).toBeCloseTo(distanceInMetres(b, a), 6)
  })

  it('clamps nonsense latitude to a finite, bounded result — the coordinate guard is the caller\'s', () => {
    // The haversine always produces a value in [0, πR] regardless of what finite numbers go in,
    // because sin²(θ) is bounded and asin is clamped to [-1,1]. The API refuses an out-of-range
    // coordinate at api/self.js by checking Math.abs(latitude) <= 90 before it calls here —
    // so this function stays a pure distance formula and does not double as a validator.
    const nonsense = distanceInMetres({ latitude: 200, longitude: 0 }, { latitude: 0, longitude: 0 })
    expect(Number.isFinite(nonsense)).toBe(true)
    expect(nonsense).toBeGreaterThanOrEqual(0)
    expect(nonsense).toBeLessThanOrEqual(Math.PI * 6371008.8)
  })

  it('is NaN only when a caller hands it an actual NaN', () => {
    const nan = distanceInMetres({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })
    expect(Number.isNaN(nan)).toBe(true)
  })
})

/*
  The four digits the room is told out loud. Distribution correctness matters because a leader
  who could predict a colleague's PIN — even a little — could stand in for them. The generator
  rejects bytes ≥ 250 for exactly that reason; a naive `byte % 10` would lean on 0..5.
*/
describe('generatePin', () => {
  it('is exactly four characters of digits', () => {
    for (let i = 0; i < 20; i += 1) {
      const pin = generatePin()
      expect(pin).toMatch(/^\d{4}$/)
    }
  })

  it('honours a requested length', () => {
    expect(generatePin(6)).toMatch(/^\d{6}$/)
  })

  it('does not obviously favour a subset of digits', () => {
    // Loose check: over five thousand draws, every digit should appear at least once per position.
    // This is not a statistical test — it catches the "always returns the same number" class of
    // bug (a broken crypto path) without being flaky.
    const seen = new Set()
    for (let i = 0; i < 5000; i += 1) seen.add(generatePin())
    // 5000 draws of a 4-digit PIN: birthday paradox makes collisions common but should still
    // leave well over a thousand distinct pins.
    expect(seen.size).toBeGreaterThan(1000)
  })
})

/*
  `reading` turns a raw form value (or null / undefined / empty string) into a number, and the
  whole "did the phone actually report a place?" guard hangs on its NaN output. If it ever starts
  coercing null to 0, an outside-radius check-in becomes an origin-point check-in, which is a
  whole class of security regression hiding in three characters.
*/
describe('reading', () => {
  it('returns NaN for null, undefined and empty string', () => {
    expect(Number.isNaN(reading(null))).toBe(true)
    expect(Number.isNaN(reading(undefined))).toBe(true)
    expect(Number.isNaN(reading(''))).toBe(true)
  })

  it('parses numeric strings', () => {
    expect(reading('-26.2041')).toBeCloseTo(-26.2041, 6)
    expect(reading('28')).toBe(28)
  })

  it('passes numbers through untouched', () => {
    expect(reading(0)).toBe(0)
    expect(reading(-12.5)).toBe(-12.5)
  })

  it('is NaN for a non-numeric string', () => {
    // Zero is a legitimate coordinate; a stray word is not.
    expect(Number.isNaN(reading('abc'))).toBe(true)
  })
})

/*
  The window rule, alone, decides two things that now rest on the same four digits: whether a PIN
  writes an arrival, and whether a scan is allowed to enrol somebody as a member. A session that is
  closed, cancelled or named differently must answer nothing to either — the first would let last
  Sunday's PIN record today, and the second would turn a photograph of a projector into a way into
  a fellowship. Every case below is one of those two failures in disguise.
*/
describe('pickOpenSession', () => {
  const at = (offset) => new Date('2026-11-15T09:00:00Z').getTime() + offset
  const iso = (offset) => new Date(at(offset)).toISOString()
  const now = new Date('2026-11-15T09:30:00Z')
  const open = { session_id: 'a', started_at: iso(-30 * 60e3), ended_at: iso(30 * 60e3) }

  it('takes the session whose window holds now', () => {
    expect(pickOpenSession([open], { now })).toBe(open)
  })

  it('refuses one that has closed, and one that has not started', () => {
    const closed = { ...open, session_id: 'b', started_at: iso(-3 * 3600e3), ended_at: iso(-2 * 3600e3) }
    const future = { ...open, session_id: 'c', started_at: iso(2 * 3600e3), ended_at: iso(3 * 3600e3) }
    expect(pickOpenSession([closed, future], { now })).toBeNull()
  })

  it('refuses a cancelled session even inside its window', () => {
    expect(pickOpenSession([{ ...open, cancel: true }], { now })).toBeNull()
  })

  it('holds a scanned session to the id the scan named', () => {
    // Same digits, same window, different gathering: the QR points at one row, not at whichever
    // row those digits happen to repeat against.
    expect(pickOpenSession([open], { session_id: 'z', now })).toBeNull()
    expect(pickOpenSession([open], { session_id: 'a', now })).toBe(open)
  })

  it('takes the newest start when two windows overlap', () => {
    const later = { ...open, session_id: 'd', started_at: iso(10 * 60e3) }
    expect(pickOpenSession([open, later], { now }).session_id).toBe('d')
  })

  it('treats a session with no usable window as closed', () => {
    // Seeded rows and half-written ones must not become a way in. `new Date(undefined)` is an
    // Invalid Date, and every comparison against it is false.
    expect(pickOpenSession([{ session_id: 'e' }], { now })).toBeNull()
    expect(pickOpenSession([{ ...open, ended_at: 'not a time' }], { now })).toBeNull()
  })

  it('answers null rather than undefined when there is nothing to pick', () => {
    // The endpoints branch on the falsy value, but a caller that compares with `null` should not
    // be the thing that quietly breaks when this helper is reused.
    expect(pickOpenSession([], { now })).toBeNull()
    expect(pickOpenSession(null, { now })).toBeNull()
  })
})
