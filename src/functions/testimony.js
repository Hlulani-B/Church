import { createClient } from '@supabase/supabase-js'

const TABLE = 'testimony'
const FILTERABLE = ['community_id', 'user_email', 'date']

export class Testimony {
  constructor(url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(testimony_id) {
    if (!testimony_id) throw new Error('testimony_id is required')
  }

  async create({ community_id, user_email, body, date }) {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ community_id, user_email, body, date })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async all(filters = {}) {
    let query = this.client.from(TABLE).select()
    for (const [column, value] of Object.entries(filters)) {
      if (!FILTERABLE.includes(column)) throw new Error(`cannot filter testimonies by ${column}`)
      query = query.eq(column, value)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async find(testimony_id) {
    this.#id(testimony_id)
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('testimony_id', testimony_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(testimony_id, changes) {
    this.#id(testimony_id)
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('testimony_id', testimony_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(testimony_id) {
    this.#id(testimony_id)
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('testimony_id', testimony_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
