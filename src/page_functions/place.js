/*
  Where this device is standing, read the one time it is worth reading.

  Two pages ask: the one that opens a session writes the answer into the session row, and the one
  that checks in sends the answer to be measured against it. Both need the same three things —
  that the browser was asked rather than told, that the reading is not remembered anywhere, and
  that a refusal is explained in the words the person has to act on — so they come from here
  rather than from two copies that would drift.

  Nothing in this file is stored. A place kept between visits would be a place claimed for a room
  the phone has since left, which is exactly the thing these two readings exist to refuse.
*/

export const NO_PLACE = { state: 'idle', latitude: null, longitude: null, accuracy: null, message: '' }

// A wall clock in the reader's own locale, because the browser has one and the server does not.
export function clock(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Six places keeps the reading to about the width of one metre, which is nowhere near the
// accuracy a phone reports anyway, and a longer string is only more to read out or compare.
export function fix(number) {
  return Number(number.toFixed(6))
}

// Why the device would not answer, in the words the person has to act on.
export function refusal(cause) {
  if (cause?.code === 1) {
    return 'This browser would not give leave to read where it is. Allow location for this page, then ask again.'
  }
  if (cause?.code === 2) {
    return 'Nothing around this device could tell it where it is. Check that location is switched on, then ask again.'
  }
  if (cause?.code === 3) {
    return 'That took too long to answer. Ask again — a moment outdoors, or beside a window, is usually enough.'
  }
  return 'This device would not say where it is. Ask again before going further.'
}

/*
  One reading of where this device stands, straight into the page's state. It is asked for on
  arrival because both sessions and check-ins happen in the room, standing where the room is: the
  numbers come back as what the session row will carry, or as what the check-in will be measured
  against.
*/
export function readPosition(setPlace) {
  if (!('geolocation' in navigator)) {
    setPlace({
      ...NO_PLACE,
      state: 'refused',
      message: 'This browser cannot report a location at all, so no position can be read from it.',
    })
    return
  }
  setPlace({ ...NO_PLACE, state: 'asking' })
  navigator.geolocation.getCurrentPosition(
    (found) =>
      setPlace({
        state: 'held',
        latitude: fix(found.coords.latitude),
        longitude: fix(found.coords.longitude),
        accuracy: Math.round(found.coords.accuracy),
        message: '',
      }),
    (cause) => setPlace({ ...NO_PLACE, state: 'refused', message: refusal(cause) }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  )
}

/*
  The same single reading, handed back rather than pushed into a setter. A check-in cannot be
  sent until the device has answered or refused, and the page that is waiting has no use for the
  'asking' state it writes on the way: the settle below is what tells this promise the difference
  between the reading on its way and the one that arrived. Refusal is a resolved answer too — a
  phone that will not say where it stands still has a check-in to send, and the server is the one
  that knows whether this session is a place where that is enough.
*/
export function askPosition() {
  return new Promise((resolve) => {
    readPosition((next) => {
      if (next.state !== 'asking') resolve(next)
    })
  })
}
