import { createClient } from '@supabase/supabase-js'

const TABLE = 'session'
const FILTERABLE = ['community_id', 'date', 'created_by', 'pin']

export class Session {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(session_id) {
    if (!session_id) throw new Error('session_id is required')
  }

  async create({
    community_id,
    pin,
    created_by,
    date,
    ended_at,
    latitude,
    longitude,
    started_at,
  }) {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ community_id, pin, created_by, date, ended_at, latitude, longitude, started_at })
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
