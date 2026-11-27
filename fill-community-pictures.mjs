/*
  Fills the communities that have no banner picture with a mock one.

  `community.picture` is the address the admin dashboard's hero paints, and a community created before
  the column existed — or one nobody has opened Community settings for — holds nothing at all, so the
  banner shows plain. This writes a deterministic photograph address into every empty one, the same
  kind of stand-in the seed uses for a payment receipt: picsum's /seed/<word>/ answers the same picture
  for the same word every time, so a re-run changes nothing and two runs never disagree.

  It goes through the app's own Community class rather than a raw insert, so what lands in the column
  is shaped exactly like what the settings page writes there. An address already saved is left alone
  unless --force is given, because a picture somebody chose themselves is never overwritten by a
  placeholder.

    node fill-community-pictures.mjs
    node fill-community-pictures.mjs --force
*/
import { readFileSync } from 'node:fs'

import { Community } from './src/functions/community.js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.trim().replace(/^["']|["']$/g, '')]),
)

const FORCE = process.argv.includes('--force')
const communities = new Community(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// The seed's own word for a fellowship: lowercase, nothing that a url would have to escape.
const word = (name) =>
  String(name || 'community')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32) || 'community'

const rows = await communities.all()
console.log(`${rows.length} communities, ${FORCE ? 'overwriting every one' : 'only the empty ones'}`)

let written = 0
for (const one of rows) {
  if (!FORCE && String(one.picture || '').trim()) {
    console.log(`  kept   ${one.name} — ${one.picture}`)
    continue
  }
  const picture = `https://picsum.photos/seed/${word(one.name)}/1600/900`
  await communities.update(one.community_id, { picture })
  console.log(`  written ${one.name} — ${picture}`)
  written++
}

// One of them has to actually answer, or the hero would be painting a dead address. Read the rows
// again rather than trusting what was written above, since the ones that already had a picture are
// standing in this check with a value this run never touched.
const filled = (await communities.all()).find((one) => String(one.picture || '').trim())
if (filled) {
  const opened = await fetch(filled.picture)
  console.log(`\n${filled.name} opens: HTTP ${opened.status}, ${opened.headers.get('content-type')}`)
}
console.log(`${written} picture${written === 1 ? '' : 's'} written, ${rows.length - written} kept`)
