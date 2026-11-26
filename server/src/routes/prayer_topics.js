import { Router } from 'express'
import supabase from '../supabase.js'

/*
  prayer_topics — what somebody in a community asked the fellowship to pray for, and the day they
  asked it.

  Four things on the row and nothing else: which community it belongs to, whose address asked for
  it, the day, and the words themselves. The row is addressed by `topic_id`, so a change or a
  removal says which one it means. `user_email` is stored exactly as it arrives, because the app
  keeps a testimony's author the same way — the server never opens anything the client chose to
  wrap, and it does not go looking up who an address belongs to either.

  Everything runs on the service key through ../supabase.js, so row level security on the table
  never refuses a write the way it refused the browser's anon INSERTs. The browser talks to these
  four endpoints and never holds that key.
*/

const router = Router()

const SELECT = 'topic_id, community_id, user_email, date, topic'

function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

// The day a topic carries no date of its own falls on today, in the server's own calendar.
function today() {
  const now = new Date()
  const pad = (one) => String(one).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Whether a request simply left the day out, as opposed to naming one badly.
function dateOmitted(value) {
  return value === undefined || value === null || String(value).trim() === ''
}

router.post('/', async (req, res) => {
  const { community_id, user_email, topic, date } = req.body || {}

  const missing = [
    ['community_id', community_id],
    ['user_email', user_email],
    ['topic', topic],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
    return
  }
  if (!dateOmitted(date) && !day(date)) {
    res.status(400).json({ error: 'bad_date', message: 'date must be YYYY-MM-DD' })
    return
  }

  const { data, error } = await supabase
    .from('prayer_topics')
    .insert({
      community_id: String(community_id).trim(),
      user_email: String(user_email).trim(),
      topic: String(topic).trim(),
      date: day(date) || today(),
    })
    .select(SELECT)

  if (error) {
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'insert_failed', message: 'The prayer topic did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  This community's topics, newest day first. Every filter stacks on top of the community: a day for
  one evening's list, an address for what a single person has asked for.
*/
router.get('/', async (req, res) => {
  const { community_id, date, user_email } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }
  if (!dateOmitted(date) && !day(date)) {
    res.status(400).json({ error: 'bad_date', message: 'date must be YYYY-MM-DD' })
    return
  }

  let query = supabase
    .from('prayer_topics')
    .select(SELECT)
    .eq('community_id', String(community_id).trim())
    .order('date', { ascending: false })
    .order('topic_id')

  if (day(date)) query = query.eq('date', day(date))
  if (user_email) query = query.eq('user_email', String(user_email).trim())

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  res.json(data || [])
})

// Rewording a topic, or moving it to another day. Whichever arrives is what changes.
router.patch('/:topic_id', async (req, res) => {
  const { topic, date } = req.body || {}
  const changes = {}

  if (topic !== undefined) {
    const words = String(topic ?? '').trim()
    if (!words) {
      res.status(400).json({ error: 'missing_fields', missing: ['topic'] })
      return
    }
    changes.topic = words
  }
  if (date !== undefined) {
    if (!day(date)) {
      res.status(400).json({ error: 'bad_date', message: 'date must be YYYY-MM-DD' })
      return
    }
    changes.date = day(date)
  }
  if (!Object.keys(changes).length) {
    res.status(400).json({ error: 'missing_fields', missing: ['nothing to change'] })
    return
  }

  const { data, error } = await supabase
    .from('prayer_topics')
    .update(changes)
    .eq('topic_id', req.params.topic_id)
    .select(SELECT)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'not_found', message: 'No such prayer topic.' })
    return
  }
  res.json(data)
})

// Removing one topic.
router.delete('/:topic_id', async (req, res) => {
  const { data, error } = await supabase
    .from('prayer_topics')
    .delete()
    .eq('topic_id', req.params.topic_id)
    .select('topic_id')

  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such prayer topic.' })
    return
  }
  res.json({ removed: true, topic_id: data[0].topic_id })
})

export default router
