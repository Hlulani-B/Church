import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_servings — the serving (role) an extra member holds in a community.

  The people who never open the app are listed in extra_members, and a leader or an admin says here
  what each of them does: worship, ushering, teaching — the same free-word role the real `servings`
  table already keeps against a member's address. Here the row hangs off a `member_id` instead, so a
  person without an account can still be given a serving. `role` carries no fixed vocabulary, exactly
  as the real servings page leaves it open.

  Everything is written with the service key through ../supabase.js, so no row-level-security policy
  stands in the way, and the browser never holds that key. Reads join extra_members(name, surname) so
  a screen can say whose serving it is without a second trip.
*/

const router = Router()

const SELECT = 'id, member_id, role, community_id, extra_members(name, surname)'

router.post('/', async (req, res) => {
  const { member_id, role, community_id } = req.body || {}

  const missing = [
    ['member_id', member_id],
    ['community_id', community_id],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  const { data, error } = await supabase
    .from('extra_servings')
    .insert({
      member_id: String(member_id).trim(),
      community_id: String(community_id).trim(),
      role: role === undefined || role === null ? null : String(role).trim() || null,
    })
    .select(SELECT)

  if (error) {
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'insert_failed', message: 'The serving did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  This community's extra servings, joined to the member each one belongs to. Narrowed to one member
  when `member_id` is given, so a member's own page shows only theirs.
*/
router.get('/', async (req, res) => {
  const { community_id, member_id } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }

  let query = supabase
    .from('extra_servings')
    .select(SELECT)
    .eq('community_id', String(community_id).trim())
    .order('id')

  if (member_id) query = query.eq('member_id', String(member_id).trim())

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

// Changing a serving's role. The row is addressed by its own id.
router.patch('/:id', async (req, res) => {
  const { role } = req.body || {}

  const { data, error } = await supabase
    .from('extra_servings')
    .update({ role: role === undefined || role === null ? null : String(role).trim() || null })
    .eq('id', req.params.id)
    .select(SELECT)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'not_found', message: 'No such serving.' })
    return
  }
  res.json(data)
})

// Removing one serving.
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('extra_servings')
    .delete()
    .eq('id', req.params.id)
    .select('id')

  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such serving.' })
    return
  }
  res.json({ removed: true, id: data[0].id })
})

export default router
