import { callGod } from './god.js'

// Page fetches for the users table: the signed-in person's own row, and the read the absence
// form's For-who box makes for the whole community.
export class UserFetch {
  // The caller's row, or null when the address is not in the table yet.
  async find(email) {
    return callGod('user', { function: 'find', email })
  }

  /*
    The people of one community — email, name and surname — for whoever leads or admins it.
    The server takes the community_id, reads the addresses off community_members and then the
    names off users, so a For-who list is the roster's own people and row level security never
    puts a name in a browser's hands directly.
  */
  async getUsers(community_id) {
    return callGod('user', { function: 'getUsers', community_id })
  }

  async create({ email, name, surname }) {
    return callGod('user', { function: 'create', email, name, surname })
  }

  /*
    Only name and surname survive: api/self.js filters changes down to SELF_FIELDS, and
    users.email is the primary key that links attendance and testimonies to a person, so
    a browser cannot move its row onto someone else's address.
  */
  async update(changes) {
    return callGod('user', { function: 'update', changes })
  }
}
