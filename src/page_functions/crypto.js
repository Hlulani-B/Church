/*
  At-rest encryption for testimony text, in the browser with Web Crypto.

  AES-GCM with a single key the app already holds. Be honest about what this buys: it protects
  a raw database read that skipped the app, not a signed-in user — anyone who can load the site
  and reach the key can decrypt. The key is VITE_TESTIMONY_ENC_KEY, base64 of 32 bytes. A
  generated value looks like:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

  Every ciphertext is stored as `enc:v1:` + base64(iv || ciphertext), so a reader can tell an
  encrypted body from a plain one (an old row, or a file URL) and leave it untouched.
*/

const PREFIX = 'enc:v1:'

function toBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function toB64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

let keyPromise
function encKey() {
  const b64 = import.meta.env.VITE_TESTIMONY_ENC_KEY
  if (!b64) throw new Error('VITE_TESTIMONY_ENC_KEY is not set, so testimonies cannot be encrypted.')
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      toBytes(b64),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  }
  return keyPromise
}

// Encrypt a testimony's words. Returns `enc:v1:...`, ready to store in the text `body` column.
export async function encryptText(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await encKey()
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(String(plain ?? '')),
  )
  const bytes = new Uint8Array(iv.byteLength + cipher.byteLength)
  bytes.set(iv, 0)
  bytes.set(new Uint8Array(cipher), iv.byteLength)
  return PREFIX + toB64(bytes)
}

// Decrypt a body, or pass through anything that was never encrypted (old rows, file URLs).
export async function decryptText(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value
  const raw = toBytes(value.slice(PREFIX.length))
  const iv = raw.slice(0, 12)
  const cipher = raw.slice(12)
  const key = await encKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}
