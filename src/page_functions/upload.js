/*
  The one browser call that puts a file in the public `kopano` bucket.

  A testimony picture and a payment receipt both used to reach the bucket straight from the page, on
  the public anon key and with nothing signed in — auth lives in Firebase, so the anon Supabase
  client never carries a token. With row level security on `storage.objects` that insert is refused
  with "new row violates row-level security policy", the same wall the testimony row itself hit.

  The bytes go to the standalone server now (server/src/routes/upload.js), which writes them with the
  service key and so stands outside that policy — exactly how servings and every extra_* row is
  already written. The page still chooses the path (namespaced by person and day/function) and still
  does any lossless preparation first; this only hands the finished bytes over and returns the public
  URL the server read back. It is the same base url the app already uses for those writes.
*/
const API_URL = import.meta.env.VITE_SERVINGS_API_URL

export async function uploadViaServer(path, blob) {
  if (!API_URL) {
    throw new Error('VITE_SERVINGS_API_URL is not set, so a file cannot be uploaded.')
  }

  const type = blob && blob.type ? blob.type : 'application/octet-stream'
  const params = new URLSearchParams({ path, contentType: type })
  const res = await fetch(`${API_URL}/upload?${params.toString()}`, {
    method: 'POST',
    // The real type rides on the query; the body is sent as raw bytes so the server reads it whole.
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {
    // A reply that was not JSON is handled just below, alongside the status.
  }

  if (!res.ok) {
    throw new Error(
      payload?.message || payload?.error || `The server refused the upload (${res.status}).`,
    )
  }
  if (!payload?.url) {
    throw new Error('The upload came back without a file address.')
  }
  return payload.url
}
