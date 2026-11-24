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

  /*
    The people of one community, in the order the For-who box reads them.

    Two reads, in this order, because that is what the question actually is: community_members
    holds who belongs to the community_id, and only then does users hold who that address
    belongs to. The emails come off the first and go into the second as an exact list, so the
    answer is this community's people and nobody else's, and an address on the roster without
    a user row simply is not offered. /api/leader maps the action 'user', function 'getUsers'
    onto this and gates it on the caller leading or admining the community_id in the request.
  */
  async getUsers(community_id) {
    if (!community_id) throw new Error('community_id is required')
    const { data: links, error: linksError } = await this.client
      .from('community_members')
      .select('email')
      .eq('community_id', community_id)
    if (linksError) throw linksError

    const emails = [...new Set(links.map((one) => one.email))]
    if (!emails.length) return []
    const { data, error } = await this.client
      .from(TABLE)
      .select('email, name, surname')
      .in('email', emails)
    if (error) throw error

    return data
      .map(({ email, name, surname }) => ({ email, name: name ?? '', surname: surname ?? '' }))
      .sort((a, b) =>
        `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`),
      )
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
