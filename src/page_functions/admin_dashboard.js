import { callGod } from './god.js'

// Page fetches for the admin dashboard. One file per area lives in this folder, and the
// JSX only ever calls these — never Supabase, never /api/god by hand.

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
    return callGod('community', { function: 'changeCode', community_id })
  }

  /*
    Replaces the code with one the server drew: nothing is typed, and nothing about the
    new code comes from this browser. /api/god checks the drawn code against every
    community and draws again until no row holds it, so the code is free the moment it is
    written. The whole row comes back, because the name belongs in the sentence that says
    the code has changed.
  */
  async changeJoinCode(community_id) {
    return callGod('community', { function: 'changeCode', community_id })
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
