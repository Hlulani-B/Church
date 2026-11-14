import { createClient } from '@supabase/supabase-js'

const TABLE = 'community_members'

export class CommunityMember {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #key(email, community_id) {
    if (!email || !community_id) throw new Error('email and community_id are required')
  }

  async create({ email, community_id, role = 'member' }) {
    this.#key(email, community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ email, community_id, role })
      .select()
      .single()
    if (error) throw error
    return data
  }

  /*
    Everyone in one community, with the name from users beside the role. `users!inner` is
    the join: community_members holds only the email and the role, users holds who that
    address belongs to, and the inner form drops a link whose user row is missing instead
    of returning a row with no name. Flattened here so a page gets one object per person.
  */
  async members(community_id) {
    if (!community_id) throw new Error('community_id is required')
    const { data, error } = await this.client
      .from(TABLE)
      .select('email, role, users!inner(name, surname)')
      .eq('community_id', community_id)
      .order('role')
      .order('email')
    if (error) throw error
    return data.map(({ email, role, users }) => ({
      email,
      role,
      name: users?.name ?? '',
      surname: users?.surname ?? '',
    }))
  }

  async all({ email, community_id, role } = {}) {
    let query = this.client.from(TABLE).select()
    if (email) query = query.eq('email', email)
    if (community_id) query = query.eq('community_id', community_id)
    if (role) query = query.eq('role', role)
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async find(email, community_id) {
    this.#key(email, community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .select()
      .eq('email', email)
      .eq('community_id', community_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async update(email, community_id, changes) {
    this.#key(email, community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .update(changes)
      .eq('email', email)
      .eq('community_id', community_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }

  async remove(email, community_id) {
    this.#key(email, community_id)
    const { data, error } = await this.client
      .from(TABLE)
      .delete()
      .eq('email', email)
      .eq('community_id', community_id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  }
}
