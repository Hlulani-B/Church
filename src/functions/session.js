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
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
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
      .select('session_id, event_name, date, started_at, ended_at, radius, allow_any_radius')
      .eq('community_id', community_id)
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
