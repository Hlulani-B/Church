import React, { useEffect, useState } from "react";
import { SessionFetch } from "../page_functions/session.js";
import { clock } from "../page_functions/place.js";

const sessions = new SessionFetch();

/*
  How often the dashboard asks the room what is happening. It matches the check-in box on purpose:
  a leader opens a session in front of a crowd, and the gap between that and every other phone
  learning about it is what this buys. Fifteen seconds is one quiet request per open dashboard, and
  it is shorter than the time it takes to read four digits out loud.
*/
const LISTEN_EVERY = 15000;

// A day and a time together, so a session opened for later today still says which day it is.
function day(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Which side of its own window a session sits on, read against this device's clock. The moment is
// taken here rather than in the card so a component render stays free of the impure clock read.
function statusOf(one) {
  const now = Date.now();
  if (one.cancel === true) return "cancelled";
  if (new Date(one.started_at).getTime() > now) return "upcoming";
  if (new Date(one.ended_at).getTime() < now) return "ended";
  return "open";
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

  It is a poll and not a push because that is what this app has: no message service is wired up,
  so the notice everyone in a community gets is this box appearing on their dashboard the next time
  it asks. That is the same way the member's check-in box already finds them, and it needs no new
  credential or permission to work.

  Everything here is a mirror of what the server already allows. The manage controls show for a row
  this caller opened, or for any row when they are an admin of the community; the PIN only reaches
  them when the server chose to send it. The buttons call the same guarded /api/god that would
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
`;

function ManageCard({ one, admin, communityId, onChanged }) {
  const status = statusOf(one);
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
      } else {
        const metres = radius.trim() === "" ? null : Number(radius);
        if (metres !== null && (!Number.isFinite(metres) || metres <= 0 || metres > 20000)) {
          setMessage({ bad: true, text: "A radius is a distance in metres, from 1 to 20000 — or leave it blank for no limit." });
          setBusy(false);
          return;
        }
        await sessions.reviseSession({ community_id: communityId, session_id: one.session_id, radius: metres });
      }
      await onChanged();
    } catch (cause) {
      setMessage({ bad: true, text: cause.message });
    } finally {
      setBusy(false);
    }
  }

  // A plain leader, looking at somebody else's gathering, with nothing to manage on it.
  if (!one.mine && !admin) {
    if (status === "cancelled") return null;
    return (
      <div className="card them">
        <p className="head">
          <span className="what">{one.event_name || "A gathering"}</span>
          <span className={`tag ${status}`}>{tag}</span>
        </p>
        <p className="who">
          {status === "open"
            ? `Attendance is being taken — ${clock(one.started_at)} to ${clock(one.ended_at)}, ${reach(one)}.`
            : status === "upcoming"
              ? `Scheduled for ${day(one.started_at)}, ${clock(one.started_at)} to ${clock(one.ended_at)}.`
              : `Called off by ${one.created_by}.`}
        </p>
      </div>
    );
  }

  return (
    <div className={`card${status === "cancelled" ? " cancelled" : ""}`}>
      <p className="head">
        <span className="what">{one.event_name || "A gathering"}</span>
        <span className={`tag ${status}`}>{tag}</span>
      </p>
      <p className="who">
        {one.mine ? "You opened" : `${one.created_by} opened`} this register {day(one.started_at)}, from{" "}
        <strong>{clock(one.started_at)}</strong> to <strong>{clock(one.ended_at)}</strong> — taking
        check-ins {reach(one)}.
      </p>

      {one.pin && (
        <p className="pin">
          <span className="lbl">PIN to read out</span>
          {one.pin}
        </p>
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

  // Nothing is open, scheduled or recently cancelled: there is nothing for this box to say.
  if (!rows.length) return null;

  // The one the caller opened, and whatever else is live, float to the top of the list.
  const ordered = [...rows].sort((a, b) => {
    const aMine = a.mine ? 0 : 1;
    const bMine = b.mine ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    return new Date(b.started_at) - new Date(a.started_at);
  });

  return (
    <section className="ac">
      <style>{css}</style>
      {ordered.map((one) => (
        <ManageCard
          key={one.session_id}
          one={one}
          admin={admin}
          communityId={community_id}
          onChanged={refresh}
        />
      ))}
    </section>
  );
}
