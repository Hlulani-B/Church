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

  /*
    Opening a community. `created_by` is the address that asked, written by /api/self off the caller's
    own id token — never off the body — which is what makes it a record of who founded this group
    rather than a claim whoever typed the name. It is what the delete-everything path is later
    compared against, so a community opened before the column existed has no owner it can prove.
  */
  async create({ name, created_by }) {
    const { data, error } = await this.client
      .from(TABLE)
      .insert({ name, created_by: created_by || null })
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

  // Every community a person belongs to: their ids and roles out of community_members,
  // then the names from this table. Returns [{ community_id, name, role }]. The role is
  // the caller's own — a page that already knows which community it is about has no use
  // for anybody else's, and picking the link up here saves a second read further down.
  async memberOf(email) {
    if (!email) throw new Error('email is required')
    const { data: links, error: linksError } = await this.client
      .from('community_members')
      .select('community_id, role')
      .eq('email', email)
    if (linksError) throw linksError

    const ids = links.map(({ community_id }) => community_id)
    if (!ids.length) return []

    const { data, error } = await this.client
      .from(TABLE)
      .select('community_id, name')
      .in('community_id', ids)
    if (error) throw error
    const role_of = Object.fromEntries(links.map((one) => [one.community_id, one.role]))
    return data.map((one) => ({ ...one, role: role_of[one.community_id] }))
  }

  // The community a typed join code names: id and name only, because the code itself is an
  // admin's to show and this read must not carry it back out.
  async byCode(join_id) {
    if (!join_id) throw new Error('join_id is required')
    const { data, error } = await this.client
      .from(TABLE)
      .select('community_id, name')
      .eq('join_id', join_id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  /*
    The link a code buys: always a plain member, so `role` is not something a caller gets to
    say here. `community_id` is the one /api/self read off the code, never the one typed into the
    request alongside it.
  */
  async join({ email, community_id }) {
    if (!email || !community_id) throw new Error('email and community_id are required to join')
    const { data, error } = await this.client
      .from('community_members')
      .insert({ email, community_id, role: 'member' })
      .select('community_id, role')
      .single()
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
