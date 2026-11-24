/*
  A read-only probe of the new functions path against the live project, through the same God
  dispatcher the endpoints use. It writes nothing. It answers four questions:

    1. Does `church_function` / `list` dispatch, and does the service key read the table at all
       (row level security is on and no policy exists, so this is the first proof that the
       service key is what makes the page work)?
    2. Does the dispatcher refuse a list with no community_id?
    3. Does the anon key get zero rows from the same read — the claim architecture.md makes
       about the RLS-protected tables, now said about these three as well.
    4. Does the opened-out `details` read dispatch, refuse either half missing, and give the anon
       key nothing to fold out?
*/
import { readFileSync } from 'node:fs'
import { God } from './lib/god.js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

const url = env.SUPABASE_URL
const service = new God(url, env.SUPABASE_SERVICE_ROLE_KEY)
const browser = new God(url, env.SUPABASE_ANON_KEY)

const communities = await service.call('community', { function: 'all' })
console.log(`communities: ${communities.length}`)

let answered = null
for (const one of communities) {
  const rows = await service.call('church_function', {
    function: 'list',
    community_id: one.community_id,
  })
  if (rows.length) answered = { community: one.name, rows }
  console.log(
    `  ${one.name.padEnd(28)} functions: ${String(rows.length).padStart(2)}`,
  )
}
if (answered) {
  console.log('first community with a planned function:', JSON.stringify(answered, null, 2))
}

try {
  await service.call('church_function', { function: 'list' })
  console.log('FAIL: a list with no community_id was not refused')
} catch (error) {
  console.log(`refused without a community: ${error.message}`)
}

const probe = communities[0]
if (probe) {
  const withAnon = await browser
    .call('church_function', { function: 'list', community_id: probe.community_id })
    .then((rows) => `${rows.length} rows`)
    .catch((error) => `error: ${error.message || error.code}`)
  console.log(`anon key on "functions" for ${probe.name}: ${withAnon}`)
}

/*
  The opened-out read, which is the second half of the functions page. Nothing has been planned in
  this project yet, so what is being proved here is the dispatch and the refusal paths rather than a
  real list of names: a details call missing either half is turned away by the dispatcher, and a
  function id that matches no row is answered as "no such function" by the class rather than as an
  empty page.
*/
for (const missing of ['function_id', 'community_id']) {
  const args = { function: 'details', community_id: probe?.community_id, function_id: 1 }
  delete args[missing]
  try {
    await service.call('church_function', args)
    console.log(`FAIL: a details call with no ${missing} was not refused`)
  } catch (error) {
    console.log(`details with no ${missing}: ${error.message}`)
  }
}

if (probe) {
  const opened = await service
    .call('church_function', { function: 'details', community_id: probe.community_id, function_id: 1 })
    .then((read) => `opened “${read.function.name}” with ${read.people.length} answers`)
    .catch((error) => `refused: ${error.message || error.code}`)
  console.log(`details against ${probe.name}: ${opened}`)

  const openedAnon = await browser
    .call('church_function', { function: 'details', community_id: probe.community_id, function_id: 1 })
    .then((read) => `${read.people.length} answers, which would be a leak`) 
    .catch((error) => `refused: ${error.message || error.code}`)
  console.log(`anon key on the same details call: ${openedAnon}`)
}
