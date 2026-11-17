import { createClient } from '@supabase/supabase-js'

const TABLE = 'session'
const FILTERABLE = ['community_id', 'date', 'created_by', 'pin']

// The mean radius the haversine is usually worked against, in metres.
const EARTH_IN_METRES = 6371008.8

/*
  How far apart two readings of where a device stands are, in metres.

  Spherical rather than ellipsoidal on purpose: the difference between the two is well under a
  kilometre anywhere on the globe, and the tolerance this is compared against is a hundred and
  fifty metres of GPS, which a phone is rarely better than. An exact model of the Earth would be
  false precision pointing at a number that is only ever a rough one.

  Callers must bring coordinates this device reported, not coordinates somebody typed: a pair
  outside the globe makes this return NaN, which refuses every check-in rather than passing one.
*/
export function distanceInMetres(from, to) {
  const radians = (one) => (one * Math.PI) / 180
  const halfLat = radians(to.latitude - from.latitude) / 2
  const halfLon = radians(to.longitude - from.longitude) / 2
  const h =
    Math.sin(halfLat) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(halfLon) ** 2
  return 2 * EARTH_IN_METRES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/*
  The four digits a room is told to say. Drawn one byte at a time with the values past 249
  thrown back rather than folded in: 256 is not a multiple of ten, so taking the remainder of
  every byte would lean on nine of the ten digits and make a PIN guessed from a shoulder a
  little likelier than it should be.
*/
export function generatePin(length = 4) {
  let pin = ''
  while (pin.length < length) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]
    if (byte < 250) pin += String(byte % 10)
  }
  return pin
}

export class Session {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(session_id) {
    if (!session_id) throw new Error('session_id is required')
  }

  /*
    A PIN to show the room before the session exists. Nothing is written here: the leader reads
    the four digits out, chooses the two times, and the row arrives when they save. Drawing it
    on the server is what keeps the number the page displays and the number the table holds the
    same one, which a box somebody typed into is not.
  */
  async pin() {
    return { pin: generatePin() }
  }

  /*
    One session opened for one gathering. `radius` is how near the room a check-in has to come
    from, in metres, and `allow_any_radius` says the distance is not asked about at all; both are
    the leader's choice, made in the room as the session is opened. A null `radius` is not a
    missing number to be filled in here — it is read upstream as no distance limit, which is what
    every row seeded before these columns existed already is.
  */
  async create({
    community_id,
    pin,
    created_by,
    date,
    ended_at,
    event_name,
    latitude,
    longitude,
    radius,
    allow_any_radius,
    started_at,
  }) {
    /*
      Only one person takes a community's attendance at a time. If a session is stood open whose
      window overlaps the one being asked for — un-cancelled, and sharing any minute between its
      start and its end — a second one cannot be opened over it, whoever is asking. That is the
      whole answer to two leaders in the same room reading out two different PINs, and it is
      settled here on the server rather than by a page that could be looking at a stale list.
      Two windows overlap when neither finishes before the other begins, so a session scheduled for
      later today competes with one being opened now just as surely as one that is live this second.
      Cancelling a session, or its window simply ending, frees it again.
    */
    const { data: holding, error: holdError } = await this.client
      .from(TABLE)
      .select('event_name, created_by')
      .eq('community_id', community_id)
      .or('cancel.eq.false,cancel.is.null')
      .lte('started_at', ended_at)
      .gte('ended_at', started_at)
      .limit(1)
    if (holdError) throw holdError
    if (holding && holding.length) {
      const one = holding[0]
      const taken =
        one.created_by === created_by
          ? 'You already have a check-in open over that window'
          : `Attendance is already being taken for ${one.event_name || 'this community'}`
      throw Object.assign(new Error(`${taken}. Close or wait for it to end before opening another.`), {
        status: 409,
      })
    }
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        community_id,
        pin,
        created_by,
        cancel: false,
        date,
        ended_at,
        event_name,
        latitude,
        longitude,
        radius,
        allow_any_radius,
        started_at,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async all(filters = {}) {
    let query = this.client.from(TABLE).select()
    for (const [column, value] of Object.entries(filters)) {
      if (!FILTERABLE.includes(column)) throw new Error(`cannot filter sessions by ${column}`)
      query = query.eq(column, value)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  /*
    What could be checked in to in this community right now, as the name of the gathering, its
    window and whether a distance will be asked about.

    The PIN is not among the columns, on purpose. Read together with the window it is everything a
    check-in needs, so a list that carried it would let the whole community mark itself present
    before anybody said the digits out loud — a check-in would stop being a thing that happens in a
    room and become a form filled in on a sofa. The latitude and longitude are left out for the
    same kind of reason: the page has no use for where the hall is, only for whether a place is
    needed at all.

    The window is settled here rather than in the page, because a session that has closed stops
    being offered the moment it stops being true.
  */
  async open({ community_id, now }) {
    const { data, error } = await this.client
      .from(TABLE)
      .select(
        'session_id, event_name, date, started_at, ended_at, radius, allow_any_radius, created_by',
      )
      .eq('community_id', community_id)
      .or('cancel.eq.false,cancel.is.null')
      .lt('started_at', now)
      .gt('ended_at', now)
      .order('started_at', { ascending: false })
    if (error) throw error
    return (data || []).map((one) => ({
      ...one,
      near_required:
        one.allow_any_radius !== true && one.radius !== null && one.radius !== undefined,
    }))
  }

  /*
    What the leader and admin dashboards listen to: every session in this community that has not
    yet ended, with the fields a person needs to manage one they opened — the two times, the radius,
    whether it was cancelled and who created it — and, unlike 'open', the PIN as well.

    The PIN is the reason this read answers to the leader tier rather than to any member: it is the
    one secret 'open' deliberately keeps back so a poll cannot tell the room the digits before the
    leader does. Even so it is only handed to the address that opened the session, and to an admin,
    who can run any check-in in their community. Everybody else gets the row with its PIN withheld,
    which is enough to show "attendance is being taken for X, until Y" without letting a second
    leader read the digits off somebody else's gathering.
  */
  async manage({ community_id, email, admin }) {
    const { data, error } = await this.client
      .from(TABLE)
      .select(
        'session_id, event_name, date, started_at, ended_at, radius, allow_any_radius, cancel, created_by, pin',
      )
      .eq('community_id', community_id)
      .gte('ended_at', new Date().toISOString())
      .order('started_at', { ascending: false })
    if (error) throw error
    return (data || []).map((one) => ({
      ...one,
      mine: one.created_by === email,
      // The digits travel only to the person who opened them and to an admin of the community.
      pin: one.mine || admin ? one.pin : null,
      near_required:
        one.allow_any_radius !== true && one.radius !== null && one.radius !== undefined,
    }))
  }

  /*
    What every member's dashboard listens to: each session in this community that is still live —
    not cancelled, and whose window has not yet closed, whether it is taking check-ins now or is
    only scheduled for later. This is the read behind the member's notice, and it answers the one
    question a plain member has: is anybody taking attendance here, or about to.

    It is deliberately the member-safe view. Unlike the leader's 'manage' it carries no PIN, so a
    poll that every phone in the fellowship runs cannot hand out the four digits before the leader
    reads them out. It returns the gathering's name, its window, whether it is open right now and
    whether a distance will be asked about — enough to raise a banner and to point at the check-in
    box, and nothing that could mark a stranger present.
  */
  async live({ community_id }) {
    const now = new Date()
    const { data, error } = await this.client
      .from(TABLE)
      .select(
        'session_id, event_name, date, started_at, ended_at, radius, allow_any_radius, cancel, created_by',
      )
      .eq('community_id', community_id)
      .or('cancel.eq.false,cancel.is.null')
      .gte('ended_at', now.toISOString())
      .order('started_at', { ascending: false })
    if (error) throw error
    /*
      The fellowship wants to know who is taking attendance, not just that somebody is, so each row
      carries the name of the person who opened it. It is read off the users table by the creator's
      address in one go rather than row by row, and it is only ever a name — the address itself is
      not handed to every phone, and the PIN stays back regardless.
    */
    const creators = [...new Set((data || []).map((one) => one.created_by).filter(Boolean))]
    let names = {}
    if (creators.length) {
      const { data: people, error: peopleError } = await this.client
        .from('users')
        .select('email, name, surname')
        .in('email', creators)
      if (peopleError) throw peopleError
      names = Object.fromEntries(
        (people || []).map(
          (person) => [person.email, [person.name, person.surname].filter(Boolean).join(' ').trim()],
        ),
      )
    }
    return (data || []).map((one) => ({
      ...one,
      // The person who opened this check-in, so the notice can name them. '' if the row is unknown.
      leader_name: names[one.created_by] || '',
      // Whether this session's window holds at this instant, as opposed to being scheduled later.
      live: new Date(one.started_at) <= now && new Date(one.ended_at) >= now,
      near_required:
        one.allow_any_radius !== true && one.radius !== null && one.radius !== undefined,
    }))
  }

  /*
    The two changes a dashboard may make to a session it is managing: cancel it, and widen or
    narrow the distance a check-in is taken from. Nothing else on the row moves here — the PIN, the
    window, the place and the gathering's name are set once when it is opened. Cancelling is
    one-way: a session called off stays called off, so `cancel` is only ever set to true, which
    keeps a cancelled check-in from being quietly reopened and competing with whoever took the
    attendance after it. A radius keeps the same rule the create does — no limit is null, otherwise
    a real distance in metres.

    Whether the caller is allowed to touch this row at all (its creator, or an admin of the
    community) is settled by /api/leader before it calls here, the same way every other guarded
    change is; this method trusts that answer and asks only whether the change itself makes sense.
  */
  async revise(session_id, changes = {}) {
    this.#id(session_id)
    const patch = {}
    if (changes.cancel === true) patch.cancel = true
    if (Object.prototype.hasOwnProperty.call(changes, 'radius')) {
      const radius =
        changes.radius === null || changes.radius === '' || changes.radius === undefined
          ? null
          : Number(changes.radius)
      if (radius !== null && (!Number.isFinite(radius) || radius <= 0 || radius > 20000)) {
        throw new Error('radius is a distance in metres, from 1 to 20000')
      }
      patch.radius = radius
    }
    if (!Object.keys(patch).length) {
      throw Object.assign(new Error('nothing to change on that session'), { status: 400 })
    }
    const { data, error } = await this.client
      .from(TABLE)
      .update(patch)
      .eq('session_id', session_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async find(session_id) {
    this.#id(session_id)
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('session_id', session_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(session_id, changes) {
    this.#id(session_id)
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('session_id', session_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(session_id) {
    this.#id(session_id)
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('session_id', session_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
