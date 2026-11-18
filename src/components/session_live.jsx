import React, { useEffect, useState } from "react";
import { SessionFetch } from "../page_functions/session.js";
import { clock, askPosition } from "../page_functions/place.js";
import { pushToast } from "./toast.jsx";

const sessions = new SessionFetch();

/*
  How often a member's dashboard asks the community whether anything is happening. It matches the
  leader's control on purpose: a leader opens a session in front of a crowd, and the gap between
  that and every other phone hearing about it is what this buys. Fifteen seconds is one quiet
  request per open dashboard, and shorter than the time it takes to read four digits out loud.
*/
const LISTEN_EVERY = 15000;

// How near the room a check-in has to come from, said the way the opener chose it.
function reach(one) {
  return one.allow_any_radius || !one.near_required
    ? "from anywhere"
    : `within ${one.radius} m`;
}

/*
  The notice every member of a fellowship sees when attendance is being taken RIGHT NOW.

  Only sessions whose window holds (started_at <= now <= ended_at) and cancel is false reach this
  component — nothing scheduled, nothing ended. A member who walks in during a live session sees
  this card appear with the leader's name and a PIN input. They type the four digits the leader
  just read out, press Check in, and the server decides:
    - Rejection: "the pin is wrong" / "you are not within the radius" / etc.
    - Acceptance: "You have marked the register" — the event table gets attend=true, reason=null.

  It is a poll and not a push, because that is what this app has: no message service is wired up,
  so the notice a whole community gets is this card appearing the next time their dashboard asks.
*/
const css = `
.sl{display:flex;flex-direction:column;gap:12px;margin:34px 0 0}
.sl .card{border:1px solid #e3e3e3;border-left:4px solid #111;border-radius:2px;padding:14px 18px;background:#fafafa}
.sl .head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0}
.sl .head .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:600;margin:0}
.sl .tag{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;padding:2px 10px;border:1px solid #111;border-radius:999px}
.sl .tag.open{background:#111;color:#fff}
.sl .who{font-size:14px;color:#666;margin:8px 0 0}
.sl .ask{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:14px 0 0}
.sl .ask label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.sl .ask input{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;letter-spacing:.18em;text-indent:.18em;text-align:center;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:7px 10px;width:9ch}
.sl .ask input:focus{outline:none;border-color:#111}
.sl .ask button{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.sl .ask button:disabled{opacity:.5;cursor:default}
.sl .say{font-size:14px;margin:12px 0 0;border-left:3px solid #1f7a3f;padding:8px 12px;background:#fff}
.sl .say.bad{border-left-color:#a11111}
`;

/*
  One card per live session. A session whose register already holds you never reaches this page
  at all: the server's live read drops it — for whoever marked the register, including the person
  who opened the session, whose own yes is written when they save it. There is nothing here to
  mark twice, so there is nothing to show. The four digits go to /api/self, which matches them
  against the session row (PIN, window, distance) using the server's own clock. Nothing on this
  page decides whether a check-in is true, and a check-in that lands makes this card — the whole
  section, if it was the last one — disappear on the spot.
*/
function Card({ one, community_id, onMarked }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {kind:'ok'|'bad', text}
  const who = one.leader_name || "A leader";

  async function checkIn(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setResult({ kind: "bad", text: "Enter the four digits the leader read out." });
      return;
    }
    setBusy(true);
    setResult(null);
    const read = await askPosition();
    const held = read.state === "held";
    try {
      const came = await sessions.checkIn({
        community_id,
        pin,
        latitude: held ? read.latitude : null,
        longitude: held ? read.longitude : null,
      });
      setResult({
        kind: "ok",
        text: came.already
          ? `You have already marked the register at ${came.event_name}, done at ${clock(came.checked_in_at)}.`
          : `You have marked the register at ${came.event_name}, at ${clock(came.checked_in_at)}.`,
      });
      /*
        Marked is marked: the card goes now rather than on the next poll. The same answer arrives
        on every later read — the server no longer lists a session this register already holds —
        so waiting fifteen seconds to forget what just happened would only look like a freeze.
        A short toast then slides in two seconds after, into the space the card left, saying the
        same thing more quietly. The delay is deliberate: an instant toast would arrive on top of
        the disappearing card and read as a flicker, whereas two seconds lets the removal settle
        and the notification then confirm it.
      */
      onMarked(one.session_id);
      pushToast({
        title: came.already ? "Already marked" : "Register marked",
        detail: `${came.event_name || "This gathering"} · ${clock(came.checked_in_at)}`,
        delay: 2000,
        life: 6000,
      });
      return;
    } catch (cause) {
      const where = !held && read.state === "refused" ? ` ${read.message}` : "";
      setResult({ kind: "bad", text: `${cause.message}${where}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p className="head">
        <span className="what">{who} is taking attendance</span>
        <span className="tag open">Open now</span>
      </p>
      <p className="who">
        Type the four digits the leader just read out to mark yourself present at{" "}
        {one.event_name || "the gathering"} — open {clock(one.started_at)} to{" "}
        {clock(one.ended_at)}, {reach(one)}.
      </p>

      <form className="ask" onSubmit={checkIn}>
        <label>
          PIN
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="····"
            value={pin}
            maxLength={4}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Checking…" : "Check in"}
        </button>
      </form>

      {result && <p className={`say${result.kind === "bad" ? " bad" : ""}`}>{result.text}</p>}
    </div>
  );
}

export default function SessionLive({ community_id }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!community_id) return undefined;
    let here = true;
    const listen = async () => {
      try {
        const next = await sessions.liveSessions({ community_id });
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

  // The server returns nothing when there's no live session — so this section vanishes entirely.
  if (!rows.length) return null;

  return (
    <section className="sl">
      <style>{css}</style>
      {rows.map((one) => (
        <Card
          key={one.session_id}
          one={one}
          community_id={community_id}
          onMarked={(session_id) => setRows((before) => before.filter((row) => row.session_id !== session_id))}
        />
      ))}
    </section>
  );
}
