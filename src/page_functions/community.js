import { callGod } from './god.js'

// The dashboard each community_members role opens, and nothing else.
const DASHBOARDS = {
  admin: '/admin-dashboard',
  leader: '/leader-dashboard',
  member: '/member-dashboard',
}

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

  /*
    Where this person's dashboard for a community lives. The role comes from
    community_members for that (email, community_id) pair, and /api/god answers with the
    address on the caller's own id token rather than the one passed in, so a browser
    cannot ask its way into a higher dashboard. Returns the route it navigated to, or
    null when the address is not a member of that community at all.
  */
  async navigateTo(community_id, email, navigate) {
    const link = await callGod('member', { function: 'find', community_id, email })
    const route = DASHBOARDS[link?.role]
    if (!route) return null
    navigate(route)
    return route
  }
}
