import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { SessionFetch } from "../page_functions/session.js";
import { adminState } from "../admin/state.js";
import Menu from "../components/menu.jsx";
import BackToCommunities from "../components/back.jsx";

const accounts = new Auth();
const sessions = new SessionFetch();

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


@media (max-width:860px){
  .ta .bar{padding:14px 20px}
  .ta .main{padding:40px 24px 72px}
  .ta h1{font-size:32px}
  .ta .pin .digits{font-size:36px}
  .ta .place .read{min-width:0;flex:1 1 100%}
}
`;

function clock(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Six places keeps the reading to about the width of one metre, which is nowhere near the
// accuracy a phone reports anyway, and a longer string is only more to read out or compare.
function fix(number) {
  return Number(number.toFixed(6));
}

// Why the device would not answer, in the words the person has to act on.
function refusal(cause) {
  if (cause?.code === 1) {
    return "This browser would not give leave to read where it is. Allow location for this page, then ask again.";
  }
  if (cause?.code === 2) {
    return "Nothing around this device could tell it where it is. Check that location is switched on, then ask again.";
  }
  if (cause?.code === 3) {
    return "That took too long to answer. Ask again — a moment outdoors, or beside a window, is usually enough.";
  }
  return "This device would not say where it is. Ask again before opening the session.";
}

const NO_PLACE = { state: "idle", latitude: null, longitude: null, accuracy: null, message: "" };

/*
  One reading of where this device stands, straight into the page's state. It is asked for on
  arrival because a leader opens a session in the room, standing where the room is; the numbers
  it comes back with are what the session row will carry, and what every later check-in is
  measured against. Nothing here is remembered between visits: a place held in storage would be
  a place claimed for a room the phone has since left.
*/
function readPosition(setPlace) {
  if (!("geolocation" in navigator)) {
    setPlace({
      ...NO_PLACE,
      state: "refused",
      message: "This browser cannot report a location at all, so no session can be opened from it.",
    });
    return;
  }
  setPlace({ ...NO_PLACE, state: "asking" });
  navigator.geolocation.getCurrentPosition(
    (found) =>
      setPlace({
        state: "held",
        latitude: fix(found.coords.latitude),
        longitude: fix(found.coords.longitude),
        accuracy: Math.round(found.coords.accuracy),
        message: "",
      }),
    (cause) => setPlace({ ...NO_PLACE, state: "refused", message: refusal(cause) }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

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
  const [started, setStarted] = useState("");
  const [ended, setEnded] = useState("");
  const [place, setPlace] = useState(NO_PLACE);
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
    What leaves this page is the PIN it was shown, the gathering's name, the two times, which
    community and the numbers the device reported. It is not asked who was there: /api/god takes
    the creator's own attendance from the token, and nobody else's from anywhere, so a room full
    of people is not entered by one leader's keyboard.
  */
  async function save(event) {
    event.preventDefault();
    if (!pin || !started || !ended) {
      setError("A PIN, a start and an end: the session needs all three.");
      return;
    }
    if (!name.trim()) {
      setError(
        "This session has to say which gathering it opens — that name is what every attendance row at it is filed under.",
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
      const row = await sessions.openSession({
        community_id: communityId,
        pin,
        event_name: name.trim(),
        started_at: started,
        ended_at: ended,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setOpen(row);
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
              <label htmlFor="session-name">Name</label>
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
              gathering called two things is two gatherings.
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

              {error && <div className="note bad">{error}</div>}
              {open && (
                <div className="note">
                  <strong>{open.event_name}</strong> is open for check-in on PIN{" "}
                  <strong>{open.pin}</strong> from {clock(open.started_at)} to{" "}
                  {clock(open.ended_at)}, recorded at {open.latitude}, {open.longitude}. You are
                  written down as attending it. Tell the room the PIN, and this page can go.
                </div>
              )}

              <div className="row">
                <button
                  className="btn"
                  type="submit"
                  disabled={busy || !pin || !name.trim() || place.state !== "held"}
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
