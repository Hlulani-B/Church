import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_function_attending — whether one extra member is attending one planned function. The key is
  the pair (function_id, member_id), so the write is an upsert rather than a fresh insert each time:
  changing a yes to a no replaces the row instead of stacking another one under it.

  function_id points at the real `functions` table and member_id at extra_members, both with ON
  DELETE CASCADE, so this only ever speaks about a function and a person that still exist.
*/

const router = Router()

function isDigits(value) {
  return /^\d+$/.test(String(value ?? '').trim())
}

// Recording or re-recording one member's answer to one function.
router.post('/', async (req, res) => {
  const { function_id, member_id, attending } = req.body || {}

  if (!isDigits(function_id)) {
    res.status(400).json({ error: 'bad_function_id', message: 'function_id is the number a planned function is addressed by.' })
    return
  }
  if (!member_id || String(member_id).trim() === '') {
    res.status(400).json({ error: 'missing_fields', missing: ['member_id'] })
    return
  }
  if (attending !== true && attending !== false && String(attending) !== 'true' && String(attending) !== 'false') {
    res.status(400).json({ error: 'missing_fields', missing: ['attending'] })
    return
  }

  const { data, error } = await supabase
    .from('extra_function_attending')
    .upsert(
      {
        function_id: Number(String(function_id).trim()),
        member_id: String(member_id).trim(),
        attending: attending === true || String(attending) === 'true',
      },
      { onConflict: 'function_id,member_id' },
    )
    .select()

  if (error) {
    res.status(500).json({ error: 'write_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'write_failed', message: 'The answer did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  Every extra member's answer for one function, with the person's name and surname joined off
  extra_members so a list speaks of people rather than of ids.
*/
router.get('/', async (req, res) => {
  const { function_id } = req.query
  if (!isDigits(function_id)) {
    res.status(400).json({ error: 'bad_function_id', message: 'function_id is required, as a number.' })
    return
  }
  const { data, error } = await supabase
    .from('extra_function_attending')
    .select('function_id, member_id, attending, created_at, extra_members(name, surname)')
    .eq('function_id', Number(String(function_id).trim()))
    .order('created_at')
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

// Taking one member's answer off a function.
router.delete('/', async (req, res) => {
  const { function_id, member_id } = req.body || {}
  if (!isDigits(function_id) || !member_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['function_id', 'member_id'] })
    return
  }
  const { error } = await supabase
    .from('extra_function_attending')
    .delete()
    .eq('function_id', Number(String(function_id).trim()))
    .eq('member_id', String(member_id).trim())
  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  res.json({ removed: true })
})

export default router
