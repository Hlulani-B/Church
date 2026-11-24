/*
  Seeds a dummy community, a dummy user, and one testimony through the real page function,
  then LEAVES everything in the database (nothing is deleted) so you can open Supabase and
  see the stored rows. Prints the raw stored values so you can confirm the body/email are
  ciphertext.

  Run:  npx vitest run --config vitest.encryption.config.js
*/
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto')
  globalThis.crypto = webcrypto
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

// Same key the browser app uses, so these rows can be decrypted there later.
import.meta.env.VITE_TESTIMONY_ENC_KEY = env.VITE_TESTIMONY_ENC_KEY

const TEXT = 'The Lord gave me a testimony worth keeping secret.'
const email = 'enc.demo@example.com'
const communityName = 'Enc Demo Fellowship'

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let communityId = null

describe('seed testimony encryption (kept in DB)', () => {
  afterAll(async () => {
    if (!communityId) return
    const { data: rows } = await db
      .from('testimony')
      .select('testimony_id, user_email, body, type, allow_all')
      .eq('community_id', communityId)
    console.log('\n=== what is now in the database ===')
    console.log('community_id :', communityId)
    console.log('community    :', communityName)
    console.log('user         :', email)
    console.log('plain text   :', TEXT)
    for (const row of rows || []) {
      console.log('testimony    :', JSON.stringify(row, null, 2))
    }
    console.log('=== nothing was deleted; these rows stay for you to inspect ===\n')
  })

  it('leaves a dummy community, user and encrypted testimony', async () => {
    const { data: community, error: cErr } = await db
      .from('community')
      .insert({ name: communityName })
      .select('community_id')
      .single()
    if (cErr) throw new Error(`community: ${cErr.message}`)
    communityId = community.community_id

    await db
      .from('users')
      .upsert({ email, name: 'Enc', surname: 'Demo' }, { onConflict: 'email' })

    const { TestimoniesFetch } = await import('./src/page_functions/testimonies.js')
    const { encryptText } = await import('./src/page_functions/crypto.js')
    const testimonies = new TestimoniesFetch(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

    try {
      const saved = await testimonies.addTestimony({
        community_id: communityId,
        email,
        date: '2026-11-23',
        type: 'text',
        body: TEXT,
        allow_all: true,
      })
      console.log('addTestimony wrote:', saved)
    } catch (e) {
      if (!/foreign key constraint/.test(e.message)) throw e
      console.warn(
        'addTestimony could not write (users(email) foreign key on testimony.user_email blocks ' +
          'the encrypted address). Writing an encrypted BODY directly so you can see at-rest ' +
          'encryption in the table — drop the FK to save through the page function.',
      )
      const sealed = await encryptText(TEXT)
      const { data: direct, error: dErr } = await db
        .from('testimony')
        .insert({
          community_id: communityId,
          user_email: email, // plaintext so the FK is satisfied; the body is still encrypted
          date: '2026-11-23',
          body: sealed,
          type: 'text',
          allow_all: true,
          authorise: [],
        })
        .select('testimony_id, user_email, body')
      if (dErr) throw new Error(`direct insert: ${dErr.message}`)
      console.log('direct encrypted row:', direct)
    }

    expect(communityId).toBeTruthy()
  })
})
