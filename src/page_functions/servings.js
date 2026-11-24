/*
  The one page function for servings. It never opens Supabase itself — the rows are written
  server-side by the standalone server (server/src/routes/servings.js), which holds the service
  key. This only reaches that endpoint over HTTP, at the base url kept in the app's env as
  VITE_SERVINGS_API_URL, and speaks the single call the feature needs: adding a serving.
*/
const API_URL = import.meta.env.VITE_SERVINGS_API_URL

// One JSON round-trip to the server, shared by every call: a refusal says why in the words the
// endpoint chose rather than a bare status code.
async function requestJson(path, { method = 'GET', body } = {}) {
  if (!API_URL) {
    throw new Error('VITE_SERVINGS_API_URL is not set, so servings cannot reach the server.')
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

export class ServingsFetch {
  async addServing({ name, surname, email, community_id }) {
    if (!API_URL) {
      throw new Error('VITE_SERVINGS_API_URL is not set, so servings cannot reach the server.')
    }

    const res = await fetch(`${API_URL}/servings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, surname, email, community_id }),
    })

    let payload = null
    try {
      payload = await res.json()
    } catch {
      // A reply that was not JSON is handled just below, alongside the status.
    }

    if (!res.ok) {
      throw new Error(payload?.message || payload?.error || `The server refused the serving (${res.status}).`)
    }

    return payload
  }

  // Every serving in one community, with the role each person holds there.
  async getRoles(community_id) {
    if (!community_id) throw new Error('community_id is required')
    return requestJson(`/servings/roles?community_id=${encodeURIComponent(community_id)}`)
  }

  /*
    Setting one person's role in a community. The address and the community choose the row, and
    the person asking is somebody else (an admin or a leader) — only they reach this from the app.
  */
  async changeRole({ email, community_id, role }) {
    if (!email) throw new Error('An address is needed to change a serving.')
    if (!community_id) throw new Error('community_id is required')
    return requestJson('/servings/role', { method: 'PATCH', body: { email, community_id, role } })
  }

  // Dropping a person's serving row — called when an admin takes them out of the community.
  async removeRole({ email, community_id }) {
    if (!email) throw new Error('An address is needed to remove a serving.')
    if (!community_id) throw new Error('community_id is required')
    return requestJson('/servings/role', { method: 'DELETE', body: { email, community_id } })
  }
}

export default new ServingsFetch()
