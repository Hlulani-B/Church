import { Router } from 'express'
import supabase from '../supabase.js'

/*
  Writing the real `testimony` table — the one a signed-in member shares into.

  This route exists because the browser used to insert these rows itself, on the public anon key
  and with no Supabase sign-in (auth lives in Firebase, so the anon client is never authenticated).
  With row level security on `testimony`, an anon INSERT has no policy to satisfy and the database
  answers "new row violates row-level security policy". The read stays where it is — an anon SELECT
  has a policy and works — but the write moves here, where ../supabase.js speaks with the service
  key and so stands outside row level security, exactly like every other write in this server.

  The value is opaque by design, just as the extra_testimony route treats it: the browser puts
  encrypted words (an `enc:v1:` string) or an uploaded file's public URL in `body`, and stores the
  author's own address as ciphertext in `user_email`. Nothing here opens either — it is written and
  returned exactly as it came, so the at-rest encryption stays entirely client-side.
*/

const router = Router()

const TYPES = ['text', 'image', 'pdf', 'docx']

function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

// allow_all is the switch: true empties authorise and opens the row; false keeps the listed addresses.
function shapePermission({ allow_all, authorise }) {
  const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
  const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []
  return { everyone, authorised }
}

router.post('/', async (req, res) => {
  const { community_id, user_email, date, body, type, allow_all, authorise } = req.body || {}

  const missing = [
    ['community_id', community_id],
    ['user_email', user_email],
    ['body', body],
  ]
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([field]) => field)

  if (missing.length) {
    res.status(400).json({ error: 'missing_fields', missing })
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

  const { everyone, authorised } = shapePermission({ allow_all, authorise })

  const { data, error } = await supabase
    .from('testimony')
    .insert({
      community_id: String(community_id).trim(),
      user_email: String(user_email),
      date: day(date),
      body: String(body),
      type: kind,
      allow_all: everyone,
      authorise: authorised,
    })
    .select('testimony_id, user_email, date, body')

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
  Changing who may read a testimony — the two fields the write sets. allow_all true empties the
  authorise list and opens the row to everybody; false stores the given addresses and narrows
  reading to them. The row is addressed by testimony_id.
*/
router.patch('/:testimony_id', async (req, res) => {
  const { allow_all, authorise } = req.body || {}
  const { everyone, authorised } = shapePermission({ allow_all, authorise })

  const { data, error } = await supabase
    .from('testimony')
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

// Removing one testimony, kept for parity with the other write routes.
router.delete('/:testimony_id', async (req, res) => {
  const { data, error } = await supabase
    .from('testimony')
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
