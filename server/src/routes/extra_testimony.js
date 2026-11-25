import { Router } from 'express'
import supabase from '../supabase.js'

/*
  extra_testimony — a sharing recorded on behalf of an extra member (someone who never uses the
  app), by a leader or an admin.

  The body is opaque to this server: the browser puts encrypted words (an `enc:v1:` string) or an
  uploaded file's public URL in it before asking for the write, so nothing here opens or reads it
  back — it is stored and returned exactly as it came. That keeps the at-rest encryption entirely
  client-side, the way the real testimony table already works.

  Whether a testimony may be read is the two columns allow_all and authorise, and it is settled
  here because these rows are read through the service key rather than row level security:
    - allow_all true (or a row that never set it) opens the testimony to everyone;
    - allow_all false narrows reading to the addresses held in authorise.
  A viewer is named by the viewer_email the page passes — the address off the caller's own sign-in.
*/

const router = Router()

function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

// allow_all is the switch: true means authorise is emptied; false keeps the listed addresses.
function shapePermission({ allow_all, authorise }) {
  const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
  const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []
  return { everyone, authorised }
}

/*
  The same rule the browser-side testimony read uses: a row that never set allow_all stays
  readable, an allow_all row opens to anybody, and a restricted row only opens to an address that
  is on its authorise list (matched case-insensitively, since the list came from the roster).
*/
function canRead(row, viewer_email) {
  if (row.allow_all !== false) return true
  const list = Array.isArray(row.authorise) ? row.authorise : []
  const viewer = String(viewer_email || '').toLowerCase()
  return list.some((one) => String(one).toLowerCase() === viewer)
}

const TYPES = ['text', 'image', 'pdf', 'docx']

router.post('/', async (req, res) => {
  const { community_id, member_id, date, body, type, allow_all, authorise, recorded_by } =
    req.body || {}

  if (!community_id || String(community_id).trim() === '') {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }
  if (!member_id || String(member_id).trim() === '') {
    res.status(400).json({ error: 'missing_fields', missing: ['member_id'] })
    return
  }
  if (!day(date)) {
    res.status(400).json({ error: 'bad_date', message: 'Pick the day this testimony belongs to.' })
    return
  }
  const kind = String(type || 'text').trim().toLowerCase()
  if (!TYPES.includes(kind)) {
    res.status(400).json({ error: 'bad_type', message: 'A testimony is one of text, image, pdf or docx.' })
    return
  }
  if (body === undefined || body === null || String(body).trim() === '') {
    res.status(400).json({ error: 'missing_fields', missing: ['body'] })
    return
  }

  const { everyone, authorised } = shapePermission({ allow_all, authorise })

  const { data, error } = await supabase
    .from('extra_testimony')
    .insert({
      community_id: String(community_id).trim(),
      member_id: String(member_id).trim(),
      date: day(date),
      body: String(body),
      type: kind,
      allow_all: everyone,
      authorise: authorised,
      recorded_by: recorded_by ? String(recorded_by).trim().toLowerCase() : null,
    })
    .select()

  if (error) {
    res.status(500).json({ error: 'insert_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(500).json({ error: 'insert_failed', message: 'The testimony did not come back.' })
    return
  }
  res.status(201).json(data[0])
})

/*
  This community's testimonies, newest first, narrowed to what the viewer may read. The whole set is
  fetched for the community and each row is checked against the viewer's own address, so a restricted
  testimony only reaches a screen its author allowed. The joined extra_members(name, surname) rides
  along so the page can say whose sharing it is without a second read.

  `for_all` asks for every testimony in the community regardless of permission: it is a leader's or
  admin's register view, gated by the caller having said so, and is never what a member's screen uses.
*/
router.get('/', async (req, res) => {
  const { community_id, viewer_email, member_id, for_all } = req.query
  if (!community_id) {
    res.status(400).json({ error: 'missing_fields', missing: ['community_id'] })
    return
  }

  let query = supabase
    .from('extra_testimony')
    .select('testimony_id, community_id, member_id, date, body, type, authorise, allow_all, recorded_by, extra_members(name, surname)')
    .eq('community_id', String(community_id).trim())
    .order('date', { ascending: false })
    .order('testimony_id')

  if (member_id) query = query.eq('member_id', String(member_id).trim())

  const { data, error } = await query
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }

  const rows = data || []
  const visible = for_all === 'true' ? rows : rows.filter((one) => canRead(one, viewer_email))
  res.json(visible)
})

// The exact testimonies one extra member has, whatever their permission — for that member's own page.
router.get('/member/:member_id', async (req, res) => {
  const { viewer_email, for_all } = req.query
  const { data, error } = await supabase
    .from('extra_testimony')
    .select('testimony_id, community_id, member_id, date, body, type, authorise, allow_all, recorded_by')
    .eq('member_id', req.params.member_id)
    .order('date', { ascending: false })
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  const rows = data || []
  const visible = for_all === 'true' ? rows : rows.filter((one) => canRead(one, viewer_email))
  res.json(visible)
})

// One testimony, by id.
router.get('/:testimony_id', async (req, res) => {
  const { viewer_email, for_all } = req.query
  const { data, error } = await supabase
    .from('extra_testimony')
    .select('testimony_id, community_id, member_id, date, body, type, authorise, allow_all, recorded_by')
    .eq('testimony_id', req.params.testimony_id)
    .maybeSingle()
  if (error) {
    res.status(500).json({ error: 'read_failed', message: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'not_found', message: 'No such testimony.' })
    return
  }
  if (for_all !== 'true' && !canRead(data, viewer_email)) {
    res.status(403).json({ error: 'not_allowed', message: 'You are not allowed to read this testimony.' })
    return
  }
  res.json(data)
})

/*
  Changing who may read a testimony — the two fields the write sets. The authorise list is stored
  as the addresses the picker chose; a caller wanting to open the row again sets allow_all true and
  the list is emptied.
*/
router.patch('/:testimony_id', async (req, res) => {
  const { allow_all, authorise } = req.body || {}
  const { everyone, authorised } = shapePermission({ allow_all, authorise })

  const { data, error } = await supabase
    .from('extra_testimony')
    .update({ allow_all: everyone, authorise: authorised })
    .eq('testimony_id', req.params.testimony_id)
    .select('testimony_id, allow_all, authorise')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: 'update_failed', message: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'not_found', message: 'That testimony could not be found.' })
    return
  }
  res.json(data)
})

// Removing one testimony.
router.delete('/:testimony_id', async (req, res) => {
  const { data, error } = await supabase
    .from('extra_testimony')
    .delete()
    .eq('testimony_id', req.params.testimony_id)
    .select('testimony_id')
  if (error) {
    res.status(500).json({ error: 'delete_failed', message: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'not_found', message: 'No such testimony.' })
    return
  }
  res.json({ removed: true, testimony_id: data[0].testimony_id })
})

export default router
