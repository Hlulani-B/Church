import { createClient } from '@supabase/supabase-js'

/*
  Putting a proof of payment where a function can point at it.

  The file leaves the browser straight for storage, on the public anon key, exactly the way a
  testimony's file does: the same `kopano` bucket, so a receipt is allowed or refused by whatever
  storage policy that bucket already carries rather than by anything written here. What comes back is
  a public url, and that url is what `function_paid.proof_path` holds. The row itself still goes
  through /api/self, because the two tables under a function have row level security with no policy
  and a browser can write neither.

  Nothing is re-encoded on the way up. A testimony's pictures are shrunk because they are read on
  screen; a receipt is the document the bank issued, and a version of it that has been through a
  canvas is no longer the thing a leader would recognise. So a picture is stored as the camera took it
  and a PDF as it was downloaded, whatever the size.

  The path is namespaced by person and by function, so two receipts for the same function by two
  people cannot land on one file and a second upload never overwrites the first — `upsert` is off,
  which means an accidental repeat of the same name is refused rather than silently replacing
  evidence somebody already had looked at.
*/

const BUCKET = 'kopano'

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

// The extension the stored file keeps. Taken from the type the device reported, falling back to what
// kind of file this was judged to be, because a phone that reports no type at all still has a picture.
function extensionFor(file, fallback) {
  return EXTENSIONS[String(file.type || '').toLowerCase()] || fallback
}

function folder(email) {
  return String(email || 'anon').replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
}

/*
  One client for the whole session, built lazily so that loading this module costs nothing until a
  receipt is actually chosen. The two auth options are what the testimonies client sets too: nothing
  here signs anybody in, and the browser must not start listening to the url for a code that is not
  coming.
*/
let client
function bucket() {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        'This build has no Supabase url and key, so a receipt cannot be attached to a function.',
      )
    }
    client = createClient(url, key, {
      auth: { persistSession: false, detectSessionInUrl: false },
    })
  }
  return client.storage.from(BUCKET)
}

/*
  Uploads a chosen receipt and returns the public url the row will be written with. A picture or a
  PDF, because those are the two things a bank or an e-wallet will give you; anything else — a
  spreadsheet, a document, a video of the screen — is refused here rather than uploaded and left
  unreadable by whoever has to check it.
*/
export async function uploadProof(file, { email, function_id }) {
  if (!file) throw new Error('No file was chosen.')
  const type = String(file.type || '').toLowerCase()
  const isImage = type.startsWith('image/')
  if (!isImage && type !== 'application/pdf') {
    throw new Error(
      `A proof of payment has to be a picture or a PDF, and this is ${type || file.name}.`,
    )
  }
  const path = `functions/${folder(email)}/${function_id}/${crypto.randomUUID()}.${extensionFor(
    file,
    isImage ? 'img' : 'pdf',
  )}`
  const { error } = await bucket().upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return bucket().getPublicUrl(path).data.publicUrl
}
