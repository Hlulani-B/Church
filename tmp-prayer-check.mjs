/*
  Walks the four /prayer-topics endpoints against the real database, the way the browser will use
  them: ask for a prayer, list the community's list, narrow it by day and by person, reword one,
  move one to another day, remove one — and then the refusals along the way, a half-empty POST, a
  date that is not a date, a change with nothing in it, an id that was never a topic.

  It boots the app on a port of its own (listen(0)) so a dev server already sitting on 4000 is not
  disturbed, and deletes every row it wrote before it finishes.

    node --env-file=server/.env tmp-prayer-check.mjs

  The report goes to tmp-prayer-check.log, written by this process rather than by shell redirection,
  because PowerShell 5.1 drops a native command's stdout under `*>`.
*/
import { appendFileSync, writeFileSync } from 'node:fs'
import { once } from 'node:events'
import { default as supabase } from './server/src/supabase.js'

const LOG = 'tmp-prayer-check.log'
writeFileSync(LOG, '')
const say = (line) => {
  console.log(line)
  appendFileSync(LOG, `${line}\n`)
}

let passed = 0
let failed = 0
const expect = (label, ok, detail = '') => {
  if (ok) passed += 1
  else failed += 1
  say(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} ${detail}`)
}

const { data: communities, error: communityError } = await supabase
  .from('community')
  .select('community_id, name')
  .limit(1)

if (communityError || !communities?.length) {
  say(`no community to test against: ${communityError?.message || 'the table is empty'}`)
  process.exit(1)
}

const COMMUNITY = communities[0].community_id
const MINE = 'prayer.check@example.com'
const OTHER = 'prayer.other@example.com'
const HERE = 'Pray for the visit on Saturday'
const NOWHERE = crypto.randomUUID()

const app = (await import('./server/src/app.js')).default
const server = app.listen(0)
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

const call = async (method, path, body) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}

const written = []
const keep = (row) => {
  written.push(row.topic_id)
  return row
}

say(`community: ${communities[0].name}  (${COMMUNITY})\n`)

say('POST  a topic for a day')
let asked = await call('POST', '/prayer-topics', {
  community_id: COMMUNITY,
  user_email: MINE,
  topic: `  ${HERE}  `,
  date: '2026-11-21',
})
expect('201 created', asked.status === 201, `${asked.status}`)
expect('row carries all four columns', Boolean(asked.json?.topic_id && asked.json?.community_id && asked.json?.user_email && asked.json?.date), JSON.stringify(asked.json))
expect('the topic arrives trimmed', asked.json?.topic === HERE, String(asked.json?.topic))
expect('the date is the one sent', asked.json?.date === '2026-11-21', String(asked.json?.date))
const first = asked.json?.topic_id ? keep(asked.json) : {}

say('\nPOST  a topic with no date, and one for another person')
asked = await call('POST', '/prayer-topics', { community_id: COMMUNITY, user_email: OTHER, topic: 'For the sick in the ward' })
expect('201 without a date', asked.status === 201, `${asked.status}`)
const todays = new Date()
const pad = (one) => String(one).padStart(2, '0')
const today = `${todays.getFullYear()}-${pad(todays.getMonth() + 1)}-${pad(todays.getDate())}`
expect('the row is dated today', asked.json?.date === today, String(asked.json?.date))
const second = asked.json?.topic_id ? keep(asked.json) : {}

say('\nGET  the community list, then narrowed')
let list = await call('GET', `/prayer-topics?community_id=${COMMUNITY}`)
expect('200 and an array', list.status === 200 && Array.isArray(list.json), `${list.json?.length} rows`)
expect('both new rows are in it', [first, second].every((one) => list.json?.some((row) => row.topic_id === one.topic_id)))
expect('newest day first', list.json?.[0]?.date === today, String(list.json?.[0]?.date))
expect("another community's rows stay out", list.json?.every((row) => row.community_id === COMMUNITY))

list = await call('GET', `/prayer-topics?community_id=${COMMUNITY}&date=2026-11-21`)
expect('a day narrows to that day', list.status === 200 && list.json?.length === 1 && list.json[0].topic_id === first.topic_id, `${list.json?.length} rows`)

list = await call('GET', `/prayer-topics?community_id=${COMMUNITY}&user_email=${OTHER}`)
expect('an address narrows to that person', list.status === 200 && list.json?.length === 1 && list.json[0].topic_id === second.topic_id, `${list.json?.length} rows`)

say('\nPATCH  reword one, then move it to another day')
let changed = await call('PATCH', `/prayer-topics/${first.topic_id}`, { topic: 'Pray for the Saturday visit and the drive' })
expect('200 with the new words', changed.status === 200 && changed.json?.topic === 'Pray for the Saturday visit and the drive', String(changed.json?.topic))
expect('the day is untouched', changed.json?.date === '2026-11-21', String(changed.json?.date))

changed = await call('PATCH', `/prayer-topics/${first.topic_id}`, { date: '2026-11-22' })
expect('200 with the new day', changed.status === 200 && changed.json?.date === '2026-11-22', String(changed.json?.date))
expect('the words are untouched', changed.json?.topic === 'Pray for the Saturday visit and the drive', String(changed.json?.topic))

say('\nDELETE  both rows, then look for them again')
let gone = await call('DELETE', `/prayer-topics/${first.topic_id}`)
expect('200 says it was removed', gone.status === 200 && gone.json?.removed === true, JSON.stringify(gone.json))
gone = await call('DELETE', `/prayer-topics/${second.topic_id}`)
expect('the second goes too', gone.status === 200 && gone.json?.topic_id === second.topic_id)
list = await call('GET', `/prayer-topics?community_id=${COMMUNITY}&date=2026-11-22`)
expect('the list no longer holds them', list.status === 200 && list.json?.length === 0, `${list.json?.length} rows`)

say('\nthe refusals')
let turn = await call('POST', '/prayer-topics', { community_id: COMMUNITY, topic: '  ' })
expect('a POST with no person, no words', turn.status === 400 && turn.json?.error === 'missing_fields', JSON.stringify(turn.json?.missing))
turn = await call('POST', '/prayer-topics', { community_id: COMMUNITY, user_email: MINE, topic: 'A date that is not one', date: '21/11/2026' })
expect('a POST with a bad date', turn.status === 400 && turn.json?.error === 'bad_date', `${turn.status}`)
turn = await call('GET', '/prayer-topics')
expect('a GET with no community', turn.status === 400 && turn.json?.missing?.[0] === 'community_id', `${turn.status}`)
turn = await call('GET', `/prayer-topics?community_id=${COMMUNITY}&date=nope`)
expect('a GET with a bad date', turn.status === 400 && turn.json?.error === 'bad_date', `${turn.status}`)
turn = await call('PATCH', `/prayer-topics/${second.topic_id}`, {})
expect('a PATCH with nothing to change', turn.status === 400 && turn.json?.error === 'missing_fields', `${turn.status}`)
turn = await call('PATCH', `/prayer-topics/${NOWHERE}`, { topic: 'Nobody owns this id' })
expect('a PATCH on a stranger id is 404', turn.status === 404 && turn.json?.error === 'not_found', `${turn.status}`)
turn = await call('DELETE', `/prayer-topics/${NOWHERE}`)
expect('a DELETE on a stranger id is 404', turn.status === 404 && turn.json?.error === 'not_found', `${turn.status}`)

// Whatever is still standing from a partly-run earlier pass, this one takes back out.
const left = await supabase.from('prayer_topics').delete().in('topic_id', written).select('topic_id')
say(`\ncleanup: ${left.data?.length || 0} rows removed${left.error ? ` (${left.error.message})` : ''}`)

server.closeAllConnections?.()
server.close()
await new Promise((done) => setTimeout(done, 200))
say(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
