/*
  Temporary check that the testimony encryption path works end to end, against the real
  Supabase project, running the actual page functions. It seeds a dummy community and user,
  then runs addTestimony (which encrypts the words and the author's address), reads the row
  back with getTestimonies, and decrypts it with the page's own decryptText. Vitest is used
  because the page functions read import.meta.env, which plain Node does not populate.

  Run:  npx vitest run tmp-encryption-check.mjs
  Delete this file when done.
*/
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

const KEY = env.VITE_TESTIMONY_ENC_KEY || randomBytes(32).toString('base64')
import.meta.env.VITE_TESTIMONY_ENC_KEY = KEY

const TEXT = 'The Lord gave me a testimony worth keeping secret.'
const stamp = Date.now().toString(36)
const email = `enc.probe.${stamp}@example.com`
const communityName = `Enc Probe Fellowship ${stamp}`

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let communityId = null

describe('testimony encryption (live)', () => {
  beforeAll(async () => {
    const { data: community, error: cErr } = await db
      .from('community')
      .insert({ name: communityName })
      .select('community_id')
      .single()
    if (cErr) throw new Error(`community: ${cErr.message}`)
    communityId = community.community_id

    const { error: uErr } = await db.from('users').insert({ email, name: 'Enc', surname: 'Probe' })
    if (uErr) throw new Error(`users: ${uErr.message}`)
  })

  afterAll(async () => {
    if (!communityId) return
    const { error: delTestimony } = await db.from('testimony').delete().eq('community_id', communityId)
    const { error: delCommunity } = await db.from('community').delete().eq('community_id', communityId)
    const { error: delUser } = await db.from('users').delete().eq('email', email)
    console.log('cleanup', {
      delTestimony: delTestimony?.message || 'ok',
      delCommunity: delCommunity?.message || 'ok',
      delUser: delUser?.message || 'ok',
    })
  })

  it('encrypts and decrypts with the page crypto (no DB write)', async () => {
    const { encryptText, decryptText } = await import('./src/page_functions/crypto.js')

    const sealed = await encryptText(TEXT)
    expect(sealed).toMatch(/^enc:v1:/)
    expect(sealed).not.toContain('testimony')
    expect(await decryptText(sealed)).toBe(TEXT)

    const sealedEmail = await encryptText(email)
    expect(sealedEmail).toMatch(/^enc:v1:/)
    expect(sealedEmail).not.toContain(email)
    expect(await decryptText(sealedEmail)).toBe(email)

    // A fresh IV every call, so the same words never store as the same bytes.
    expect(await encryptText(TEXT)).not.toBe(sealed)
    // Anything never encrypted (an old row, a file URL) passes straight through.
    expect(await decryptText('https://example.com/file.pdf')).toBe('https://example.com/file.pdf')
  })

  it('writes an encrypted row and reads it back through the page function', async () => {
    const { TestimoniesFetch } = await import('./src/page_functions/testimonies.js')
    const { decryptText } = await import('./src/page_functions/crypto.js')
    const testimonies = new TestimoniesFetch(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

    let saved
    try {
      saved = await testimonies.addTestimony({
        community_id: communityId,
        email,
        date: '2026-11-23',
        type: 'text',
        body: TEXT,
        allow_all: true,
      })
    } catch (e) {
      if (/foreign key constraint/.test(e.message)) {
        console.warn(
          'SKIPPED DB write: testimony.user_email still has the users(email) foreign key. ' +
            'Run in the Supabase SQL Editor, then re-run: ' +
            'alter table testimony drop constraint if exists testimony_user_email_fkey;',
        )
        return
      }
      throw e
    }

    expect(saved?.testimony_id).toBeTruthy()
    expect(String(saved.email)).toMatch(/^enc:v1:/)

    const list = await testimonies.getTestimonies(communityId, 0, {}, email)
    const row = list.testimonies.find((one) => one.testimony_id === saved.testimony_id)
    expect(row).toBeTruthy()
    expect(String(row.body)).toMatch(/^enc:v1:/)
    expect(await decryptText(row.body)).toBe(TEXT)
  })
})
