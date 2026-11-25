import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_event — a gathering recorded for an extra member, the same shape the real `event` table
  holds but attached to member_id rather than to an app user's address.

  `attend` is nullable: true came, false is the notice of not coming, null is a row that says only
  that a name was entered on a day. `reason` can only ever be one of the five the column's CHECK
  allows, or nothing at all; anything else is refused here rather than bouncing back as a 23514.
  `recorded_by` is the leader or admin who made the entry — a real user, so it points at users.email.
*/

const router = Router()

const REASONS = ['Work', 'Transport', 'Sick', 'Family', 'Other']

function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

// A tri-state answer: true, false, or null when nothing was chosen.
function attendValue(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

router.post('/', async (req, res) => {
  const { community_id, member_id, event_name, event_date, attend, reason, recorded_by } =
    req.body || {}

  const missing = [
    ['community_id', community_id],
    ['member_id', member_id],
    ['event_date', day(event_date)],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }

  const trimmedReason = String(reason ?? '').trim()
  if (trimmedReason && !REASONS.includes(trimmedReason)) {
    res.status(400).json({ error: 'bad_reason', allowed: REASONS })
    return
  }

  const { data, error } = await supabase
    .from('extra_event')
    .insert({
      community_id: String(community_id).trim(),
      member_id: String(member_id).trim(),
      event_name: event_name ? String(event_name).trim() : null,
      event_date: day(event_date),
      attend: attendValue(attend),
      reason: trimmedReason || null,
      recorded_by: recorded_by ? String(recorded_by).trim().toLowerCase() : null,
    })
    .select()

  if (error) {
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'insert_failed', message: 'The record did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  The records for one community. Every filter is optional and they stack: a day narrows to that
  gathering, a member narrows to that person, and a name narrows to that gathering by name. The
  joined `extra_members(name, surname)` rides along so a list can speak of a person without a
  second read back to this route.
*/
router.get('/', async (req, res) => {
  const { community_id, event_date, event_name, member_id } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }

  let query = supabase
    .from('extra_event')
    .select('event_id, community_id, member_id, event_name, event_date, attend, reason, recorded_by, extra_members(name, surname)')
    .eq('community_id', String(community_id).trim())
    .order('event_date', { ascending: false })
    .order('event_id')

  if (day(event_date)) query = query.eq('event_date', day(event_date))
  if (event_name) query = query.eq('event_name', String(event_name).trim())
  if (member_id) query = query.eq('member_id', String(member_id).trim())

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

// Changing one record's answer, reason or gathering name.
router.patch('/:event_id', async (req, res) => {
  const { event_name, event_date, attend, reason } = req.body || {}
  const changes = {}

  if (event_name !== undefined) changes.event_name = event_name ? String(event_name).trim() : null
  if (event_date !== undefined) {
    if (!day(event_date)) {
      res.status(400).json({ error: 'bad_date', message: 'event_date must be YYYY-MM-DD' })
      return
    }
    changes.event_date = day(event_date)
  }
  if (attend !== undefined) changes.attend = attendValue(attend)
  if (reason !== undefined) {
    const trimmedReason = String(reason ?? '').trim()
    if (trimmedReason && !REASONS.includes(trimmedReason)) {
      res.status(400).json({ error: 'bad_reason', allowed: REASONS })
      return
    }
    changes.reason = trimmedReason || null
  }
  if (!Object.keys(changes).length) {
    res.status(400).json({ error: 'missing_fields', missing: ['nothing to change'] })
    return
  }

  const { data, error } = await supabase
    .from('extra_event')
    .update(changes)
    .eq('event_id', req.params.event_id)
    .select()
  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such record.' })
    return
  }
  res.json(data[0])
})

// Dropping one record.
router.delete('/:event_id', async (req, res) => {
  const { data, error } = await supabase
    .from('extra_event')
    .delete()
    .eq('event_id', req.params.event_id)
    .select('event_id')
  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such record.' })
    return
  }
  res.json({ removed: true, event_id: data[0].event_id })
})

export default router
