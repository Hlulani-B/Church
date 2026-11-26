/*
  Getting a stored file into a shape a PDF can hold.

  Every attachment in this app — a payment receipt, a testimony picture — is a public url in the
  `kopano` bucket, kept in a column like `function_paid.proof_path`. The bucket answers
  `access-control-allow-origin: *`, which is why proof_viewer.jsx can already open these files in the
  page, and the same fetch is what makes it possible to copy the bytes into an exported document here.

  What comes back is a data url ready for jsPDF, or a reason there is none. An image is redrawn
  through a canvas, which does three jobs at once: it flattens transparency onto white so a receipt
  photographed on a phone prints rather than vanishing, it converts the formats jsPDF cannot place
  (webp, gif, avif) into one it can, and it caps the longest side so one 12-megapixel upload cannot
  turn a 40-row register into a 200 MB archive. Nothing is lossy about the *information* — a document
  meant to be read after the row is deleted — and the original path is always carried along with it,
  so the exact file can still be fetched from the bucket afterwards.
*/

const IMAGES = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp']
const MAX_SIDE = 1600
const QUALITY = 0.85

// Which of the three things a url points at, read off the extension the uploader wrote into the path —
// the same rule proof_viewer.jsx uses, so an export pastes exactly what the screen shows.
export function kindOf(path) {
  const ext = String(path || '').split('?')[0].split('.').pop().toLowerCase()
  if (IMAGES.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

// The name the uploader gave the file: the last part of the path. A saved file that arrives as
// "download" is no use beside four of them in one folder.
export function nameOf(path) {
  const last = String(path || '').split('?')[0].split('/').pop()
  return last ? decodeURIComponent(last) : 'file'
}

// Is this value a file at all? A testimony `body` is one of three things — encrypted words, an
// uploaded file's url, an old plain-text row — and only the middle one has bytes to paste.
export function isFilePath(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

/*
  One file, fetched and prepared. Never throws: an archive that stops because a single receipt has
  gone missing is worse than one that says so on the line where the picture would have been. The
  caller always gets `path` and `name` back, plus `dataUrl`/`format`/`width`/`height` when the file is
  something a page can carry, and `reason` when it is not.
*/
export async function loadAttachment(path) {
  const base = { path: String(path || ''), name: nameOf(path), kind: kindOf(path) }
  if (!base.path) return { ...base, reason: 'nothing was attached' }
  if (base.kind !== 'image') {
    return { ...base, reason: base.kind === 'pdf' ? 'a pdf cannot be pasted, only the path is kept' : 'not an image' }
  }

  try {
    const response = await fetch(base.path)
    if (!response.ok) return { ...base, reason: `the file refused to load (${response.status})` }
    const blob = await response.blob()
    const drawn = await rasterise(blob)
    return drawn ? { ...base, ...drawn } : { ...base, reason: 'the picture could not be read' }
  } catch (error) {
    return { ...base, reason: `the file could not be read (${error.message || 'network'})` }
  }
}

// Bytes → a canvas → a JPEG data url. Returns null when the browser cannot decode the file at all,
// which is said as a reason by the caller rather than as a half-blank page.
async function rasterise(blob) {
  let bitmap = null
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    // Flattened onto white: a screenshot with a transparent background would otherwise print as a
    // black block, because JPEG has no alpha channel to lose the transparency into.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), format: 'JPEG', width, height }
  } catch {
    return null
  } finally {
    bitmap.close?.()
  }
}

/*
  Every attachment a list of values holds, fetched together. Files are the slow half of an export —
  a register of 40 receipts is 40 fetches — so they are run a handful at a time rather than all at
  once, and returned in the order they were given so a page assembles in the sequence it is printed.
*/
export async function loadAttachments(paths, { limit = 4, onProgress } = {}) {
  const wanted = paths.map((path) => String(path || '')).filter(Boolean)
  const unique = [...new Set(wanted)]
  const loaded = new Map()
  let next = 0
  let done = 0

  async function worker() {
    while (next < unique.length) {
      const index = next++
      const path = unique[index]
      loaded.set(path, await loadAttachment(path))
      done += 1
      onProgress?.({ done, total: unique.length })
    }
  }

  const runners = Array.from({ length: Math.max(1, Math.min(limit, unique.length)) }, worker)
  await Promise.all(runners)
  // A blank path is not a file and is not an error: it is simply nothing attached, said as null so
  // the caller can tell "no receipt" from "the receipt would not load".
  return paths.map((path) => (path ? loaded.get(String(path)) || null : null))
}
