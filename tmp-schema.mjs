import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

const res = await fetch(env.SUPABASE_URL + '/rest/v1/', {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
})
const spec = await res.json()
console.log('status', res.status, 'tables:', Object.keys(spec.definitions || {}).join(', '))
for (const table of process.argv.slice(2)) {
  const def = spec.definitions?.[table]
  console.log('===', table, '===')
  if (!def) {
    console.log('MISSING')
    continue
  }
  for (const [column, meta] of Object.entries(def.properties)) {
    console.log(
      ' ',
    column, '|', meta.type, meta.format ? '(' + meta.format + ')' : '',
      meta.description && !meta.description.startsWith(table + '.') ? '| ' + meta.description : '',
    )
  }
  console.log(' primaryKeys:', JSON.stringify(def.primaryKeys))
}
