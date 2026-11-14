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

  // Every community a person belongs to: their ids out of community_members,
  // then the names from this table. Returns [{ community_id, name }].
  async memberOf(email) {
    if (!email) throw new Error('email is required')
    const { data: links, error: linksError } = await this.client
      .from('community_members')
      .select('community_id')
      .eq('email', email)
    if (linksError) throw linksError

    const ids = links.map(({ community_id }) => community_id)
    if (!ids.length) return []

    const { data, error } = await this.client
      .from(TABLE)
      .select('community_id, name')
      .in('community_id', ids)
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
