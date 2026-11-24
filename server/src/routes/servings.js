import { Router } from 'express'
import supabase from '../supabase.js'

/*
  Adding a serving to the servings table. The fields are name, surname, email and the
  community_id of the community the serving belongs to.

  This route talks to Supabase directly through ../supabase.js, which is built on the
  service key, so the write happens server-side and the browser never holds that key.
*/

const router = Router()

router.post('/', async (req, res) => {
  const { name, surname, email, community_id } = req.body || {}

  const missing = [
    ['name', name],
    ['surname', surname],
    ['email', email],
    ['community_id', community_id],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  // select() asks Supabase to hand the written row back: without it the INSERT still commits but
  // returns an empty body, data stays null, and the check below would report a saved serving as a
  // failure — which pushed the caller to retry and mint duplicate servings.
  const { data, error } = await supabase
    .from('servings')
    .insert({
      name: String(name).trim(),
      surname: String(surname).trim(),
      email: String(email).trim().toLowerCase(),
      community_id: String(community_id).trim(),
    })
    .select()

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

// Every serving in one community, with the role each person holds there.
router.get('/roles', async (req, res) => {
  const { community_id } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }
  const { data, error } = await supabase
    .from('servings')
    .select('name, surname, email, role, community_id')
    .eq('community_id', String(community_id).trim())
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

/*
  Changing one person's role in a community. The address and the community pick the row; the
  caller (an admin or a leader) is not stored, because only they reach this from the app.
*/
router.patch('/role', async (req, res) => {
  const { email, community_id, role } = req.body || {}
  const missing = [
    ['email', email],
    ['community_id', community_id],
    ['role', role],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  const { data, error } = await supabase
    .from('servings')
    .update({ role: String(role).trim() })
    .eq('email', String(email).trim().toLowerCase())
    .eq('community_id', String(community_id).trim())
    .select('name, surname, email, role, community_id')

  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No serving for that address in this community.' })
    return
  }
  res.json(data[0])
})

// Removing a person's serving row — called when an admin takes them out of the community.
router.delete('/role', async (req, res) => {
  const { email, community_id } = req.body || {}
  const missing = [
    ['email', email],
    ['community_id', community_id],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  const { error } = await supabase
    .from('servings')
    .delete()
    .eq('email', String(email).trim().toLowerCase())
    .eq('community_id', String(community_id).trim())

  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  res.json({ removed: true })
})

export default router
