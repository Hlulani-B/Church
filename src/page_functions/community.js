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
    call once the community has any members, so this is the creator's path. Joining a group
    that already exists is joinCommunity below, and that one makes a member, never an admin.
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
    Joining a community with the code an admin showed somebody. The request carries those six
    characters and nothing else: /api/god reads the community off the code, answers for the
    address on this browser's own id token and writes the role itself, so a page cannot join on
    somebody else's behalf or join as anything but a member.

    The list is read again afterwards, because the answer from the write names no community and
    the page has to say which one you are now in — and that read is handed back too, so the
    cards under the note come from the same trip rather than a second identical one.
  */
  async joinCommunity(join_id) {
    const code = String(join_id || '').trim().toUpperCase()
    if (!code) throw new Error('A join code is six characters, and this box is empty.')
    const link = await callGod('community', { function: 'join', join_id: code })
    const all = await this.getCommunities()
    const one = all.find((each) => each.community_id === link?.community_id)
    return { ...one, community_id: link?.community_id, role: link?.role, mine: all }
  }

  /*
    Where this person's dashboard for a community lives. The role comes from
    community_members for that (email, community_id) pair, and /api/god answers with the
    address on the caller's own id token rather than the one passed in, so a browser
    cannot ask its way into a higher dashboard. Returns the route it navigated to, or
    null when the address is not a member of that community at all.

    The card you clicked travels with you: community_id, its name and your own address.
    Every screen behind this one is about one community, and it reads those three from the
    route rather than guessing. A guess is how somebody ends up administering the wrong
    fellowship, and a name the pages each had to fetch themselves is a header that arrives
    late or not at all.
  */
  async navigateTo(community, email, navigate) {
    const link = await callGod('member', {
      function: 'find',
      community_id: community.community_id,
      email,
    })
    const route = DASHBOARDS[link?.role]
    if (!route) return null
    navigate(route, { state: { community_id: community.community_id, name: community.name, email } })
    return route
  }
}
