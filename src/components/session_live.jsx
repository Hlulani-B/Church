import React, { useEffect, useState } from "react";
import { SessionFetch } from "../page_functions/session.js";
import { clock, askPosition } from "../page_functions/place.js";

const sessions = new SessionFetch();

/*
  How often a member's dashboard asks the community whether anything is happening. It matches the
  leader's control on purpose: a leader opens a session in front of a crowd, and the gap between
  that and every other phone hearing about it is what this buys. Fifteen seconds is one quiet
  request per open dashboard, and shorter than the time it takes to read four digits out loud.
*/
const LISTEN_EVERY = 15000;

// A day and a time together, so a session scheduled for later still says which day it is.
function day(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// How near the room a check-in has to come from, said the way the opener chose it.
function reach(one) {
  return one.allow_any_radius || !one.near_required
    ? "from anywhere"
    : `within ${one.radius} m`;
}

/*
  The notice every member of a fellowship sees.

  This is the answer to "attendance is being taken, and nobody told me". The check-in box below it
  only appears while a window is actually open, so a member who walks in early — or a leader who
  scheduled the gathering for later in the day — had no way to know anything was coming. This box
  reads the community's live sessions, open and scheduled together, and says so out loud to every
  phone in the fellowship, not only the ones already staring at a PIN field.

  It is a poll and not a push, because that is what this app has: no message service is wired up,
  so the notice a whole community gets is this card appearing the next time their dashboard asks.

  Everything it shows is the member-safe read. It carries no PIN and no controls — the four digits
  still only reach the room when the leader reads them out, and the leader's own control is the one
  place a session can be cancelled or its radius moved. A plain member sees what is happening and
  when; the check-in box is where they act on it.
*/
const css = `
.sl{display:flex;flex-direction:column;gap:12px;margin:34px 0 0}
.sl .card{border:1px solid #e3e3e3;border-left:4px solid #111;border-radius:2px;padding:14px 18px;background:#fafafa}
.sl .card.soon{border-left-color:#bdbdbd}
.sl .head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0}
.sl .head .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:600;margin:0}
.sl .tag{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;padding:2px 10px;border:1px solid #111;border-radius:999px}
.sl .tag.open{background:#111;color:#fff}
.sl .tag.upcoming{color:#666;border-color:#bdbdbd}
.sl .who{font-size:14px;color:#666;margin:8px 0 0}
.sl .ask{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:14px 0 0}
.sl .ask label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.sl .ask input{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;letter-spacing:.18em;text-indent:.18em;text-align:center;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:7px 10px;width:9ch}
.sl .ask input:focus{outline:none;border-color:#111}
.sl .ask button{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.sl .ask button:disabled{opacity:.5;cursor:default}
.sl .say{font-size:14px;margin:12px 0 0;border-left:3px solid #111;padding:8px 12px;background:#fff}
.sl .say.bad{border-left-color:#a11111}
.sl .say.ok{border-left-color:#1f7a3f}
`;

/*
  The PIN box lives inside the alert now: the very notice that says "X is taking attendance" is where
  the four digits are typed, rather than a pointer to a separate box further down. Those digits go to
  /api/self, which matches them against the session row and the server's own clock — nothing on this
  page decides whether a check-in is true — and the device's position is asked for the instant Check
  in is pressed, and only matters when the gathering was opened with a distance on it.
*/
function Card({ one, community_id }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  // The one line this box answers with: present, already present, or the reason it was refused.
  const [result, setResult] = useState(null);
  // Who is taking attendance, said by name when the server could resolve it and plainly otherwise.
  const who = one.leader_name || "A leader";

  async function checkIn(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setResult({ kind: "bad", text: "Four digits, as the leader read them out." });
      return;
    }
    setBusy(true);
    setResult(null);
    // Asked as it is pressed and never remembered: a place held from an hour ago is a claim about a
    // room this phone has since left.
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
          ? `You were already written down at ${came.event_name}, at ${clock(
              came.checked_in_at,
            )} — that arrival stands.`
          : `You are present at ${came.event_name}, checked in at ${clock(came.checked_in_at)}.`,
      });
      setPin("");
    } catch (cause) {
      // A phone that would not give its place gets its own reason too, not just the server's.
      const where = !held && read.state === "refused" ? ` ${read.message}` : "";
      setResult({ kind: "bad", text: `${cause.message}${where}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card${one.live ? "" : " soon"}`}>
      <p className="head">
        <span className="what">
          {one.live ? `${who} is taking attendance` : one.event_name || "A gathering"}
        </span>
        <span className={`tag ${one.live ? "open" : "upcoming"}`}>
          {one.live ? "Open now" : "Scheduled"}
        </span>
      </p>
      <p className="who">
        {one.live
          ? `Type the four digits the leader just read out to mark yourself present at ${
              one.event_name || "the gathering"
            } — open ${clock(one.started_at)} to ${clock(one.ended_at)}, ${reach(one)}.`
          : `Scheduled for ${day(one.started_at)}, ${clock(one.started_at)} to ${clock(one.ended_at)} \u2014 type the PIN whenever the leader reads it out; the server accepts it while the window is open.`}
      </p>

      {/* The PIN entry is always here — the leader reads digits at any moment and the room needs
          somewhere to type them immediately. Whether a check-in stands is the server's call; if the
          window hasn't opened yet the server refuses clearly and that refusal shows inline below. */}
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

      {result && <p className={`say ${result.kind}`}>{result.text}</p>}
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

  // Nothing live and nothing scheduled: there is nothing for this box to say.
  if (!rows.length) return null;

  // Whatever is taking arrivals now leads, then the soonest of what is still to come.
  const ordered = [...rows].sort((a, b) => {
    if (!!b.live !== !!a.live) return (b.live ? 1 : 0) - (a.live ? 1 : 0);
    return new Date(a.started_at) - new Date(b.started_at);
  });

  return (
    <section className="sl">
      <style>{css}</style>
      {ordered.map((one) => (
        <Card key={one.session_id} one={one} community_id={community_id} />
      ))}
    </section>
  );
}
