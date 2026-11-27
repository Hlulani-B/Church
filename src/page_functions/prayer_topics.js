/*
  Page fetches for prayer topics — what somebody in this community asked the fellowship to pray for,
  and the day they asked it.

  These go to the standalone server (server/src/routes/prayer_topics.js) over the same base url the
  servings and the extra-member rosters use, kept in the app's env as VITE_SERVINGS_API_URL — not
  through the tiered /api functions. The reason is the table: `prayer_topics` carries the address that
  asked for each one, so it has row level security with no policy on it, and the browser's anon key
  can neither read a community's list nor write a request. The server does both on the service key.

  Four calls, one per thing the page asks for: read the list, ask for a prayer, change one's own
  words or day, and take one back. The address on a row is the caller's own sign-in, sent so the page
  can tell which requests are its reader's — the only ones the page offers to edit or withdraw.
*/
const API_URL = import.meta.env.VITE_SERVINGS_API_URL

function base() {
  if (!API_URL) {
    throw new Error('VITE_SERVINGS_API_URL is not set, so prayer topics cannot reach the server.')
  }
  return API_URL
}

// One JSON round-trip, shared by every call: a refusal says why in the words the endpoint chose
// rather than a bare status code.
async function requestJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${base()}${path}`, {
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
    throw new Error(
      payload?.message || payload?.error || `The server refused the request (${res.status}).`,
    )
  }

  return payload
}

export class PrayerTopicsFetch {
  /*
    This community's topics, newest day first. A `date` narrows the read to one day's list and a
    `user_email` to one person's; the page uses neither, because it shows the whole fellowship's
    pile and decides for itself which rows are the reader's.
  */
  async list({ community_id, date, user_email } = {}) {
    if (!community_id) throw new Error('community_id is required')
    const query = new URLSearchParams({ community_id })
    if (date) query.set('date', date)
    if (user_email) query.set('user_email', user_email)
    return requestJson(`/prayer-topics?${query}`)
  }

  /*
    Asking for a prayer. The words and the address are required; the day is optional and the server
    dates an undated request as today. Nothing here decides whose address goes on the row — the page
    passes the one Firebase signed it in with, and the table is a record of who asked.
  */
  async ask({ community_id, user_email, topic, date }) {
    if (!community_id) throw new Error('community_id is required')
    if (!user_email) throw new Error('You are not signed in, so this request cannot be named.')
    return requestJson('/prayer-topics', {
      method: 'POST',
      body: { community_id, user_email, topic, date: date || null },
    })
  }

  // Rewording one's own request, or moving it to another day. Whichever is left out does not move.
  async revise({ topic_id, topic, date }) {
    if (!topic_id) throw new Error('topic_id is required')
    const changes = {}
    if (topic !== undefined) changes.topic = topic
    if (date !== undefined) changes.date = date
    return requestJson(`/prayer-topics/${encodeURIComponent(topic_id)}`, {
      method: 'PATCH',
      body: changes,
    })
  }

  // Taking one's own request back out. There is no undo, and no approval step either — a topic is
  // on the community's list the moment it is asked for.
  async remove({ topic_id }) {
    if (!topic_id) throw new Error('topic_id is required')
    return requestJson(`/prayer-topics/${encodeURIComponent(topic_id)}`, { method: 'DELETE' })
  }
}

export default new PrayerTopicsFetch()
