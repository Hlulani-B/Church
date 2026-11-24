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
    filled in by /api/leader, from the caller's own id token in the first case. Marking anybody else
    present is not part of opening a session, and no page can ask for it.
  */
  async openSession({
    community_id,
    pin,
    event_name,
    date,
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
      date,
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
    PIN, which /api/self withholds on purpose so this poll cannot tell the room the digits before
    the leader does.
  */
  async openSessions({ community_id }) {
    return callGod('session', { function: 'open', community_id })
  }

  /*
    What a member's dashboard listens to for its notice: every check-in in this community that is
    still live, whether it is taking arrivals now or is only scheduled for later. It answers to the
    self tier like 'open', and for the same reason — the people who need to hear that attendance is
    being taken are the plain members in the room, and they lead nothing. It carries no PIN; the
    leader-only 'manage' read is the one that does.
  */
  async liveSessions({ community_id }) {
    return callGod('session', { function: 'live', community_id })
  }

  /*
    What the leader and admin dashboards listen to on a timer: every check-in in this community
    that is still theirs to act on — neither called off nor already ended — each with its window
    and radius, marked as mine or someone else's. Unlike the member's open-sessions poll this answers to
    the leader tier, because it carries the PIN — but only for the rows the caller opened, and for
    every row when they are an admin, so a second leader cannot read digits off a gathering they are
    not running. A cancelled session leaves this list entirely, which is why pressing Cancel makes
    its card (and its QR) disappear instead of sitting there marked off.
  */
  async manageSessions({ community_id }) {
    return callGod('session', { function: 'manage', community_id })
  }

  /*
    The two changes a dashboard makes to a check-in it manages: call it off, or widen and narrow
    the distance it takes arrivals from. Only the one who opened a session, or an admin of the
    community, is allowed to make them, and /api/leader settles that against the row itself rather
    than trusting this page. Cancelling is one-way and carries no undo; a radius of null means no
    distance limit at all.
  */
  async reviseSession({ community_id, session_id, radius, cancel }) {
    const changes = {}
    if (cancel === true) changes.cancel = true
    if (radius !== undefined) changes.radius = radius
    return callGod('session', { function: 'revise', community_id, session_id, changes })
  }

  /*
    The member's own arrival, said as four digits. Nothing else about the check-in is asserted
    here: which gathering the PIN names, what day it is, whether the window holds, how far the
    phone is standing from where the session was opened and what time it is all come back from
    /api/self, which reads them off the session row and its own clock rather than off this page.
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
