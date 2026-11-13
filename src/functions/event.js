import { createClient } from '@supabase/supabase-js'

const TABLE = 'event'
const UNIQUE_EVENT = 'community_id,event_date,event_name,user_email'
const FILTERABLE = [
  'community_id',
  'event_name',
  'event_date',
  'user_email',
  'attend',
  'reason',
  'recorded_by',
  'session_id',
]

export class Event {
  constructor(url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(event_id) {
    if (!event_id) throw new Error('event_id is required')
  }

  async create(event) {
    const { data, error } = await this.client.from(TABLE).insert(event).select().single()
    if (error) throw error
    return data
  }

  async record(event) {
    const { data, error } = await this.client
      .from(TABLE)
      .upsert(event, { onConflict: UNIQUE_EVENT })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async all(filters = {}) {
    let query = this.client.from(TABLE).select()
    for (const [column, value] of Object.entries(filters)) {
      if (!FILTERABLE.includes(column)) throw new Error(`cannot filter events by ${column}`)
      query = query.eq(column, value)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async find(event_id) {
    this.#id(event_id)
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('event_id', event_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(event_id, changes) {
    this.#id(event_id)
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('event_id', event_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(event_id) {
    this.#id(event_id)
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('event_id', event_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
