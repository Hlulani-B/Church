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
}
