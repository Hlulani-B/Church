import { createClient } from '@supabase/supabase-js'

const TABLE = 'users'

export class User {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  async create({ email, name, surname }) {
    if (!email) throw new Error('email is required')
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ email, name, surname })
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

  async find(email) {
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('email', email)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(email, changes) {
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('email', email)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(email) {
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('email', email)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
