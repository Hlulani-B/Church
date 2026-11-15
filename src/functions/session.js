import { createClient } from '@supabase/supabase-js'

const TABLE = 'session'
const FILTERABLE = ['community_id', 'date', 'created_by', 'pin']

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

  async create({
    community_id,
    pin,
    created_by,
    date,
    ended_at,
    event_name,
    latitude,
    longitude,
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
