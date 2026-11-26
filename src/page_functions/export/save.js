/*
  Handing a finished blob to the browser and getting a file out of it. One job.

  This is the whole download half of the export set: an object url, a hidden anchor, a click, and the
  url revoked again. Doing it through an anchor rather than a `window.open` matters here — a pdf that
  opens in a tab gets read and then closed, and the point of an archive is that it lands in the
  Downloads folder and stays there. The revoke is delayed by a beat because Safari has been known to
  start the save after the click returns, and revoking too early gives it an empty file.
*/

const CLEANUP_DELAY = 4000

export function saveBlob(blob, filename) {
  if (!blob) throw new Error('there was no file to save')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || 'download'
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), CLEANUP_DELAY)
}

/*
  A name safe to save under. Paths come from user-typed function titles and from uploader filenames,
  so they carry slashes, colons, question marks and long runs of space — all of which either create a
  folder, break the extension, or are refused outright by Windows. What is left is trimmed, squashed,
  and cut to a length that still fits next to a timestamp in a directory listing.
*/
export function slug(value, fallback = 'export') {
  const clean = String(value ?? '')
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return (clean || fallback).slice(0, 90)
}

// The date a person needs when they are reading three archives from the same month: `2026-11-26`.
export function stamp(date = new Date()) {
  const pad = (one) => String(one).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
