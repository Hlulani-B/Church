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

  One thing is read rather than passed through: when a row is deleted, the file whose address its
  `body` carried goes out of the bucket with it, because the row was the only thing that knew the file
  existed. That is the whole of the server's part in taking a testimony back out — which rows belong to
  the person asking is a question only the browser's key can answer.
*/

const router = Router()

const TYPES = ['text', 'image', 'pdf', 'docx']

const BUCKET = 'kopano'

// The shape every upload from this app comes back as, and the only folder this table's files live in.
const PUBLIC = `/storage/v1/object/public/${BUCKET}/`
const FOLDER = 'testimonies/'

/*
  A stored `body` that is one of this bucket's testimony files, read back as the path of the object
  inside it — and empty for anything else. Encrypted words hold no address, a link somebody typed into
  a box on another site is not this project's file to delete, and an object outside `testimonies/` was
  put there by a different table's writer, which is the one that has to answer for it. This is the same
  reading `bucketPath` does in src/functions/community_purge.js, kept local because the standalone
  server does not reach into the browser's source tree.
*/
function objectPath(value) {
  const text = String(value || '').trim()
  const at = text.indexOf(PUBLIC)
  if (at < 0) return ''
  const rest = text.slice(at + PUBLIC.length).split('?')[0]
  if (!rest.startsWith(FOLDER) || rest.split('/').includes('..')) return ''
  try {
    return decodeURIComponent(rest)
  } catch {
    // A path with a stray `%` in it is not a name the uploader ever wrote, so it is not one to delete.
    return ''
  }
}

function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

/*
  `testimony_id` is a uuid column, so a string that is not one names no row — and yet Postgres answers
  the comparison with a type error rather than an empty result, which on a delete would surface as a
  500 about a testimony that is simply not there. The shape is checked first, so an id that could never
  have come from this table is answered the way an absent row is.
*/
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
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

// Removing one testimony, and the file that was the sharing when the sharing was a file.
router.delete('/:testimony_id', async (req, res) => {
  if (!isUuid(req.params.testimony_id)) {
    res.status(404).json({ error: 'not_found', message: 'No such testimony.' })
    return
  }
  /*
    The row is read before it goes, because `body` is the only place the file's address was ever
    written down. A text testimony keeps encrypted words in that column and a file keeps its public
    url, so the read is what tells the two apart; once the row is deleted nothing can say what was
    uploaded, and the object would sit in the bucket taking room for a sharing nobody can find.

    Only the browser's own lossless preparation put a file here, and only this route's inserts wrote
    the row, so an object nobody can name any more is a file nobody can load either.
  */
  const { data: row } = await supabase
    .from('testimony')
    .select('testimony_id, body')
    .eq('testimony_id', req.params.testimony_id)
    .maybeSingle()

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

  const path = objectPath(row?.body)
  if (!path) {
    res.json({ removed: true, testimony_id: data[0].testimony_id, file: null })
    return
  }
  /*
    The row is gone either way, so a bucket that refuses is reported rather than reversed — a testimony
    nobody can read is not being kept alive by its file. What is said out loud is the difference between
    "the room got smaller" and "it did not", which is the difference the caller cares about.
  */
  const { error: fileError } = await supabase.storage.from(BUCKET).remove([path])
  res.json({
    removed: true,
    testimony_id: data[0].testimony_id,
    file: { path, taken: !fileError },
  })
})

export default router
