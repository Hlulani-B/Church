/*
  A community's testimonies on paper — the readable version.

  A testimony row is worth archiving precisely because it cannot be read twice without the key: the
  words are `enc:v1:` AES-GCM ciphertext, the author's address is ciphertext too, and the key has never
  left the browser that wrote it. So this opens every body with `decryptText` before it draws anything.
  An export that kept the stored value would be a page of ciphertext, which is no kind of record.

  The second half of the job is the attachment. A testimony whose body is a `https://` url is a file in
  the `kopano` bucket — an image, a pdf, a docx. Images are pasted onto the page at full width with the
  path printed under them; a pdf or a docx cannot be drawn, so it is named, its path is printed, and the
  reason it is missing from the page is said out loud. After the rows are deleted, that path line is the
  only remaining evidence of where the file was.

  Both halves of a testimony page come out: the members' sharings and the extra members' sharings, in
  that order, because the tab a person is looking at is a filter on the screen and not a different set
  of records to keep.
*/

import { decryptText } from '../crypto.js'
import extra from '../extra.js'
import { TestimoniesFetch } from '../testimonies.js'
import { pretty } from '../table_files.js'
import { isFilePath, loadAttachments } from './attachments.js'
import { renderPdf } from './pdf.js'

const ENCRYPTED = 'enc:v1:'
const NO_NAME = 'someone this fellowship has not named'

/*
  The reader is built on first use rather than at import: `TestimoniesFetch` throws when the app is
  deployed without its Supabase url and key, and a module that threw at load would take the whole page
  down with it. Built once, because the class holds the shared Supabase client.
*/
let reader = null
function shared() {
  if (!reader) reader = new TestimoniesFetch()
  return reader
}

// Whose sharing it is, in the two names the page shows — never the address the row is keyed on.
function spoken(one) {
  const member = one.extra_members || {}
  const full = `${one.name || member.name || ''} ${one.surname || member.surname || ''}`.trim()
  return full || NO_NAME
}

/*
  One stored body, opened. Three things arrive from the table and each needs a different answer:
  a url (the file is pasted or named below), ciphertext (the words are decrypted), or an old row
  written before the encryption existed (the words are already plain). A body that will not open is
  said as such — a blank page in an archive reads as an empty testimony, which is a lie.
*/
async function openBody(value) {
  const stored = String(value ?? '')
  if (!stored) return { words: '', file: '', reason: 'nothing was recorded' }
  if (isFilePath(stored)) return { words: '', file: stored }
  if (stored.startsWith(ENCRYPTED)) {
    try {
      return { words: await decryptText(stored), file: '' }
    } catch {
      return { words: '', file: '', reason: 'these words will not open with this browser’s key' }
    }
  }
  return { words: stored, file: '' }
}

// Who was allowed to read it, in words worth keeping after the row is gone.
function seenBy(one) {
  if (one.allow_all === false) {
    const count = (Array.isArray(one.authorise) ? one.authorise : []).length
    return `Seen only by the ${count || 'chosen'} ${count === 1 ? 'person' : 'people'} the author named.`
  }
  return 'Open to the whole community.'
}

/*
  The rows of one group, opened and attached. Everything unreadable is done here in one pass — the
  bodies first (decryption is cheap and local), then every file at once so the whole document shares one
  queue of downloads rather than opening forty of them serially.
*/
async function prepare(rows, { onProgress } = {}) {
  const opened = []
  for (const one of rows) {
    opened.push({ row: one, ...(await openBody(one.body)) })
  }
  const files = await loadAttachments(
    opened.map((one) => one.file),
    { onProgress },
  )
  return opened.map((one, index) => ({ ...one, attachment: one.file ? files[index] : null }))
}

// One sharing on the page: a line of who and when, the words, then the file that was attached. A file
// with no bytes to draw is named and its path printed by the page itself, so nothing is said twice here.
function entryOf(one) {
  const heading = `${spoken(one.row)} — ${one.row.date ? pretty(one.row.date) : 'no day given'}`
  const lines = []
  if (one.words) lines.push(one.words)
  if (one.reason) lines.push(`(${one.reason})`)
  lines.push(seenBy(one.row))

  return {
    heading,
    lines,
    images: one.attachment
      ? [{ ...one.attachment, caption: one.words ? 'the attachment as it was shared' : 'the sharing itself, as an image' }]
      : [],
  }
}

export function testimoniesSpec({ members = [], extras = [], community, community_name, search }) {
  const span = search && (search.from || search.to || search.name)
    ? `Filtered${search.name ? ` by ${search.name}` : ''}${search.from || search.to ? `, from ${search.from || 'the beginning'} to ${search.to || 'today'}` : ''}`
    : 'Every testimony in this community'

  return {
    title: 'Testimonies',
    subtitle: community_name ? `${community_name} — ${span}` : span,
    meta: [
      { label: 'Shared by members', value: `${members.length}` },
      { label: 'Shared by extra members', value: `${extras.length}` },
      { label: 'Community', value: community || '' },
      { label: 'Archived on', value: new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) },
    ],
    sections: [
      {
        heading: 'The fellowship’s sharings',
        entries: members.map(entryOf),
        empty: 'No testimony has been shared by a member under this search.',
      },
      {
        heading: 'Extra members’ sharings',
        note: 'Recorded on behalf of the people who never joined the app.',
        entries: extras.map(entryOf),
        empty: 'No testimony is recorded for an extra member under this search.',
      },
    ],
    footer: 'Testimonies, opened and copied out of the records as they stood on the day of export',
  }
}

/*
  Both testimony lists read, opened, and drawn. `forAll` is the admin's and the leader's view — every
  row in the community — while a member's screen exports only what that address is allowed to read,
  which is the same rule the list on the screen follows.

  Attachments are counted across both halves together, because the number a person watching the button
  cares about is how many files are left, not how they are grouped.
*/
export async function buildTestimoniesPdf({ community_id, community_name, search = {}, viewer_email = '', for_all = false }, { onProgress } = {}) {
  if (!community_id) throw new Error('community_id is required')

  const [readable, extras] = await Promise.all([
    shared().allTestimonies(community_id, search, viewer_email).then((one) => one.testimonies || []),
    extra
      .getTestimonies({ community_id, viewer_email, for_all })
      .then((rows) => (Array.isArray(rows) ? rows : rows?.testimonies || []))
      .catch(() => []),
  ])

  if (!readable.length && !extras.length) {
    throw new Error('There are no testimonies under this search, so there is nothing to export.')
  }

  // One queue for the whole document: the files are fetched half at a time, so progress is reported
  // against the count of files rather than of rows.
  const both = [...readable, ...extras]
  const prepared = await prepare(both, { onProgress })
  const spec = testimoniesSpec({
    members: prepared.slice(0, readable.length),
    extras: prepared.slice(readable.length),
    community: community_id,
    community_name,
    search,
  })
  return { spec, blob: await renderPdf(spec), count: both.length }
}
