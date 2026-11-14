import { callGod } from './god.js'

// Page fetches for the admin dashboard. One file per area lives in this folder, and the
// JSX only ever calls these — never Supabase, never /api/god by hand.

// The join code is six characters, typed by hand or read aloud, so it is tidied the same
// way on the way in as /api/god checks it on the way through.
export function formatJoinCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export class AdminDashboardFetch {
  /*
    God's `member` `members`, which joins community_members to users for one community
    and answers [{ email, name, surname, role }] — admins first, then leaders, then
    members. /api/god only answers this for an admin of that community, and it reads the
    caller's role off the id token rather than anything in this request.
  */
  async getMembers(community_id) {
    return callGod('member', { function: 'members', community_id })
  }

  // The code people type to find this community.
  async getJoinCode(community_id) {
    const row = await callGod('community', { function: 'find', community_id })
    return row?.join_id ?? null
  }

  /*
    Replaces the code. Returns the whole community row, because the unique constraint can
    refuse a code somebody else already holds and the caller needs to know what the
    community is called when saying so.
  */
  async changeJoinCode(community_id, join_id) {
    const code = formatJoinCode(join_id)
    return callGod('community', { function: 'update', community_id, changes: { join_id: code } })
  }

  /*
    Copy, not a fetch: it belongs here so the page holds no logic of its own. The browser
    only lets a page write the clipboard after a click and only over https, so a refusal
    comes back as an error the page can show instead of a silent nothing.
  */
  async copyJoinCode(join_id) {
    if (!navigator.clipboard?.writeText) {
      throw new Error('This browser will not let the page copy. Select the code and copy it yourself.')
    }
    await navigator.clipboard.writeText(join_id)
    return join_id
  }
}
