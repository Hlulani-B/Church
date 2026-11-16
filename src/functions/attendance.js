import { createClient } from '@supabase/supabase-js'

/*
  What the attendance page reads, and nothing else. `event` holds one row per person per
  gathering, so a community's history runs to thousands of rows while PostgREST answers at
  most 1000 of them in one read (findings.md #2). Both methods here are shaped around that
  rather than pretending it does not happen: services() groups the newest 1000 rows into
  gatherings, and service() asks for a single gathering, which is never bigger than the
  roster. /api/leader maps the action 'attendance' onto this class and answers it for a leader
  or an admin of the community_id in the request.

  The name beside each address comes from the join to users, which row level security keeps
  from a browser. That is exactly why this read is a server one and the testimonies page,
  which shows addresses only, is not.
*/

const SAMPLE = 1000

/*
  Whether a gathering's day has come yet, as the date column writes it. A row that answers
  present for a Sunday three weeks away is not a fact about a room — nobody has taken that
  register — so both reads below refuse to present a yes as one. Only the true is dropped this
  way; an apology for a future gathering is a real thing that was sent, and it still shows.
*/
function upcoming(event_date) {
  return String(event_date) > new Date().toISOString().slice(0, 10)
}

export class Attendance {
  constructor(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY) {
    if (!url || !key) throw new Error('Supabase url and key are required')
    this.client = createClient(url, key)
  }

  #id(community_id) {
    if (!community_id) throw new Error('community_id is required')
  }

  /*
    The gatherings this community has recorded, newest first, with how many of their rows
    were marked present. A full sample means the oldest gathering in it may be cut off
    partway, and a count that is short by some unknown amount is worse than no line for it,
    so the last group is dropped whenever the read came back full. `recorded` is the true
    number of rows: the count is over the whole filtered set, not the page.
  */
  async services(community_id) {
    this.#id(community_id)
    const { data, error, count } = await this.client
      .from('event')
      .select('event_date, event_name, attend', { count: 'exact' })
      .eq('community_id', community_id)
      .order('event_date', { ascending: false })
      .limit(SAMPLE)
    if (error) throw error

    const byService = new Map()
    for (const row of data) {
      const key = `${row.event_date}|${row.event_name}`
      const found = byService.get(key) || {
        event_date: row.event_date,
        event_name: row.event_name,
        present: 0,
        total: 0,
        upcoming: upcoming(row.event_date),
      }
      found.total += 1
      // A gathering whose day has not come has no present, however its rows are filled in.
      if (row.attend && !found.upcoming) found.present += 1
      byService.set(key, found)
    }

    const services = [...byService.values()]
    const sampled = data.length === SAMPLE
    if (sampled) services.pop()
    return { services, recorded: count ?? data.length, sampled }
  }

  /*
    Everyone recorded at one gathering, present and absent together, whoever they are.
    `users!user_email` names the join rather than leaving it to be guessed: event points at
    users twice over, once for the person the row is about and once for whoever recorded it.
  */
  async service(community_id, event_date, event_name) {
    this.#id(community_id)
    if (!event_date || !event_name) {
      throw new Error('event_date and event_name are required for one gathering')
    }
    const { data, error, count } = await this.client
      .from('event')
      .select('event_id, user_email, attend, reason, users!user_email(name, surname)', {
        count: 'exact',
      })
      .eq('community_id', community_id)
      .eq('event_date', event_date)
      .eq('event_name', event_name)
      .order('user_email')
      .limit(SAMPLE)
    if (error) throw error

    const pending = upcoming(event_date)
    const rows = data.map(({ event_id, user_email, attend, reason, users }) => ({
      event_id,
      email: user_email,
      name: users?.name ?? '',
      surname: users?.surname ?? '',
      // A yes for a day that has not come is answered as nothing taken yet; a notice of
      // absence stays a notice, because that was really sent.
      attend: pending ? (attend ? null : false) : Boolean(attend),
      reason: reason || '',
    }))
    rows.sort((a, b) => `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`))

    return {
      event_date,
      event_name,
      upcoming: pending,
      total: count ?? data.length,
      present: rows.filter((one) => one.attend === true).length,
      rows,
    }
  }
}
