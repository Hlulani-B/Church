/*
  Checks the one thing that was blocked: does the servings server answer a cross-origin browser
  request with an Access-Control-Allow-Origin naming the caller back. It boots the real app on a
  port of its own (listen(0), so a dev server already sitting on 4000 is not disturbed), then sends
  the exact GET the dashboard makes, the preflight a POST would make, and a stranger's origin.

  The report goes to tmp-cors-check.log, written by this process rather than by shell redirection,
  because PowerShell 5.1 drops a native command's stdout under `*>`.

    node --env-file=server/.env tmp-cors-check.mjs

  Three scenarios run in one process: the app module is re-imported under a fresh specifier each
  time, so its module-level NODE_ENV / CORS_ORIGINS reading is taken again with different settings.
  In dev every loopback origin is answered whatever port Vite sits on; in production nothing is
  answered unless CORS_ORIGINS names it, because there app and server share one host.
*/
import { appendFileSync, writeFileSync } from 'node:fs'
import { once } from 'node:events'

const LOG = 'tmp-cors-check.log'
writeFileSync(LOG, '')
const say = (line) => {
  console.log(line)
  appendFileSync(LOG, `${line}\n`)
}

const COMMUNITY = 'eeac834e-51b6-4ade-a631-667f9b39225b'

async function scenario(label, env) {
  Object.assign(process.env, env)
  // A distinct specifier busts the ESM cache, so app.js reads the new env at import time.
  const { default: app } = await import(`./server/src/app.js?scenario=${encodeURIComponent(label)}`)
  const server = app.listen(0)
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`

  const ask = async (what, { method = 'GET', origin, path = `/servings/roles?community_id=${COMMUNITY}`, extra = {} } = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { Origin: origin, ...extra } })
    const allowed = res.headers.get('access-control-allow-origin')
    let note = ''
    if (method === 'GET' && allowed) {
      try {
        const rows = await res.json()
        note = Array.isArray(rows) ? ` → ${rows.length} servings` : ` → ${JSON.stringify(rows).slice(0, 50)}`
      } catch {
        note = ' (not JSON)'
      }
    }
    say(
      `  ${what.padEnd(38)} ${String(res.status).padStart(3)}  allow-origin: ${String(allowed).padEnd(24)}${note}`,
    )
  }

  say(`\n${label}   (NODE_ENV=${process.env.NODE_ENV || '(unset)'}, CORS_ORIGINS=${process.env.CORS_ORIGINS || '(unset)'})`)
  await ask('GET roles from :3000  (the app today)', { origin: 'http://localhost:3000' })
  await ask('GET roles from :5173  (plain vite)', { origin: 'http://localhost:5173' })
  await ask('GET roles from the deployed app', { origin: 'https://church-juef.vercel.app' })
  await ask('GET roles from an env-named origin', { origin: 'https://extra.vercel.app' })
  await ask('OPTIONS preflight for a POST', {
    method: 'OPTIONS',
    path: '/servings',
    origin: 'http://localhost:3000',
    extra: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  })
  await ask('GET roles from https://evil.example', { origin: 'https://evil.example' })
  server.closeAllConnections?.()
  server.close()
}

await scenario('=== dev (how it runs locally) ===', { NODE_ENV: '', CORS_ORIGINS: '' })
await scenario('=== production, only the built-in deployed origin ===', {
  NODE_ENV: 'production',
  CORS_ORIGINS: '',
})
// Configured WITH a trailing slash, asked WITHOUT one: the browser always sends without.
await scenario('=== production, CORS_ORIGINS written with a trailing slash ===', {
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://extra.vercel.app/',
})
await new Promise((done) => setTimeout(done, 300))
say('\nchecked')
process.exit(0)
