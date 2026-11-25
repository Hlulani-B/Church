import { createClient } from '@supabase/supabase-js'
import { AdminDashboardFetch } from './admin_dashboard.js'
import { downloadExcel, downloadPdf } from './table_files.js'
import { decryptText, encryptText } from './crypto.js'
import { prepareTestimonyFile, uploadTestimonyFile } from './testimony_files.js'

/*
  Testimonies are read by the browser itself, from the values Vite inlines out of
  .env.local: VITE_SUPABASE_URL and the public VITE_SUPABASE_ANON_KEY. Nothing here goes
  through the /api functions, so there is no id token, no action name and no server class behind the
  rows — what that costs is written out in Documentation-site/docs/findings.md, finding 1.

  What this read cannot give is a name. `users` has row level security and answers the anon
  key with nothing at all, so a join for the person who shared comes back empty. The names come
  from the roster instead: that read does go through /api/leader, which answers it for a leader or
  an admin of this community and for nobody else. So the page has both halves, the rows from here and the
  names from there, and they are joined in this file rather than in a query the browser is not
  allowed to run. A search by name works the same way round — the word is matched against the
  roster, and the testimonies are then narrowed to the addresses it picked out.
*/

// A page of testimonies, and how far one search is willing to walk for an export.
const PAGE = 100
const PAGES = 100

/*
  A search takes { from, to, name }. The dates are YYYY-MM-DD and either one can stand alone,
  meaning "and everything older" or "and everything newer". `testimony.date` is a date column,
  not a moment, so the day that was typed is the day that is compared — no timezone to fall
  over. Anything that is not a plain calendar day is treated as not asked for.
*/
function day(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

function bounds(search = {}) {
  return { from: day(search.from), to: day(search.to) }
}

/*
  The roster is where the names are, so a name search is answered out of it. Every word typed
  has to appear somewhere in the person's name, surname or address, which is what lets a surname
  on its own find a testimony, and what lets somebody who has since left the community still be
  found by the address their sharing carries. null means no name was asked for, so no address is
  ruled out.
*/
function emailsNamed(known, name) {
  const words = String(name ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return null
  return [...known.entries()]
    .filter(([, who]) => {
      const spoken = `${who.name} ${who.surname} ${who.email}`.toLowerCase()
      return words.every((one) => spoken.includes(one))
    })
    .map(([email]) => email)
}

// One read, narrowed to the community the page is about and to whatever the search asked for.
function asked(client, community_id, wanted, options) {
  let query = client
    .from('testimony')
    .select('testimony_id, user_email, date, body, authorise, allow_all', options)
    .eq('community_id', community_id)
    .order('date', { ascending: false })
    .order('testimony_id')
  if (wanted.from) query = query.gte('date', wanted.from)
  if (wanted.to) query = query.lte('date', wanted.to)
  if (wanted.emails) query = query.in('user_email', wanted.emails)
  return query
}

/*
  A row and whoever shared it. Somebody no longer on the roster keeps an empty name, which is
  how the page knows to title the row by their address instead.
*/
function shape({ testimony_id, user_email, date, body, authorise, allow_all }, known) {
  const who = known?.get(user_email)
  return {
    testimony_id,
    email: user_email,
    name: who?.name || '',
    surname: who?.surname || '',
    date,
    body,
    authorise,
    allow_all,
  }
}

/*
  The rows of one read, opened for the screen. addTestimony stores the author's address as
  ciphertext, so reading cannot answer a roster, a search or a permission check on it until it is
  decrypted — which decryptText does here, once per row, and passes through untouched any address
  written before the encryption existed. The body is not opened here: the pages render it through
  their own TestimonyBody, which decrypts the words and shows a file link for the types that are
  one — so the stored row stays ciphertext all the way down to Supabase, and only this screen's
  copy of it is in plain words.
*/
async function openRows(rows, known, viewer_email) {
  const opened = await Promise.all(
    rows.map(async (row) => shape({ ...row, user_email: await decryptText(row.user_email) }, known)),
  )
  return opened.filter((one) => canRead(one, viewer_email))
}

/*
  Whether a testimony may be read, on the two columns addTestimony sets. allow_all is the switch:
  true opens it to anybody and leaves authorise empty; false narrows reading to the addresses held
  in the authorise array. A row that never set allow_all (written before these columns existed) is
  left readable rather than hidden.
*/
function canRead(row, viewer_email) {
  if (row.allow_all !== false) return true
  const list = Array.isArray(row.authorise) ? row.authorise : []
  const viewer = String(viewer_email || '').toLowerCase()
  return list.some((one) => String(one).toLowerCase() === viewer)
}

// One Supabase client for the whole page. Auth lives in Firebase now, so this browser
// client only reads rows with the public anon key — it never signs anyone in. Turning off
// session persistence and URL detection stops each instance from standing up its own
// GoTrueClient and probing the popup window, which was the source of the
// "Multiple GoTrueClient instances" and COOP "window.closed" warnings.
let client
function sharedClient(url, key) {
  if (!client) client = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } })
  return client
}

/*
  The rows are READ here with the anon key above — a permissive SELECT policy lets that through — but
  they are WRITTEN through the standalone server (server/src/routes/testimony.js), which holds the
  service key. With row level security on `testimony`, an anon INSERT has no policy to satisfy and the
  database refuses it with "new row violates row-level security policy", which is exactly what saving
  a testimony used to hit. Only the finished, opaque values cross over: the words are encrypted and a
  file is uploaded (through upload.js) here in the browser first, so the at-rest encryption stays
  entirely client-side and the server only ever stores what it is handed.
*/
const API_URL = import.meta.env.VITE_SERVINGS_API_URL

async function requestJson(path, { method = 'GET', body } = {}) {
  if (!API_URL) {
    throw new Error('VITE_SERVINGS_API_URL is not set, so a testimony cannot be saved.')
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try {
    payload = await res.json()
  } catch {
    // A reply that was not JSON is handled just below, alongside the status.
  }
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `The server refused the request (${res.status}).`)
  }
  return payload
}

export class TestimoniesFetch {
  constructor(
    url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_ANON_KEY,
  ) {
    if (!url || !key) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set in .env.local')
    }
    this.client = sharedClient(url, key)
    this.people = new AdminDashboardFetch()
  }

  /*
    The roster is the second read, on the other path: /api/leader answers it for a leader or an
    admin of this community and for nobody else. It is the only place names live, so without it a search by
    name cannot be answered at all and says so, rather than handing back every testimony as if
    the word had matched. Names on the rows are lost with it, but the sharing itself still
    shows, titled by address.
  */
  async #askedFor(community_id, search) {
    const name = String(search?.name ?? '').trim()
    let known = null
    try {
      const roster = await this.people.getMembers(community_id)
      known = new Map(roster.map((one) => [one.email, one]))
    } catch {
      known = null
    }
    if (!known && name) {
      throw new Error(
        'The people of this community could not be read, so a search by name cannot be answered.',
      )
    }
    return { known, ...bounds(search), emails: emailsNamed(known, name) }
  }

  /*
    A hundred testimonies, newest first, each one carrying the name of whoever shared it.
    testimony_id settles a tie between two rows of the same date, so an offset page can neither
    show one twice nor skip it, and the exact count rides along on the same read so the page can
    say which hundred of how many it is showing. With no search it is every testimony in the
    community, which is what the page opens on. `matched` is how many people a name search
    picked out: zero of them is a different sentence from nobody sharing anything.
  */
  async getTestimonies(community_id, offset = 0, search = {}, viewer_email = '') {
    if (!community_id) throw new Error('community_id is required')
    const wanted = await this.#askedFor(community_id, search)
    const start = Number(offset) || 0
    // authorise is per-row, so the readable set has to be formed before the page is taken; a
    // server-side range would page over rows this viewer cannot see and miscount the total.
    const matched = []
    let serverCount = null
    for (let page = 0; page < PAGES; page += 1) {
      const { data, error, count } = await asked(this.client, community_id, wanted, {
        count: 'exact',
      }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(error.message)
      matched.push(...data)
      serverCount = count ?? matched.length
      if (!data.length || matched.length >= serverCount) break
    }
    const readable = await openRows(matched, wanted.known, viewer_email)
    const shown = readable.slice(start, start + PAGE)
    return {
      total: readable.length,
      from: start,
      // What the three testimony pages read: the rows of this page, and how many they are.
      testimonies: shown,
      shown: shown.length,
      matched: wanted.emails?.length ?? null,
    }
  }

  /*
    Every testimony the search matched, not just the hundred on screen: an export that stopped
    at the page break would be a different answer from the one the page just gave. The count
    that came back with the first page is what the walk has to reach, and a read that ends short
    of it is said out loud rather than handed over as the whole set.
  */
  async allTestimonies(community_id, search = {}, viewer_email = '') {
    if (!community_id) throw new Error('community_id is required')
    const wanted = await this.#askedFor(community_id, search)
    const rows = []
    let total = null
    let fetched = 0
    for (let page = 0; page < PAGES; page += 1) {
      const { data, error, count } = await asked(this.client, community_id, wanted, {
        count: 'exact',
      }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(error.message)
      fetched += data.length
      rows.push(...(await openRows(data, wanted.known, viewer_email)))
      total = count ?? fetched
      if (!data.length || fetched >= total) break
    }
    if (fetched < total) {
      throw new Error(
        `Only ${fetched} of ${total} testimonies could be read. Narrow the search and try again.`,
      )
    }
    return { total: rows.length, testimonies: rows }
  }

  /*
    Recording a testimony, in whichever form the author brings it — the words, or a file. This
    carries the logic asked for, applied directly here in addTestimony.

      - type 'text' (the default): the words are encrypted and that ciphertext is what lands in body.
      - type 'image' | 'pdf' | 'docx': the file runs through the lossless, never-rejecting
        compression helper, uploads to the kopano bucket, and its public URL lands in body.

    The author's own address is encrypted too and stored in user_email. Who may read it is the
    author's choice on two columns: allow_all true opens it to everybody and leaves authorise
    empty; allow_all false fills authorise with the addresses that are allowed, and reading is then
    narrowed to those. For the insert to land the table needs `type`, `authorise` and `allow_all`
    columns and the user_email -> users(email) foreign key dropped.
  */
  async addTestimony({
    community_id,
    email,
    date,
    body,
    testimony,
    type = 'text',
    file,
    allow_all,
    authorise,
  }) {
    if (!community_id) throw new Error('community_id is required')
    if (!email) {
      throw new Error('Nobody is signed in, so there is nothing to record an address against.')
    }
    if (!day(date)) throw new Error('Pick the day this testimony belongs to.')

    const kind = String(type || '').trim().toLowerCase()
    let stored
    if (kind === 'text') {
      const words = String(body ?? testimony ?? '').trim()
      if (!words) throw new Error('A testimony needs some words before it can be saved.')
      stored = await encryptText(words)
    } else if (kind === 'image' || kind === 'pdf' || kind === 'docx') {
      const prepared = await prepareTestimonyFile(file)
      stored = await uploadTestimonyFile(prepared.blob, {
        kind: prepared.kind,
        ownerEmail: email,
        date,
      })
    } else {
      throw new Error('A testimony is one of text, image, pdf or docx.')
    }

    const encryptedEmail = await encryptText(email)

    // allow_all true means authorise is empty; false means only the listed addresses may read.
    const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
    const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []

    const written = await requestJson('/testimony', {
      method: 'POST',
      body: {
        community_id,
        user_email: encryptedEmail,
        date,
        body: stored,
        type: kind,
        allow_all: everyone,
        authorise: authorised,
      },
    })
    if (!written?.testimony_id) {
      throw new Error('The testimony did not come back, so it may not have been written.')
    }
    return shape(written)
  }

  /*
    Changing who may see a testimony, on the same two fields addTestimony sets. allow_all true
    empties authorise and opens the row to everybody; allow_all false stores the given authorise
    list and narrows reading to those addresses. The row is addressed by testimony_id.
  */
  async updateAuthorise({ testimony_id, allow_all, authorise }) {
    if (!testimony_id) throw new Error('testimony_id is required')
    const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
    const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []
    const updated = await requestJson(`/testimony/${testimony_id}`, {
      method: 'PATCH',
      body: { allow_all: everyone, authorise: authorised },
    })
    if (!updated?.testimony_id) {
      throw new Error('That testimony could not be found, so its readers were not changed.')
    }
    return updated
  }

  /*
    The four columns an export is written out of. The names come from the roster, so somebody
    who has since been taken out of the community has no name to write, and their address is
    not a substitute for it: an exported file is the kind of thing that leaves a room, so the
    Name and Surname cells stay empty and the row keeps only its date and its body.
  */
  async exportRows(community_id, search = {}, viewer_email = '') {
    const { testimonies } = await this.allTestimonies(community_id, search, viewer_email)
    return testimonies.map((one) => ({
      name: one.name || '',
      surname: one.surname || '',
      date: one.date,
      body: one.body,
    }))
  }

  /*
    Both halves of one click: read the whole search, then hand it to the writer. The page
    holds no rows it did not ask for and builds no file of its own.

    The column list lives here rather than in the writers, because the writers now serve more
    than this table and cannot know what each one's rows look like. Testimony keeps four
    columns and a wide one for the body; the date is named as one so Excel filters it as a date.
  */
  static get COLUMNS() {
    return [
      { key: 'name', head: 'Name', sheetWidth: 20, pdfWidth: 82 },
      { key: 'surname', head: 'Surname', sheetWidth: 20, pdfWidth: 82 },
      { key: 'date', head: 'Date', kind: 'date', sheetWidth: 12, pdfWidth: 62 },
      { key: 'body', head: 'Testimony', sheetWidth: 110 },
    ]
  }

  async exportExcel(community_id, search = {}, title = 'testimonies', viewer_email = '') {
    const rows = await this.exportRows(community_id, search, viewer_email)
    return downloadExcel(rows, {
      title,
      dates: search,
      columns: TestimoniesFetch.COLUMNS,
      empty: 'No testimonies match this search, so there is nothing to export.',
      noun: { singular: 'testimony', plural: 'testimonies' },
    })
  }

  async exportPdf(community_id, search = {}, title = 'testimonies', viewer_email = '') {
    const rows = await this.exportRows(community_id, search, viewer_email)
    return downloadPdf(rows, {
      title,
      dates: search,
      columns: TestimoniesFetch.COLUMNS,
      empty: 'No testimonies match this search, so there is nothing to export.',
      noun: { singular: 'testimony', plural: 'testimonies' },
      subject: 'Testimonies',
    })
  }
}
