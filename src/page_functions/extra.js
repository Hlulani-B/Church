import { encryptText } from './crypto.js'
import { prepareTestimonyFile, uploadTestimonyFile } from './testimony_files.js'

/*
  The one page function for the extra_* tables — the people a leader or an admin lists who never
  join the app, and everything recorded about them (attendance, testimonies, function answers,
  payments and servings).

  Like servings, these rows are written and read server-side by the standalone Express server
  (server/src/routes/extra_*.js), which holds the service key. This only reaches those endpoints
  over HTTP at the base url kept in the app's env as VITE_SERVINGS_API_URL — the same server the
  servings feature already talks to, on the /extra-* prefixes its router mounts.

  The one thing that stays in the browser is the testimony body and a receipt, exactly as the real
  testimony table already does it: words are encrypted with VITE_TESTIMONY_ENC_KEY before they are
  handed over, and a chosen file runs through the best-effort lossless compression helper and is
  uploaded to the public `kopano` bucket through the server (upload.js), which writes it with the
  service key. The value stored against an extra testimony is therefore either `enc:v1:` ciphertext
  or a public file URL — never plain words — and the server stores and returns it untouched.
*/

const API_URL = import.meta.env.VITE_SERVINGS_API_URL

function needUrl() {
  if (!API_URL) {
    throw new Error('VITE_SERVINGS_API_URL is not set, so the extra members cannot reach the server.')
  }
}

// One JSON round-trip to the server, shared by every call: a refusal says why in the endpoint's words.
async function requestJson(path, { method = 'GET', body } = {}) {
  needUrl()

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
    throw new Error(
      payload?.message || payload?.error || `The server refused the request (${res.status}).`,
    )
  }
  return payload
}

// Query string built only from the parameters that were actually given.
function query(values) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const asString = params.toString()
  return asString ? `?${asString}` : ''
}

export class ExtraFetch {
  /*
    extra_members — the roster of people who will not use the app. `created_by` is the leader or
    admin who added them, kept as their real address so the row says whose hand put the name there.
  */
  async addMember({ community_id, name, surname, created_by }) {
    if (!community_id) throw new Error('community_id is required')
    if (!String(name || '').trim() || !String(surname || '').trim()) {
      throw new Error('An extra member needs a name and a surname.')
    }
    return requestJson('/extra-members', {
      method: 'POST',
      body: { community_id, name, surname, created_by },
    })
  }

  async getMembers(community_id) {
    if (!community_id) throw new Error('community_id is required')
    return requestJson(`/extra-members${query({ community_id })}`)
  }

  async updateMember(member_id, changes) {
    if (!member_id) throw new Error('member_id is required')
    return requestJson(`/extra-members/${member_id}`, { method: 'PATCH', body: changes })
  }

  async removeMember(member_id) {
    if (!member_id) throw new Error('member_id is required')
    return requestJson(`/extra-members/${member_id}`, { method: 'DELETE' })
  }

  /*
    extra_event — attendance recorded for an extra member. `recordEvent` opens a row; `getEvents`
    reads a community's records (narrowed by day, gathering name or member); the two changes a page
    makes are a different answer/reason and a removal.
  */
  async recordEvent({ community_id, member_id, event_name, event_date, attend, reason, recorded_by }) {
    if (!community_id) throw new Error('community_id is required')
    if (!member_id) throw new Error('Which extra member is this recorded for?')
    if (!event_date) throw new Error('Pick the day the gathering was held.')
    return requestJson('/extra-event', {
      method: 'POST',
      body: { community_id, member_id, event_name, event_date, attend, reason, recorded_by },
    })
  }

  async getEvents({ community_id, event_date, event_name, member_id } = {}) {
    if (!community_id) throw new Error('community_id is required')
    return requestJson(`/extra-event${query({ community_id, event_date, event_name, member_id })}`)
  }

  async updateEvent(event_id, changes) {
    if (!event_id) throw new Error('event_id is required')
    return requestJson(`/extra-event/${event_id}`, { method: 'PATCH', body: changes })
  }

  async removeEvent(event_id) {
    if (!event_id) throw new Error('event_id is required')
    return requestJson(`/extra-event/${event_id}`, { method: 'DELETE' })
  }

  /*
    extra_testimony — a sharing recorded on behalf of an extra member. The body is prepared here
    (encrypted words or an uploaded, losslessly-compressed file) and the server only ever stores and
    returns the value it was handed, exactly as the real testimony write does.

      - type 'text' (the default): the words are encrypted; the ciphertext is what goes in `body`.
      - type 'image' | 'pdf' | 'docx': the file is compressed best-effort and uploaded, and its
        public URL goes in `body`.

    Who may read it is the author's choice on two fields: allow_all true opens it to everybody and
    empties authorise; allow_all false narrows reading to the addresses in authorise. The server
    does that filtering on read, given the viewer's own address.
  */
  async addTestimony({
    community_id,
    member_id,
    date,
    body,
    testimony,
    type = 'text',
    file,
    allow_all,
    authorise,
    recorded_by,
  }) {
    if (!community_id) throw new Error('community_id is required')
    if (!member_id) throw new Error('Which extra member is this testimony for?')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Pick the day this testimony belongs to.')

    const kind = String(type || 'text').trim().toLowerCase()
    let stored
    if (kind === 'text') {
      const words = String(body ?? testimony ?? '').trim()
      if (!words) throw new Error('A testimony needs some words before it can be saved.')
      stored = await encryptText(words)
    } else if (kind === 'image' || kind === 'pdf' || kind === 'docx') {
      const prepared = await prepareTestimonyFile(file)
      stored = await uploadTestimonyFile(prepared.blob, {
        kind: prepared.kind,
        ownerEmail: recorded_by || 'extra',
        date,
      })
    } else {
      throw new Error('A testimony is one of text, image, pdf or docx.')
    }

    const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
    const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []

    return requestJson('/extra-testimony', {
      method: 'POST',
      body: {
        community_id,
        member_id,
        date,
        body: stored,
        type: kind,
        allow_all: everyone,
        authorise: authorised,
        recorded_by,
      },
    })
  }

  /*
    Reading an extra community's testimonies. `viewer_email` is the address on the screen, which the
    server checks against each row's permission; `for_all` is the leader's/admin's register view that
    ignores it, and a member's screen never passes that flag.
  */
  async getTestimonies({ community_id, viewer_email, member_id, for_all } = {}) {
    if (!community_id) throw new Error('community_id is required')
    return requestJson(
      `/extra-testimony${query({ community_id, viewer_email, member_id, for_all: for_all ? 'true' : '' })}`,
    )
  }

  async updateAuthorise({ testimony_id, allow_all, authorise }) {
    if (!testimony_id) throw new Error('testimony_id is required')
    const everyone = allow_all === true || String(allow_all).toLowerCase() === 'true'
    const authorised = everyone ? [] : Array.isArray(authorise) ? authorise : []
    return requestJson(`/extra-testimony/${testimony_id}`, {
      method: 'PATCH',
      body: { allow_all: everyone, authorise: authorised },
    })
  }

  async removeTestimony(testimony_id) {
    if (!testimony_id) throw new Error('testimony_id is required')
    return requestJson(`/extra-testimony/${testimony_id}`, { method: 'DELETE' })
  }

  /*
    extra_function_attending — one extra member's yes/no to a planned function. The key is the pair,
    so the write is an upsert: the same call answers and re-answers.
  */
  async setFunctionAttending({ function_id, member_id, attending }) {
    if (!function_id) throw new Error('function_id is required')
    if (!member_id) throw new Error('member_id is required')
    return requestJson('/extra-function-attending', {
      method: 'POST',
      body: { function_id, member_id, attending: attending === true || String(attending) === 'true' },
    })
  }

  async getFunctionAttending(function_id) {
    if (!function_id) throw new Error('function_id is required')
    return requestJson(`/extra-function-attending${query({ function_id })}`)
  }

  async removeFunctionAttending({ function_id, member_id }) {
    if (!function_id || !member_id) throw new Error('function_id and member_id are required')
    return requestJson('/extra-function-attending', {
      method: 'DELETE',
      body: { function_id, member_id },
    })
  }

  /*
    extra_function_paid — what one extra member owes and paid for a function. `proof_path` is a file
    the browser uploaded first (the same public bucket), so the page hands over the path and the
    moment it went in; `confirmed_by` is the real user who checked it, and the server stamps the time.

    `uploadProof` is the half that has to happen before the row is written: a receipt image or pdf is
    run through the best-effort lossless helper and pushed to the public bucket, and its URL comes
    back to be stored as `proof_path`. It reuses the testimony file helpers because they are the
    app's only lossless-compress-then-upload path, and a payment receipt is the same kind of attachment.
  */
  async uploadProof({ file, uploaded_by }) {
    if (!file) throw new Error('There is no file to upload.')
    const prepared = await prepareTestimonyFile(file)
    const now = new Date()
    const pad = (one) => String(one).padStart(2, '0')
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    return uploadTestimonyFile(prepared.blob, {
      kind: prepared.kind,
      ownerEmail: uploaded_by || 'extra',
      date,
    })
  }

  async setFunctionPaid({
    function_id,
    member_id,
    paid,
    expected_pay_date,
    proof_path,
    proof_submitted_at,
  }) {
    if (!function_id) throw new Error('function_id is required')
    if (!member_id) throw new Error('member_id is required')
    return requestJson('/extra-function-paid', {
      method: 'POST',
      body: { function_id, member_id, paid, expected_pay_date, proof_path, proof_submitted_at },
    })
  }

  async getFunctionPaid(function_id) {
    if (!function_id) throw new Error('function_id is required')
    return requestJson(`/extra-function-paid${query({ function_id })}`)
  }

  async updateFunctionPaid({ function_id, member_id, ...changes }) {
    if (!function_id || !member_id) throw new Error('function_id and member_id are required')
    return requestJson('/extra-function-paid', {
      method: 'PATCH',
      body: { function_id, member_id, ...changes },
    })
  }

  async removeFunctionPaid({ function_id, member_id }) {
    if (!function_id || !member_id) throw new Error('function_id and member_id are required')
    return requestJson('/extra-function-paid', { method: 'DELETE', body: { function_id, member_id } })
  }

  /*
    extra_servings — the serving (role) an extra member holds in a community. A person who never uses
    the app is listed in extra_members and given a serving here, exactly as the real `servings` table
    gives one to a member's address. `role` is a free word and the row is keyed by its own id, so a
    member may hold more than one serving.
  */
  async addServing({ member_id, community_id, role }) {
    if (!member_id) throw new Error('member_id is required')
    if (!community_id) throw new Error('community_id is required')
    return requestJson('/extra-servings', {
      method: 'POST',
      body: { member_id, community_id, role },
    })
  }

  async getServings(community_id, member_id) {
    if (!community_id) throw new Error('community_id is required')
    return requestJson(`/extra-servings${query({ community_id, member_id })}`)
  }

  async updateServing(id, changes) {
    if (!id) throw new Error('id is required')
    return requestJson(`/extra-servings/${id}`, { method: 'PATCH', body: changes })
  }

  async removeServing(id) {
    if (!id) throw new Error('id is required')
    return requestJson(`/extra-servings/${id}`, { method: 'DELETE' })
  }
}

export default new ExtraFetch()
