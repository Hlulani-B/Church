import { Router, raw } from 'express'
import supabase from '../supabase.js'

/*
  Putting a file in the public `kopano` bucket, server-side.

  Testimony pictures and proofs of payment used to go straight from the browser to storage on the
  public anon key, with nothing signed in — auth lives in Firebase, so the anon client carries no
  Supabase token. A bucket whose `storage.objects` has row level security then refuses that insert
  with "new row violates row-level security policy", the same wall the testimony row itself hit.
  The bytes come here instead, and ../supabase.js writes them with the service key, which stands
  outside storage policies exactly as it stands outside table policies — the same reason servings
  and the extra_* rows are written here rather than in the browser.

  The browser still decides the path (namespaced by person, day/function and a random uuid, so
  nothing ever lands on top of something else) and still does the lossless image preparation before
  the trip; this only carries the finished bytes up. The file arrives as the raw request body —
  `express.raw` keeps it a Buffer untouched — with the path and its own content type on the query,
  because a body can hold one thing only and that thing is the file.

  What comes back is the public URL, exactly the value the browser read off its own client before.
  The bucket is public-read, so the stored file is reached without a signature. Nothing here can
  read a file back: it writes and hands over the address, no more.
*/

const BUCKET = 'kopano'

// A path is refused if it is empty, absolute, or climbs out of the bucket with a `..`.
function safePath(value) {
  const one = String(value || '')
  if (!one) return false
  if (one.startsWith('/')) return false
  return !one.split('/').includes('..')
}

const router = Router()

router.post('/', raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
  const path = req.query.path
  const contentType = req.query.contentType || 'application/octet-stream'

  if (!safePath(path)) {
    res.status(400).json({ error: 'bad_path', message: 'No usable path came with the file.' })
    return
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: 'empty_file', message: 'There were no file bytes to upload.' })
    return
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(String(path), req.body, { contentType, upsert: false })

  if (error) {
    res.status(500).json({ error: 'upload_failed', message: error.message })
    return
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(String(path))
  res.status(201).json({ url: data.publicUrl, path: String(path) })
})

export default router
