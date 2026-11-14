import { callGod } from './god.js'

// Page fetches for the admin dashboard. One file per area lives in this folder, and the
// JSX only ever calls these — never Supabase, never /api/god by hand.

/*
  The three roles the dashboard can put somebody in, each with the line that says what it is
  for. The same three words are the alphabet the server accepts, in
  `src/functions/admin_dashboard.js`; this copy exists so a screen can list the choices and
  explain them without importing server code, which would pull the service key's world into
  the browser bundle.
*/
export const ROLES = [
  { role: 'member', does: 'Marks themselves attending or not, gives a reason, shares a testimony.' },
  {
    role: 'leader',
    does: 'A member first, and then this community and its attendance to read — nothing to change.',
  },
  {
    role: 'admin',
    does: 'All of that, plus who holds which role, who leaves, and the join code.',
  },
]

export class AdminDashboardFetch {
  /*
    God's `admin` `roster`, which joins community_members to users for one community and
    answers [{ email, name, surname, role }] — admins first, then leaders, then members.
    /api/god only answers this for a leader or an admin of that community, and it reads the
    caller's role off the id token rather than anything in this request. A leader reads the
    list; the role in it is only ever written by an admin.
  */
  async getMembers(community_id) {
    return callGod('admin', { function: 'roster', community_id })
  }

  /*
    The one community being administered: { community_id, name, join_id }. The name goes
    in the heading so the page can say which group the list below belongs to, and the
    join_id is the code people type to find it. /api/god answers this for an admin of
    that community_id and for nobody else.
  */
  async getCommunity(community_id) {
    return callGod('community', { function: 'find', community_id })
  }

  /*
    Takes one person out of this community and then rotates its join code, which is why the
    two belong in one function rather than left to whoever calls them. The removal only
    unlinks them — their attendance rows and testimonies stay recorded against their
    address — and the rotation is what stops somebody who had memorised the code from
    typing their way back in. /api/god answers both only for an admin of this community,
    refuses to let one admin delete another, and refuses to empty the community entirely.
    The community row comes back, so the page can show the new code beside the sentence
    saying it changed.
  */
  async removeMember(community_id, email) {
    await callGod('member', { function: 'remove', community_id, member_email: email })
    return callGod('admin', { function: 'changeCode', community_id })
  }

  /*
    Puts one person in this community in a different role: 'member', 'leader' or 'admin'.
    Nothing about the write is decided here. /api/god takes the caller's address off their id
    token, refuses anybody who is not an admin of this community, refuses an address that has
    no link in it, and refuses the one change a community cannot survive — its only admin
    giving the role up. The updated link comes back, so the screen says what the row holds
    rather than what this click asked for.
  */
  async assignRole(community_id, email, role) {
    return callGod('admin', { function: 'assign', community_id, member_email: email, role })
  }

  /*
    Replaces the code with one the server drew: nothing is typed, and nothing about the
    new code comes from this browser. /api/god checks the drawn code against every
    community and draws again until no row holds it, so the code is free the moment it is
    written. The whole row comes back, because the name belongs in the sentence that says
    the code has changed.
  */
  async changeJoinCode(community_id) {
    return callGod('admin', { function: 'changeCode', community_id })
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
