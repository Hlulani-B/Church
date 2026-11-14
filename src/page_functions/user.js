import { callGod } from './god.js'

// Page fetches for the signed-in person's own users row.
export class UserFetch {
  // The caller's row, or null when the address is not in the table yet.
  async find(email) {
    return callGod('user', { function: 'find', email })
  }

  async create({ email, name, surname }) {
    return callGod('user', { function: 'create', email, name, surname })
  }

  /*
    Only name and surname survive: api/god.js filters changes down to SELF_FIELDS, and
    users.email is the primary key that links attendance and testimonies to a person, so
    a browser cannot move its row onto someone else's address.
  */
  async update(changes) {
    return callGod('user', { function: 'update', changes })
  }
}
