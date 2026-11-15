import { callGod } from './god.js'

/*
  Page fetches for a check-in: opening one, asking what is open, and saying you are stood in the
  room. One file per area lives in this folder.

  The two opening calls answer to the leader tier on the server, so a leader or an admin of the
  community opens a session and a plain member cannot, whatever the page says about who is asking.
  Asking what is open, and checking in, are member calls — the person who needs them is the one
  holding a phone in the pew, who leads nothing.
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
    sends the PIN it was shown, the two times, which community, the name of the gathering, how
    near the room a check-in has to come from and the place the leader's device reported; the
    address recorded as `created_by`, the day the row carries and the shape of the PIN are all
    filled in by /api/god, from the caller's own id token in the first case. Marking anybody else
    present is not part of opening a session, and no page can ask for it.
  */
  async openSession({
    community_id,
    pin,
    event_name,
    started_at,
    ended_at,
    latitude,
    longitude,
    radius,
    allow_any_radius,
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
      radius,
      allow_any_radius,
    })
  }

  /*
    What could be checked in to in this community right now, as the gatherings whose window holds.
    The answer carries a name, two times and whether a distance will be asked about — never the
    PIN, which /api/god withholds on purpose so this poll cannot tell the room the digits before
    the leader does.
  */
  async openSessions({ community_id }) {
    return callGod('session', { function: 'open', community_id })
  }

  /*
    The member's own arrival, said as four digits. Nothing else about the check-in is asserted
    here: which gathering the PIN names, what day it is, whether the window holds, how far the
    phone is standing from where the session was opened and what time it is all come back from
    /api/god, which reads them off the session row and its own clock rather than off this page.
    The two coordinates are the device's reading or nothing at all — a page that could not get a
    position sends nulls and lets the function decide whether that is enough.
  */
  async checkIn({ community_id, pin, latitude, longitude }) {
    return callGod('event', {
      function: 'checkin',
      community_id,
      pin,
      latitude,
      longitude,
    })
  }
}
