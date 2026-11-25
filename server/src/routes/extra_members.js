import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_members — the people a leader or an admin lists for a community who never join the app.

  There is no sign-in and no address for them: the row is a name and a surname under a
  community_id, and `created_by` is the address of whoever put them there (a real user, so it
  points at users.email). Their member_id is what the other extra_* tables attach to, and it is
  drawn by the database, never typed here.

  This route talks to Supabase directly through ../supabase.js, which is built on the service key,
  so the write happens server-side and the browser never holds that key.
*/

const router = Router()

// Adding one extra member to a community.
router.post('/', async (req, res) => {
  const { community_id, name, surname, created_by } = req.body || {}

  const missing = [
    ['community_id', community_id],
    ['name', name],
    ['surname', surname],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  const { data, error } = await supabase
    .from('extra_members')
    .insert({
      community_id: String(community_id).trim(),
      name: String(name).trim(),
      surname: String(surname).trim(),
      created_by: created_by ? String(created_by).trim().toLowerCase() : null,
    })
    .select()

  if (error) {
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'insert_failed', message: 'The member did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

// Every extra member of one community, newest first.
router.get('/', async (req, res) => {
  const { community_id } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }
  const { data, error } = await supabase
    .from('extra_members')
    .select('member_id, community_id, name, surname, created_by, created_at')
    .eq('community_id', String(community_id).trim())
    .order('name')
    .order('surname')
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

// One extra member, by id.
router.get('/:member_id', async (req, res) => {
  const { data, error } = await supabase
    .from('extra_members')
    .select('member_id, community_id, name, surname, created_by, created_at')
    .eq('member_id', req.params.member_id)
    .maybeSingle()
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'not_found', message: 'No such extra member.' })
    return
  }
  res.json(data)
})

// Renaming one extra member. Only the name and surname move; the id and community stay put.
router.patch('/:member_id', async (req, res) => {
  const { name, surname } = req.body || {}
  const changes = {}
  if (name !== undefined) changes.name = String(name).trim()
  if (surname !== undefined) changes.surname = String(surname).trim()
  if (!Object.keys(changes).length) {
    res.status(400).json({ error: 'missing_fields', missing: ['name or surname'] })
    return
  }

  const { data, error } = await supabase
    .from('extra_members')
    .update(changes)
    .eq('member_id', req.params.member_id)
    .select()
  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such extra member.' })
    return
  }
  res.json(data[0])
})

/*
  Removing one extra member. Their event, testimony, function-attending and function-paid rows all
  carry an ON DELETE CASCADE foreign key, so dropping the person takes what was recorded about them
  with them — that is the point of keeping these people in their own tables rather than mixing them
  into the app's real roster.
*/
router.delete('/:member_id', async (req, res) => {
  const { data, error } = await supabase
    .from('extra_members')
    .delete()
    .eq('member_id', req.params.member_id)
    .select('member_id')
  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such extra member.' })
    return
  }
  res.json({ removed: true, member_id: data[0].member_id })
})

export default router
