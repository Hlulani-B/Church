/*
  CORS for the /api serverless functions.

  The app is same-origin in production — the browser posts to its /api functions on the host that
  served it — so none of this is needed there. It exists for a local dev server that talks
  to an API hosted somewhere else: the browser only lets a cross-origin POST through when
  the response names its exact origin, so every address allowed to call in has to be
  listed here. Add a line per dev origin.
*/
const ALLOWED_ORIGINS = [
  'http://localhost:5137',
  'http://127.0.0.1:5137',
]

/*
  Writes the CORS response headers when the caller's `origin` is allowed, and answers a
  preflight OPTIONS outright. Returns true when the request is fully handled (a preflight),
  so the caller can stop, and false when it should carry on into its own logic.
*/
export function cors(req, res) {
  const origin = req.headers.origin
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  // A Firebase id token rides the Authorization header, not cookies, so these are the only
  // two headers a cross-origin call has to be allowed to send.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
