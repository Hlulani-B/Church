import { callGod } from './god.js'

/*
  Page fetches for opening a check-in session. One file per area lives in this folder.

  Both calls answer to the leader tier on the server, so a leader or an admin of the community
  opens a session and a plain member cannot, whatever the page says about who is asking.
*/
export class SessionFetch {
  /*
    The four digits to show the room, drawn on the server. Nothing is written: the leader reads
    the PIN out, sets the two times, and the row arrives when they save. Asking here rather than
    rolling a number in the page is what makes the PIN on the screen and the PIN in the table the
    same pair of digits.
  */
  async generatePin(community_id) {
    const one = await callGod('session', { function: 'pin', community_id })
    return one?.pin || ''
  }

  /*
    One row in `session`, and the gathering's own attendance row for whoever opened it. The page
    sends the PIN it was shown, the two times, which community, the name of the gathering and the
    place the leader's device reported; the address recorded as `created_by`, the day the row
    carries and the shape of the PIN are all filled in by /api/god, from the caller's own id token
    in the first case. Marking anybody else present is not part of opening a session, and no page
    can ask for it.
  */
  async openSession({
    community_id,
    pin,
    event_name,
    started_at,
    ended_at,
    latitude,
    longitude,
  }) {
    return callGod('session', {
      function: 'create',
      community_id,
      pin,
      event_name,
      started_at,
      ended_at,
      latitude,
      longitude,
    })
  }
}
