import { createClient } from '@supabase/supabase-js'

const TABLE = 'community'

export class Community {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(community_id) {
    if (!community_id) throw new Error('community_id is required')
  }

  async create({ name }) {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ name })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async all() {
    const { data, error } = await this.client.from(TABLE).select()
    if (error) throw error
    return data
  }

  async find(community_id) {
    this.#id(community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('community_id', community_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(community_id, changes) {
    this.#id(community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('community_id', community_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(community_id) {
    this.#id(community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('community_id', community_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
