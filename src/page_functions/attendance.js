import { callGod } from './god.js'

/*
  The two reads the attendance page makes. They go through /api/god like every other page
  read, because the gathering rows are named by the users table, which row level security
  keeps from a browser. src/functions/attendance.js runs the queries on the server, and the
  server answers both for a leader or an admin of the community — a leader reads the
  gathering, and changes nothing about anybody else's.
*/

// The five the fellowship usually hears, offered as suggestions while the reason is typed. They
// are not a list the notice accepts: the box takes whatever wording the person gives it.
export const REASONS = ['Work', 'Transport', 'Sick', 'Family', 'Other']

export class AttendanceFetch {
  // Every gathering this community has recorded, newest first, with its counts.
  async getServices(community_id) {
    return callGod('attendance', { function: 'services', community_id })
  }

  // One gathering: everyone recorded at it, present and absent together.
  async getService(community_id, event_date, event_name) {
    return callGod('attendance', { function: 'service', community_id, event_date, event_name })
  }

  /*
    Recording that whoever is signed in will not be at a gathering. Two things are needed: the
    day and the gathering. A reason may be added, in the caller's own words, and left out.
    Whether the person came is not
    among the boxes — this writes not attending, for the caller, and /api/god forces both
    rather than trusting the page — and a date that has not come is exactly what the box is
    for, because an apology is sent ahead of the gathering it is about. The row is written once
    per person per gathering, so recording the same absence again only replaces the reason.
    What it will never do is turn a yes into a no: a gathering you are recorded as being at
    stays that way, and the server says so.
  */
  async markNotAttending({ community_id, event_date, event_name, reason }) {
    return callGod('event', {
      function: 'record',
      community_id,
      event_date,
      event_name,
      reason,
    })
  }
}
