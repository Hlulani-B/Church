/*
  Reproduce the community_members foreign key error against the real database: can a users row
  be created through the same client the server functions use (anon key), and does an insert
  into community_members for an address with no users row fail with community_members_email_fkey?
*/
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

const stamp = Date.now().toString(36)
const email = `link.probe.${stamp}@example.com`
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
const service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: community } = await service.from('community').insert({ name: `Link Probe ${stamp}` }).select('community_id').single()

const userViaAnon = await anon.from('users').insert({ email, name: 'Link', surname: 'Probe' })
console.log('users insert with the ANON key :', userViaAnon.error?.code, userViaAnon.error?.message || 'ok')

const userViaService = await service.from('users').insert({ email, name: 'Link', surname: 'Probe' })
console.log('users insert with SERVICE key  :', userViaService.error?.code, userViaService.error?.message || 'ok')

const link = await anon
  .from('community_members')
  .insert({ email, community_id: community.community_id, role: 'member' })
console.log('community_members insert     :', link.error?.code, link.error?.message || 'ok')

const stranger = `nobody.probe.${stamp}@example.com`
const link2 = await service
  .from('community_members')
  .insert({ email: stranger, community_id: community.community_id, role: 'member' })
console.log('members insert, no users row :', link2.error?.code, link2.error?.message || 'ok')

await service.from('community_members').delete().eq('community_id', community.community_id)
await service.from('users').delete().eq('email', email)
await service.from('users').delete().eq('email', stranger)
await service.from('community').delete().eq('community_id', community.community_id)
process.exit(0)
