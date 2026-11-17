import { createClient } from '@supabase/supabase-js'
import { AdminDashboardFetch } from './admin_dashboard.js'
import { downloadExcel, downloadPdf } from './testimony_files.js'

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
    .select('testimony_id, user_email, date, body', options)
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
function shape({ testimony_id, user_email, date, body }, known) {
  const who = known?.get(user_email)
  return {
    testimony_id,
    email: user_email,
    name: who?.name || '',
    surname: who?.surname || '',
    date,
    body,
  }
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
  async getTestimonies(community_id, offset = 0, search = {}) {
    if (!community_id) throw new Error('community_id is required')
    const wanted = await this.#askedFor(community_id, search)
    const start = Number(offset) || 0
    const { data, error, count } = await asked(this.client, community_id, wanted, {
      count: 'exact',
    })
      .range(start, start + PAGE - 1)
    if (error) throw new Error(error.message)
    return {
      total: count ?? data.length,
      from: start,
      shown: data.length,
      matched: wanted.emails?.length ?? null,
      testimonies: data.map((row) => shape(row, wanted.known)),
    }
  }

  /*
    Every testimony the search matched, not just the hundred on screen: an export that stopped
    at the page break would be a different answer from the one the page just gave. The count
    that came back with the first page is what the walk has to reach, and a read that ends short
    of it is said out loud rather than handed over as the whole set.
  */
  async allTestimonies(community_id, search = {}) {
    if (!community_id) throw new Error('community_id is required')
    const wanted = await this.#askedFor(community_id, search)
    const rows = []
    let total = null
    for (let page = 0; page < PAGES; page += 1) {
      const { data, error, count } = await asked(this.client, community_id, wanted, {
        count: 'exact',
      }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(error.message)
      rows.push(...data.map((row) => shape(row, wanted.known)))
      total = count ?? rows.length
      if (!data.length || rows.length >= total) break
    }
    if (rows.length < total) {
      throw new Error(
        `Only ${rows.length} of ${total} testimonies could be read. Narrow the search and try again.`,
      )
    }
    return { total, testimonies: rows }
  }

  /*
    Recording a testimony by hand, which is what the add button on the page does. The address
    and the community come from the caller rather than from the form, because the popup asks
    for two things only — the day and the words — and neither of those belongs to whoever is
    typing. The day is stored exactly as the search above it compares it.
  */
  async addTestimony({ community_id, email, date, body }) {
    if (!community_id) throw new Error('community_id is required')
    if (!email) throw new Error('Nobody is signed in, so there is nothing to record an address against.')
    if (!day(date)) throw new Error('Pick the day this testimony belongs to.')
    const words = String(body ?? '').trim()
    if (!words) throw new Error('A testimony needs some words before it can be saved.')
    const { data, error } = await this.client
      .from('testimony')
      .insert({ community_id, user_email: email, date, body: words })
      .select('testimony_id, user_email, date, body')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Error('The testimony did not come back, so it may not have been written.')
    return shape(data[0])
  }

  /*
    The four columns an export is written out of. The names come from the roster, so somebody
    who has since been taken out of the community has no name to write, and their address is
    not a substitute for it: an exported file is the kind of thing that leaves a room, so the
    Name and Surname cells stay empty and the row keeps only its date and its body.
  */
  async exportRows(community_id, search = {}) {
    const { testimonies } = await this.allTestimonies(community_id, search)
    return testimonies.map((one) => ({
      name: one.name || '',
      surname: one.surname || '',
      date: one.date,
      body: one.body,
    }))
  }

  // Both halves of one click: read the whole search, then hand it to the writer. The page
  // holds no rows it did not ask for and builds no file of its own.
  async exportExcel(community_id, search = {}, title = 'testimonies') {
    return downloadExcel(await this.exportRows(community_id, search), { title, dates: search })
  }

  async exportPdf(community_id, search = {}, title = 'testimonies') {
    return downloadPdf(await this.exportRows(community_id, search), { title, dates: search })
  }
}
