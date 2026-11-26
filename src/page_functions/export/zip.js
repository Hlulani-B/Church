/*
  Collecting finished PDFs into one zip. One job: names in, archive out.

  The archive is what makes an export of sixty functions a single download rather than sixty files the
  browser will refuse to save without a folder prompt each time. Entries keep their directory in the
  name, so a bundle reads as `functions/<name>.pdf` and `attachments/<name>.jpg` on the way out, and
  compression is left on because a receipt pasted into a PDF is already JPEG — the text pages are what
  shrink.
*/

import { loadJsZip } from './libraries.js'

// DEFLATE 6: the honest middle. A community archive is mostly page text, and this is a one-off
// download a person makes before deleting rows, not a hot path worth maxing compression for.
const COMPRESSION = 6

export async function zipBlobs(entries, { onProgress } = {}) {
  // Through ./libraries.js, for the same reason the pdf does: a chunk the last redeploy renamed has
  // to say so in words a person can act on.
  const JSZip = await loadJsZip()
  const zip = new JSZip()
  for (const one of entries) {
    if (!one || !one.blob || !one.name) continue
    zip.file(one.name, one.blob)
  }
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: COMPRESSION } },
    // The progress a button knows how to show is a count out of a total, so the percentage is read in
    // hundredths rather than handed over as a fraction the caller would have to guess at.
    onProgress
      ? (meta) => onProgress({ done: Math.round(meta.percent), total: 100 })
      : undefined,
  )
}
