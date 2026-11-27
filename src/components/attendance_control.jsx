import React, { useEffect, useState } from "react";
import { SessionFetch } from "../page_functions/session.js";
import { clock } from "../page_functions/place.js";
import {
  LEAD_MINUTES,
  isHeldBack,
  minutesUntilStart,
  sessionStatus,
} from "../page_functions/session_timing.js";
import QrCard from "./qr_code.jsx";
import { pushToast } from "./toast.jsx";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";

const sessions = new SessionFetch();

/*
  How often the dashboard asks the room what is happening. It matches the check-in box on purpose:
  a leader opens a session in front of a crowd, and the gap between that and every other phone
  learning about it is what this buys. Fifteen seconds is one quiet request per open dashboard, and
  it is shorter than the time it takes to read four digits out loud.
*/
const LISTEN_EVERY = 15000;

// The lead window in the words the collapsed line uses, so the sentence cannot drift away from the
// rule it is describing.
const LEAD_WORDS = LEAD_MINUTES >= 60 ? `${LEAD_MINUTES / 60} hours` : `${LEAD_MINUTES} minutes`;

// A day and a time together, so a session opened for later today still says which day it is.
function day(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// How soon a register that has not opened yet will, said the way somebody would say it in a room.
// Only for the same day: a card for a Sunday nine days off already prints the date, and "opens in
// 216 h" is arithmetic a reader has to undo rather than information.
function lead(one) {
  const ahead = minutesUntilStart(one);
  if (ahead === null || ahead <= 0 || ahead >= 24 * 60) return "";
  return ahead < 60 ? `opens in ${ahead} min` : `opens in ${Math.round(ahead / 60)} h`;
}

// How near the room a check-in has to come from, said the way the opener chose it.
function reach(one) {
  return one.allow_any_radius || !one.near_required
    ? "from anywhere"
    : `within ${one.radius} m`;
}

/*
  The dashboard's own ear on the room.

  This is where the app "listens" once a check-in has been opened. Every leader and admin dashboard
  runs it on a timer, and it answers three things at once: whether the person looking at the page
  opened the register themselves — in which case it says so, with the window they set, the radius,
  and the PIN still to be read out — whether somebody else in the fellowship is taking attendance
  right now, and how to call a session off or widen its radius while it holds.

  A register opened for further out than two hours is held back to one line of text naming it. The
  dashboard is the room: what is being counted now, and what is about to be. A plan made last week for
  next Sunday is neither, and it carried a PIN and a QR up there with the live ones, which is how a
  card for 6 Dec ended up read out on the 27th. Nothing is lost by folding it — the row is still
  fetched, still named, and one press away from being cancelled.

  It is a poll and not a push because that is what this app has: no message service is wired up,
  so the notice everyone in a community gets is this box appearing on their dashboard the next time
  it asks. That is the same way the member's check-in box already finds them, and it needs no new
  credential or permission to work.

  Everything here is a mirror of what the server already allows. The manage controls show for a row
  this caller opened, or for any row when they are an admin of the community; the PIN only reaches
  them when the server chose to send it. The buttons call the same guarded /api/leader that would
  refuse the change anyway, so a stale screen can do nothing it was not entitled to.
*/
const css = `
.ac{display:flex;flex-direction:column;gap:14px;margin:34px 0 0}
.ac .card{border:1px solid #e3e3e3;border-left:4px solid #111;border-radius:2px;padding:16px 18px;background:#fafafa}
.ac .card.them{border-left-color:#bdbdbd}
.ac .card.cancelled{border-left-color:#a11111;opacity:.85}
.ac .head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0}
.ac .head .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:20px;font-weight:500;margin:0}
.ac .tag{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;padding:2px 10px;border:1px solid #111;border-radius:999px}
.ac .tag.open{background:#111;color:#fff}
.ac .tag.upcoming{color:#666;border-color:#bdbdbd}
.ac .tag.cancelled{color:#a11111;border-color:#a11111}
.ac .who{font-size:14px;color:#666;margin:8px 0 0}
.ac .pin{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:.18em;color:#111;margin:12px 0 0}
.ac .pin .lbl{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;display:block;margin-bottom:2px}
.ac .row{display:flex;align-items:flex-end;flex-wrap:wrap;gap:10px;margin:14px 0 0}
.ac .field{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.ac .field input{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:9px 12px;width:140px}
.ac .field input:focus{outline:none;border-color:#111}
.ac button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:10px 18px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.ac button:hover{background:#111;color:#fff}
.ac button.dark{background:#111;color:#fff}
.ac button.dark:hover{background:#333}
.ac button:disabled{opacity:.5;cursor:default}
.ac .note{font-size:13px;margin:12px 0 0;padding:8px 12px;border-left:3px solid #111;background:#f0f0f0}
.ac .note.bad{border-left-color:#a11111;background:#fbeaea;color:#7a1010}
/* The line that accounts for the cards being held back. It is deliberately not a card: it says
   nothing you can act on, only what is out of sight and how to put it back. */
.ac .later{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:13px;color:#666;margin:2px 0 0}
.ac .later button{background:none;color:#111;border:0;border-bottom:1px solid #bdbdbd;border-radius:0;padding:0;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.ac .later button:hover{background:none;color:#111;border-bottom-color:#111}
`;

function ManageCard({ one, admin, communityId, onChanged, onCancelled }) {
  const status = sessionStatus(one);
  const canManage = (one.mine || admin) && status !== "cancelled" && status !== "ended";
  const showControls = canManage && (one.mine || admin);
  const [radius, setRadius] = useState(one.radius === null || one.radius === undefined ? "" : String(one.radius));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const tag = { open: "Open", upcoming: "Scheduled", cancelled: "Cancelled", ended: "Ended" }[status];

  async function act(kind) {
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "cancel") {
        await sessions.reviseSession({ community_id: communityId, session_id: one.session_id, cancel: true });
        /*
          Called off is called off: the card leaves now rather than on the next poll. `manage` no
          longer answers with a cancelled row, so the refresh underneath would drop it a moment later
          anyway, but waiting on the network to find out that the thing you just did worked is how a
          screen looks broken. Removing it here also covers the case the poll cannot: a second
          dashboard pressing cancel on the same row.
        */
        onCancelled(one.session_id);
        pushToast({
          title: "Check-in cancelled",
          detail: `${one.event_name || "This gathering"} · no further check-ins`,
          delay: 2000,
          life: 6000,
        });
        return;
      }
      const metres = radius.trim() === "" ? null : Number(radius);
      if (metres !== null && (!Number.isFinite(metres) || metres <= 0 || metres > 20000)) {
        setMessage({ bad: true, text: "A radius is a distance in metres, from 1 to 20000 — or leave it blank for no limit." });
        setBusy(false);
        return;
      }
      await sessions.reviseSession({ community_id: communityId, session_id: one.session_id, radius: metres });
      await onChanged();
    } catch (cause) {
      setMessage({ bad: true, text: cause.message });
    } finally {
      setBusy(false);
    }
  }

  // A cancelled session shows nothing to anybody — not its opener, not an admin, not a leader
  // watching somebody else's gathering. It has no PIN to read out and no arrivals to take, and the
  // row still carries both the digits and the QR built from them, which is a secret with no room
  // left to say it in. `manage` drops these rows server-side; this is the same rule held to the
  // screen so a list that was already in flight cannot put the card back.
  if (status === "cancelled") return null;

  // A plain leader, looking at somebody else's gathering, with nothing to manage on it.
  if (!one.mine && !admin) {
    return (
      <div className="card them">
        <p className="head">
          <span className="what">{one.event_name || "A gathering"}</span>
          <span className={`tag ${status}`}>{tag}</span>
        </p>
        <p className="who">
          {status === "open"
            ? `Attendance is being taken — ${clock(one.started_at)} to ${clock(one.ended_at)}, ${reach(one)}.`
            : status === "ended"
              ? `Attendance closed at ${clock(one.ended_at)}.`
              : `Scheduled for ${day(one.started_at)}, ${clock(one.started_at)} to ${clock(one.ended_at)}${
                  lead(one) ? ` — ${lead(one)}` : ""
                }.`}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="head">
        <span className="what">{one.event_name || "A gathering"}</span>
        <span className={`tag ${status}`}>{tag}</span>
      </p>
      <p className="who">
        {/* Whoever opened it is said in words. This card is read by the rest of the community's
            leaders, and the sign-in one of them logged in with tells nobody anything they need —
            the same rule the roster and the function register are held to. */}
        {one.mine ? "You opened" : "A leader opened"} this register {day(one.started_at)}, from{" "}
        <strong>{clock(one.started_at)}</strong> to <strong>{clock(one.ended_at)}</strong> —{" "}
        {status === "upcoming"
          ? lead(one)
            ? `${lead(one)}, then takes check-ins ${reach(one)}`
            : `takes check-ins ${reach(one)}`
          : status === "ended"
            ? `took check-ins ${reach(one)}`
            : `taking check-ins ${reach(one)}`}
        .
      </p>

      {one.pin && (
        <p className="pin">
          <span className="lbl">
            {status === "upcoming" ? "PIN for when it opens" : "PIN to read out"}
          </span>
          {one.pin}
        </p>
      )}

      {/*
        The digits, once more as a code. Whoever the PIN reached (the one who opened it, or an
        admin) gets the matching QR here too, so the room can scan instead of type without leaving
        the dashboard. It carries the same three ids the /qr page reads, and it stays hidden for a
        plain leader looking at somebody else's gathering — they never saw the PIN, so a code built
        from it would only be a way around that.
      */}
      {one.pin && one.session_id && (
        <QrCard community_id={communityId} session_id={one.session_id} pin={one.pin} />
      )}

      {showControls && status !== "cancelled" && (
        <div className="row">
          <label className="field">
            Check-ins within (m)
            <input
              type="number"
              min="1"
              max="20000"
              step="10"
              value={radius}
              placeholder="no limit"
              disabled={busy}
              onChange={(event) => setRadius(event.target.value)}
            />
          </label>
          <button className="dark" type="button" disabled={busy} onClick={() => act("radius")}>
            Save radius
          </button>
          <button type="button" disabled={busy} onClick={() => act("cancel")}>
            Cancel session
          </button>
        </div>
      )}

      {message && <p className={`note${message.bad ? " bad" : ""}`}>{message.text}</p>}
    </div>
  );
}

export default function AttendanceControl({ community_id, admin = false }) {
  const [rows, setRows] = useState([]);
  /*
    Whether the plans more than two hours out are on screen as well. They are held back by default,
    not thrown away: `manage` answers with them either way, and the person who opened a register for
    next Sunday still has to be able to call it off. So the row becomes one quiet line naming what is
    not shown, and this switch puts the cards back.
  */
  const [showLater, setShowLater] = useState(false);

  useEffect(() => {
    if (!community_id) return undefined;
    let here = true;
    const listen = async () => {
      try {
        const next = await sessions.manageSessions({ community_id });
        if (here) setRows(Array.isArray(next) ? next : []);
      } catch {
        /* A poll that did not answer says nothing about the room, so the box keeps standing on the
           last one that did and asks again on the next tick. */
      }
    };
    listen();
    const tick = setInterval(listen, LISTEN_EVERY);
    const show = () => document.visibilityState === "visible" && listen();
    document.addEventListener("visibilitychange", show);
    return () => {
      here = false;
      clearInterval(tick);
      document.removeEventListener("visibilitychange", show);
    };
  }, [community_id]);

  // A refresh after a change, so the card answers with the row the server just wrote.
  async function refresh() {
    const next = await sessions.manageSessions({ community_id });
    setRows(Array.isArray(next) ? next : []);
  }

  /*
    The one the caller opened floats to the top, and after that the room's own order: what is being
    taken now, then what opens next, then what has already run out. Started-first is what used to
    sort a register opened for next Sunday above the one being counted in the hall, and a dashboard
    is read from the top.
  */
  const RANK = { open: 0, upcoming: 1, ended: 2 };
  const ordered = [...rows].sort((a, b) => {
    const aMine = a.mine ? 0 : 1;
    const bMine = b.mine ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const rankA = RANK[sessionStatus(a)] ?? 3;
    const rankB = RANK[sessionStatus(b)] ?? 3;
    if (rankA !== rankB) return rankA - rankB;
    const startA = new Date(a.started_at).getTime();
    const startB = new Date(b.started_at).getTime();
    // What is still coming is soonest-first; what is running or done is newest-first.
    return rankA === 1 ? startA - startB : startB - startA;
  });

  // Two hours out is the line between the room's business and a plan. Everything behind it is
  // collapsed into one line of text until somebody asks to see it.
  const later = ordered.filter((one) => isHeldBack(one));
  const shown = showLater ? ordered : ordered.filter((one) => !isHeldBack(one));

  // A card is a screenful on its own, so ten of them is where the list stops and the count line
  // takes over. The hook sits above the empty check: a hook cannot be asked to keep out of a
  // render that decided to leave early. These cards carry no anchor, so the screen stays where the
  // reader left it — the box is a stack of cards at the top of a dashboard, not a long register.
  const live = usePager(shown, PER_PAGE, `${community_id}|${showLater ? "later" : "now"}`);

  // Nothing is open, scheduled or recently cancelled: there is nothing for this box to say.
  if (!rows.length) return null;

  // What the collapsed line names, so a hidden card is never a card nobody can account for.
  const plans = later
    .slice(0, 3)
    .map((one) => `${one.event_name || "A gathering"} on ${day(one.started_at)}`)
    .join(", ");
  const more = later.length > 3 ? ` and ${later.length - 3} more` : "";

  return (
    <section className="ac">
      <style>{css}</style>
      {live.chunk.map((one) => (
        <ManageCard
          key={one.session_id}
          one={one}
          admin={admin}
          communityId={community_id}
          onChanged={refresh}
          onCancelled={(session_id) => setRows((before) => before.filter((row) => row.session_id !== session_id))}
        />
      ))}
      <Pager state={live} noun={live.total === 1 ? "session" : "sessions"} />

      {later.length > 0 && (
        <p className="later">
          {showLater ? (
            <>
              {later.length} {later.length === 1 ? "register" : "registers"} more than {LEAD_WORDS}{" "}
              out are shown above.
              <button type="button" onClick={() => setShowLater(false)}>
                Hide them
              </button>
            </>
          ) : (
            <>
              Not shown: {plans}
              {more} — {later.length === 1 ? "it opens" : "they open"} more than {LEAD_WORDS} from
              now.
              <button type="button" onClick={() => setShowLater(true)}>
                Show {later.length === 1 ? "it" : "them"}
              </button>
            </>
          )}
        </p>
      )}
    </section>
  );
}
