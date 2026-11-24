import express from 'express'
import routes from './routes/index.js'

/*
  The Express app, created and configured but not started. index.js boots it; keeping the
  app separate lets tests or other entry points import it without opening a port.
*/

const app = express()

/*
  The browser calls this server from its own dev origin while this listens on
  4000, so a JSON POST or PATCH is cross-origin: the browser sends a preflight OPTIONS first,
  and every request that does not get an Access-Control-Allow-Origin naming its exact origin
  back is blocked before it ever reaches a route. Local dev origins are answered; anywhere
  else (production, where this is same-origin behind one host) no CORS headers go out.
*/
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

// Where the app itself is served from. A browser names its own origin on every cross-origin call,
// so the deployed site has to be listed here (or in CORS_ORIGINS) before this server will answer
// it — an Origin header never carries a trailing slash or a path, so both are trimmed off here and
// writing "https://church-juef.vercel.app/" reads the same as without it.
const DEPLOYED_ORIGINS = ['https://church-juef.vercel.app']

const bare = (one) => String(one || '').trim().replace(/\/+$/, '')
const ALLOWED_ORIGINS = new Set([
  ...DEPLOYED_ORIGINS.map(bare),
  ...String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(bare)
    .filter(Boolean),
])
const IS_DEV = process.env.NODE_ENV !== 'production'

/*
  The dev port is not pinned, because it has already moved twice: Vite's own 5173, then 3000 once
  the app was served through `vercel dev`, which hands Vite the port it picks. So any loopback
  origin is let through while this runs in dev. Anywhere else only the named origins are answered,
  and a deployment that needs to add one without touching this file lists it in CORS_ORIGINS,
  comma separated:  CORS_ORIGINS="https://preview-xyz.vercel.app,https://other.vercel.app"
  The caller's own string is what goes back in the header, because Access-Control-Allow-Origin has
  to name the origin exactly as the browser sent it — only the comparison is trimmed.
*/
function allowedOrigin(value) {
  const given = String(value || '').trim()
  if (!given) return null
  if (ALLOWED_ORIGINS.has(bare(given))) return given
  return IS_DEV && LOCAL_ORIGIN.test(given) ? given : null
}

app.use((req, res, next) => {
  const origin = allowedOrigin(req.headers.origin)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

app.use(express.json())

app.use('/', routes)

// Anything that matched no route.
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl })
})

// Central error handler; feature routes can throw and let this answer.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: 'internal_error', message: err.message })
})

export default app
