import { callGod } from './god.js'

// Page fetches for the community area. One file per area lives in this folder.
export class CommunityFetch {
  /*
    God's `community` `memberOf`, which reads community_members for the email and then
    the names from community. Returns [{ community_id, name }], or [] for someone with
    no links. Leave `email` empty from a page: the server answers a browser with the
    address on its own id token, so asking about another person only works with
    GOD_SERVER_KEY.
  */
  async getCommunities(email) {
    return callGod('community', { function: 'memberOf', email })
  }

  /*
    Opens a community and records the signed-in person as its admin. Two calls, because
    the new community_id only exists after the first one: create the row in `community`,
    then link the caller's email to it in `community_members`. /api/god fills the email
    from the caller's own id token and forces role to admin, and it refuses the second
    call once the community has any members, so this is the creator's path and not a way
    to join, or take charge of, a group that already exists.
  */
  async createCommunity(name) {
    const community = await callGod('community', { function: 'create', name })
    await callGod('member', {
      function: 'create',
      community_id: community.community_id,
      role: 'admin',
    })
    return community
  }
}
