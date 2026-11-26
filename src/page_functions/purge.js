import { callGod } from './god.js'

/*
  Page fetch for emptying one community of its record — the rows and the files, not the community row
  itself, which stays behind along with its members and their roles. Reading the community is not here
  — `AdminDashboardFetch.getCommunity` already does that, and a second read of the same row would be
  a second place to keep the rules about it.

  Both the id and the typed name go up, and neither is trusted where it lands: /api/admin re-reads
  the row, compares the signed-in address against `created_by` and compares the name against the
  name in the table. This file only asks. It is deliberately the only place in src/page_functions
  that sends a delete nobody can undo.
*/
export class PurgeFetch {
  async deleteAll({ community_id, name }) {
    const typed = String(name || '').trim()
    if (!community_id) throw new Error('No community was named, so nothing was deleted.')
    if (!typed) throw new Error('Type the community name first, so the request carries proof you know which fellowship this is.')
    return callGod('purge', { function: 'deleteAll', community_id, name: typed })
  }
}
