import React, { useEffect, useState } from "react";
import { SessionFetch } from "../page_functions/session.js";
import { NO_PLACE, clock, askPosition } from "../page_functions/place.js";

const sessions = new SessionFetch();

// How often the page asks whether anything is open. A leader opens a session in front of a room,
// so the gap between that and the box appearing on sixty phones is what this number buys: twenty
// seconds is one request per phone per gap, and it is still shorter than the time it takes to
// read four digits out.
const LISTEN_EVERY = 20000;

/*
  The member's own arrival, said as four digits.

  This is the second write a member has — the other is the notice that says they will not come —
  and the only one that can answer yes. So the box is dark where the rest of the page is white: a
  check-in is a record of something that happened, and the grey box beside it is an apology.

  It is also the only box on these pages that appears and disappears. What a member can type is
  worth nothing while no room is being taken, so the page asks the server every LISTEN_EVERY
  whether a session in this community is stood open right now, and shows itself only while one
  is. The server answers that from the session rows' own two times and its own clock, so the box
  closes by itself when a leader's window ends and nobody has to remember to take it down.
*/
const css = `
.kc{border:1px solid #111;border-radius:2px;padding:20px 22px;margin:34px 0 0;background:#111;color:#fff}
.kc *{box-sizing:border-box}
.kc .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.kc .room{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#fff;margin:8px 0 0}
.kc .room span{color:#a8a8a8;letter-spacing:normal;text-transform:none}
.kc .why{color:#a8a8a8;font-size:14px;margin:8px 0 0}
.kc .fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin:18px 0 0}
.kc label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#a8a8a8;font-weight:600}
/* The digits are what the room was told, so they are set as a PIN is read: wide, spaced and in
   a face where a one and an el are not the same shape. */
.kc input{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:26px;letter-spacing:.18em;text-indent:.18em;text-align:center;color:#fff;background:#0d0d0d;border:1px solid rgba(255,255,255,.24);border-radius:2px;padding:8px 12px;width:9ch}
.kc input:focus{outline:2px solid #fff;outline-offset:1px}
.kc .go{background:#fff;color:#111;border:0;border-radius:2px;padding:12px 24px;font-size:15px;font-weight:600;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;cursor:pointer}
.kc .go:disabled{opacity:.45;cursor:default}
.kc .say{background:#0d0d0d;border-left:3px solid #fff;padding:12px 16px;font-size:14px;margin:16px 0 0}
.kc .say.bad{border-left-color:#ff6b6b}
.kc .fine{font-size:13px;color:#a8a8a8;margin:16px 0 0}
`;

const minutes = (one) => {
  const left = (new Date(one.ended_at) - Date.now()) / 60000;
  if (left <= 0) return "";
  return left < 60 ? `${Math.round(left)} min left` : `${Math.round(left / 60)} h left`;
};

export default function CheckIn({ community_id, email }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  // The row this box wrote, or the one it found already written. Nothing else is kept: the
  // register of the gathering is read by a leader, not by the person standing in the doorway.
  const [came, setCame] = useState(null);
  const [error, setError] = useState("");
  /*
    The gatherings in this community whose window holds at the moment the server answered. An
    empty list is the box saying nothing at all, and it is read from the session rows rather than
    guessed from anything on this page — a member's own idea of what time it is has no business
    deciding whether a check-in is offered.
  */
  const [open, setOpen] = useState([]);
  /*
    The last reading this device gave, kept only to explain itself. A check-in refused for want of
    a position is a check-in the person could fix by allowing location, and the server cannot know
    that the browser said no before it was ever asked.
  */
  const [place, setPlace] = useState(NO_PLACE);

  useEffect(() => {
    if (!community_id) return undefined;
    let here = true;
    const listen = async () => {
      try {
        const rows = await sessions.openSessions({ community_id });
        if (here) setOpen(Array.isArray(rows) ? rows : []);
      } catch {
        /*
          A poll that did not answer says nothing about the room, so the box keeps standing on the
          last one that did and asks again on the next tick. Nothing is shown: a network that
          blinked is not something a person standing in a pew can do anything about, and it is
          certainly not a reason to tell them there is no check-in to make.
        */
      }
    };
    listen();
    const tick = setInterval(listen, LISTEN_EVERY);
    // A phone put in a pocket and taken out again is a phone whose picture of the room is old.
    const show = () => document.visibilityState === "visible" && listen();
    document.addEventListener("visibilitychange", show);
    return () => {
      here = false;
      clearInterval(tick);
      document.removeEventListener("visibilitychange", show);
    };
  }, [community_id]);

  /*
    What leaves here is four digits, which community and the two numbers this device reported at
    the moment the button was pressed. Which gathering those digits name, what day it is, whether
    the window still holds, how near the room this phone is standing and what time it is all come
    back from /api/self, which reads them off the session row and its own clock rather than off
    anything typed into this box.
  */
  async function checkIn(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("Four digits, as the leader read them out.");
      return;
    }
    setBusy(true);
    setError("");
    setCame(null);
    // Asked as it is pressed and never remembered: a place held over from an hour ago would be a
    // claim about a room this phone has since left.
    const read = await askPosition();
    setPlace(read);
    const held = read.state === "held";
    try {
      setCame(
        await sessions.checkIn({
          community_id,
          pin,
          latitude: held ? read.latitude : null,
          longitude: held ? read.longitude : null,
        }),
      );
      setPin("");
      // The room may have moved on while this was being sent, and one arrival does not mean the
      // leader has not opened a second gathering after it.
      setOpen(await sessions.openSessions({ community_id }).catch(() => open));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  // Nothing is open, so there is nothing for this box to say.
  if (!open.length) return null;

  const anywhere = open.every((one) => !one.near_required);

  return (
    <form className="kc" onSubmit={checkIn}>
      <style>{css}</style>
      <p className="what">Here</p>
      <p className="room">
        {open.map((one) => `${one.event_name}, until ${clock(one.ended_at)} (${minutes(one)})`).join(" · ")}
      </p>
      <p className="why">
        Attendance is being taken, so type the four digits the leader just read out and this writes
        you present at the gathering they opened for it. The address is the sign-in on this browser,
        never something typed here, so a check-in can only speak for the person holding it. Where
        this device stands travels with it,{" "}
        {anywhere
          ? "and this gathering is open from anywhere — the leader turned the distance off, so these four digits alone are what marks a person as having come."
          : "and a session opened with a distance on it refuses anybody standing outside that."}
      </p>
      <div className="fields">
        <label>
          PIN
          <input
            id="checkin-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="····"
            value={pin}
            maxLength={4}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <button className="go" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Check in"}
        </button>
      </div>

      {place.state === "refused" && !busy && <div className="say bad">{place.message}</div>}
      {error && <div className="say bad" aria-live="polite">{error}</div>}
      {came && (
        <div className="say" aria-live="polite">
          {came.already
            ? `You were already written down at ${came.event_name}, at ${clock(
                came.checked_in_at,
              )} — that arrival stands, and this changed nothing.`
            : `You are written down as present at ${came.event_name}, checked in at ${clock(
                came.checked_in_at,
              )}.`}
        </div>
      )}
      <p className="fine">Checked in against {email}.</p>
    </form>
  );
}
