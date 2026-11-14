import { createClient } from '@supabase/supabase-js'

const TABLE = 'community'

/*
  The alphabet a join code is drawn from. No 0, O, 1 or I, so a code read out in a service
  or glanced off a screen cannot be mistyped for its look-alike. 32 characters divide 256
  exactly, so taking the remainder of a random byte does not lean on any of them.
*/
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateJoinId(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let code = ''
  for (const byte of bytes) code += CODE_CHARS[byte % CODE_CHARS.length]
  return code
}

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

  // True when some community already answers to that code.
  async #codeTaken(join_id) {
    const { data, error } = await this.client
      .from(TABLE)
      .select('community_id')
      .eq('join_id', join_id)
      .maybeSingle()
    if (error) throw error
    return Boolean(data)
  }

  // A code nobody holds yet: drawn again for as long as the table already answers to it.
  async #freeCode() {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const join_id = generateJoinId()
      if (!(await this.#codeTaken(join_id))) return join_id
    }
    throw new Error('could not draw a free join code, please try again')
  }

  /*
    Replaces this community's join code with a generated one and returns the row, so the
    caller reads the new code off the same answer that wrote it. The code is checked
    against every row before it is written: join_id is unique, so a clash would be
    refused by the database anyway, and drawing again until the code is free is what keeps
    that refusal from ever reaching the person waiting for a code to say aloud.
  */
  async changeCode(community_id) {
    this.#id(community_id)
    const join_id = await this.#freeCode()
    const { data, error } = await this.client
      .from(TABLE)
      .update({ join_id })
      .eq('community_id', community_id)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error(`no community with id ${community_id}`)
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
