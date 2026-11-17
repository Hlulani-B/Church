import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { SessionFetch } from "../page_functions/session.js";
import { NO_PLACE, clock, readPosition } from "../page_functions/place.js";
import { adminState } from "../admin/state.js";
import Menu from "../components/menu.jsx";
import BackToCommunities from "../components/back.jsx";

const accounts = new Auth();
const sessions = new SessionFetch();

/*
  The window boxes want the browser's own wall clock (a datetime-local value carries no zone), and a
  leader opening attendance for the gathering happening around them wants that window to be NOW. So
  the boxes start at this instant and one hour on rather than sitting empty: the common case becomes a
  session that is open the second it is saved, showing the PIN box to the whole room, not a future one.
*/
function localInput(date) {
  const pad = (one) => String(one).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#000;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.ta{--line:rgba(255,255,255,.24);--muted:#a8a8a8;min-height:100vh;background:#000;color:#fff;color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.ta.loading{display:block}
.ta *{box-sizing:border-box}
.ta a{color:inherit}
.ta .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.ta .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.ta .bar .logo{font-size:24px;text-decoration:none}
.ta .menuwrap{display:flex;align-items:center;position:relative}

.ta .main{padding:64px 56px 96px;max-width:760px;width:100%;margin:0 auto}
.ta .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.ta h1{font-size:40px;line-height:1.15;margin:0 0 12px}
.ta h1 em{text-transform:none;font-style:italic}
.ta .sub{color:var(--muted);margin:0;font-size:17px;max-width:560px}

.ta h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 12px;font-weight:600}

/* The PIN is the one thing in the room everybody has to hear, so it is the biggest thing here. */
.ta .pin{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.ta .pin .digits{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:48px;letter-spacing:.22em;min-width:5ch;text-align:center;border:1px solid var(--line);border-radius:2px;padding:10px 18px;background:#0d0d0d}
.ta .pin .digits.empty{color:#4a4a4a}

.ta label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 6px}
.ta .times{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.ta input{width:100%;background:#0d0d0d;color:#fff;border:1px solid var(--line);border-radius:2px;padding:12px 14px;font-size:16px;font-family:inherit}
.ta input:focus{outline:2px solid #fff;outline-offset:1px}
.ta .field{max-width:420px}

.ta .btn{background:#fff;color:#111;border:0;border-radius:2px;padding:12px 24px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.ta .btn.ghostly{background:transparent;color:#fff;border:1px solid var(--line)}
.ta .btn.ghostly:hover{border-color:#fff}
.ta .btn:disabled{opacity:.45;cursor:default}
.ta .row{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}

.ta .note{background:#141414;border-left:3px solid #fff;padding:12px 16px;font-size:14px;margin:26px 0 0}
.ta .note.bad{border-left-color:#ff6b6b}

/* The reading is shown as the numbers themselves, so a leader can see what the room will be
   measured against rather than being told that somewhere was found. */
.ta .place{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.ta .place .read{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;border:1px solid var(--line);border-radius:2px;padding:11px 14px;background:#0d0d0d;min-width:280px}
.ta .place .read.waiting{color:var(--muted)}
.ta .fine{font-size:13px;color:var(--muted);margin:14px 0 0;max-width:560px}

.ta .near{display:flex;align-items:flex-end;gap:26px;flex-wrap:wrap}
.ta .near .field{max-width:190px;margin:0}
.ta .field.dim{opacity:.45}
/* The checkbox is a sentence, not a column heading, so it opts out of the labels above it and
   of the full-width box every other input on this page is given. */
.ta .check{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:14px;font-weight:400;letter-spacing:normal;text-transform:none;color:#fff;cursor:pointer}
.ta .check input{width:auto;margin:0;accent-color:#fff}


@media (max-width:860px){
  .ta .bar{padding:14px 20px}
  .ta .main{padding:40px 24px 72px}
  .ta h1{font-size:32px}
  .ta .pin .digits{font-size:36px}
  .ta .place .read{min-width:0;flex:1 1 100%}
}
`;

export default function TakeAttendancePage() {
  /*
    Which community this session is opened for. The dashboard handed the three over, and
    src/admin/state.js fills in what the link did not carry, so a reload of this page is still
    about the same community rather than an empty form.
  */
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [started, setStarted] = useState(() => localInput(new Date()));
  const [ended, setEnded] = useState(() => localInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [place, setPlace] = useState(NO_PLACE);
  /*
    How near the room a check-in has to come from, in metres, and whether that question is asked
    at all. The number answers a question only somebody standing at the front can see: how well
    the signal behaves in this particular building. Ignoring it is for a gathering that meets in
    more than one place at once, and it leaves the four digits as the only thing between a
    stranger and a present mark — which is why the box says that out loud rather than leaving the
    default generous.
  */
  const [radius, setRadius] = useState("150");
  const [anywhere, setAnywhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  // Ask where we are as soon as the page opens: it is the one reading that cannot be typed in.
  useEffect(() => {
    readPosition(setPlace);
  }, []);

  async function drawPin() {
    setBusy(true);
    setError("");
    setOpen(null);
    try {
      setPin(await sessions.generatePin(communityId));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  /*
    What leaves this page is the PIN it was shown, the gathering's name, the two times, how near
    the room a check-in will be taken from, which community and the numbers the device reported.
    It is not asked who was there: /api/leader takes the creator's own attendance from the token, and
    nobody else's from anywhere, so a room full of people is not entered by one leader's keyboard.
  */
  async function save(event) {
    event.preventDefault();
    if (!pin || !started || !ended) {
      setError("A PIN, a start and an end: the session needs all three.");
      return;
    }
    // A blank would be stored as no limit at all, which is not what an empty box means.
    const metres = Number(radius)
    if (!anywhere && !(Number.isFinite(metres) && metres > 0)) {
      setError(
        "Say how near the room a check-in has to come from, in metres — or allow check-in from anywhere, if this gathering meets in more than one place.",
      );
      return;
    }
    if (place.state !== "held") {
      setError(
        place.message ||
          "The position of this room has to be read before a session can be opened for it.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sessions.openSession({
        community_id: communityId,
        pin,
        event_name: name.trim(),
        // A datetime-local box carries no zone, so "19:03" means half past seven *here* — the
        // browser is the only party that knows which here. Hand over the true UTC instant (which
        // this device's clock resolves) and the leader's own calendar day, so the session is open
        // when the leader meant it, not six hours adrift by the server's UTC assumption.
        date: started.slice(0, 10),
        started_at: new Date(started).toISOString(),
        ended_at: new Date(ended).toISOString(),
        latitude: place.latitude,
        longitude: place.longitude,
        radius: radius.trim() === "" ? null : metres,
        allow_any_radius: anywhere,
      });
      /*
        The session is open, so this page has done its one job and leaves. Back on the dashboard the
        room is watched from here on: it listens for the check-in just opened, shows its PIN to be
        read out, and lets it be cancelled or its radius changed. Going back — rather than parking
        a confirmation here — returns whoever opened it to the page that keeps listening.
      */
      navigate(-1);
      return;
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="ta loading">
        <style>{css}</style>
        <div className="main">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing to open.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ta">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">{admin.name || "Take attendance"}</p>
        <h1 className="serif">Take <em>attendance.</em></h1>
        <p className="sub">
          Open a check-in session for one gathering: its name, the four-digit PIN the room is
          told, the window it holds between, and where this device is standing. You are recorded
          as present at it, like anyone else in the room — nobody else is marked by this page,
          and the rest of the register is written by the check-ins that follow.
        </p>

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to open a session for. Go back, click a
            community, and take its attendance.
          </div>
        ) : (
          <>
            <h3>1 · The PIN</h3>
            <div className="pin">
              <span className={pin ? "digits" : "digits empty"} aria-live="polite">
                {pin || "····"}
              </span>
              <button className="btn ghostly" type="button" onClick={drawPin} disabled={busy}>
                {pin ? "Draw another" : "Generate PIN"}
              </button>
            </div>

            <h3>2 · The gathering</h3>
            <div className="field">
              <label htmlFor="session-name">Name (optional)</label>
              <input
                id="session-name"
                type="text"
                value={name}
                placeholder="Sunday Fellowship"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <p className="fine">
              This is the name the attendance of that day is filed under, yours included, so a
              gathering called two things is two gatherings. It is optional — leave it blank and
              the day is filed under “Gathering”.
            </p>

            <h3>3 · The window</h3>
            <form onSubmit={save}>
              <div className="times">
                <div>
                  <label htmlFor="session-start">Starts</label>
                  <input
                    id="session-start"
                    type="datetime-local"
                    value={started}
                    onChange={(event) => setStarted(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="session-end">Ends</label>
                  <input
                    id="session-end"
                    type="datetime-local"
                    value={ended}
                    onChange={(event) => setEnded(event.target.value)}
                    required
                  />
                </div>
              </div>

              <h3>4 · Where this room is</h3>
              <div className="place">
                <span className={place.state === "held" ? "read" : "read waiting"} aria-live="polite">
                  {place.state === "held"
                    ? `${place.latitude}, ${place.longitude} ±${place.accuracy} m`
                    : place.state === "asking"
                      ? "Asking this device where it is…"
                      : place.message || "No position read yet"}
                </span>
                <button
                  className="btn ghostly"
                  type="button"
                  onClick={() => readPosition(setPlace)}
                  disabled={place.state === "asking"}
                >
                  {place.state === "held" ? "Read again" : "Read my position"}
                </button>
              </div>
              <p className="fine">
                These two numbers travel with the session and are what a check-in is later
                measured against — entering a PIN from somewhere else is exactly the thing they
                exist to refuse. Nothing here is typed by hand, and nothing is kept once this page
                closes.
              </p>

              <h3>5 · How near the room</h3>
              <div className="near">
                <div className={anywhere ? "field dim" : "field"}>
                  <label htmlFor="session-radius">Check-ins within</label>
                  <input
                    id="session-radius"
                    type="number"
                    min="1"
                    max="20000"
                    step="10"
                    value={radius}
                    onChange={(event) => setRadius(event.target.value)}
                    disabled={anywhere}
                  />
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={anywhere}
                    onChange={(event) => setAnywhere(event.target.checked)}
                  />
                  Allow check-in from anywhere
                </label>
              </div>
              <p className="fine">
                {anywhere
                  ? "Distance is not asked about, so these four digits alone mark anybody present — whoever was told them, in this town or another, is written down as having come. That is right for a gathering meeting in more than one place at once, and for little else."
                  : "A phone further from this point than the number above is refused, which is the whole answer to a PIN texted to somebody who stayed home. A reading is only as good as the sky a phone can see, so a hall that turns away people standing in it is a hall that wants a larger number here."}
              </p>

              {error && <div className="note bad">{error}</div>}
              {open && (
                <div className="note">
                  <strong>{open.event_name}</strong> is open for check-in on PIN{" "}
                  <strong>{open.pin}</strong> from {clock(open.started_at)} to{" "}
                  {clock(open.ended_at)}, taken from within{" "}
                  {open.allow_any_radius ? "any distance at all" : `${open.radius} m of this point`}.
                  You are written down as attending it. Tell the room the PIN, and this page can go.
                </div>
              )}

              <div className="row">
                <button
                  className="btn"
                  type="submit"
                  disabled={busy || !pin || place.state !== "held"}
                >
                  {busy ? "Opening…" : "Open session"}
                </button>
                <button
                  className="btn ghostly"
                  type="button"
                  onClick={() => navigate("/community")}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}

      </main>
    </div>
  );
}
