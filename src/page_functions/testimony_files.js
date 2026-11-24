/*
  Preparing and storing a testimony file in the public `kopano` bucket.

  Compression here is best-effort lossless and it NEVER rejects a file: for images we try a
  lossless PNG re-encode through a canvas and keep it only if it is genuinely smaller, otherwise
  we pass the original straight through. pdf and docx have no lossless recompression available
  in the browser at all, so they are stored as-is. The 500 KB / 1 MB figures are a target, not a
  limit — a file that cannot be shrunk losslessly still gets uploaded whole.

  The bucket is public-read, so the stored value is the plain public URL; no signed URLs needed.
*/

const BUCKET = 'kopano'

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

function extensionFor(blob, fallback) {
  return EXTENSIONS[blob.type] || fallback || 'bin'
}

// Lossless, best-effort. Returns the smaller PNG if one was produced, else the original file.
async function shrinkImageLosslessly(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    if (bitmap.close) bitmap.close()
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (png && png.size < file.size) return png
  } catch {
    /* canvas or codec unavailable on this device — fall through, never reject */
  }
  return file
}

// Which testimony type a chosen file is, after best-effort lossless preparation.
export async function prepareTestimonyFile(file) {
  if (!file) throw new Error('No file was chosen.')
  const type = String(file.type || '').toLowerCase()
  if (type.startsWith('image/')) return { kind: 'image', blob: await shrinkImageLosslessly(file) }
  if (type === 'application/pdf') return { kind: 'pdf', blob: file }
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return { kind: 'docx', blob: file }
  }
  throw new Error(`That file type cannot be attached to a testimony: ${type || file.name}`)
}

function folder(email) {
  return String(email || 'anon').replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
}

/*
  Upload and return the public URL. `client` is the same anon-key Supabase client the testimonies
  page already uses, so the write follows whatever Storage policy is set on `kopano`. The path is
  namespaced by author and day so files never collide.
*/
export async function uploadTestimonyFile(client, blob, { kind, ownerEmail, date }) {
  const path = `testimonies/${folder(ownerEmail)}/${date || 'undated'}/${crypto.randomUUID()}.${extensionFor(blob, kind)}`
  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: false,
    })
  if (error) throw new Error(error.message)
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
