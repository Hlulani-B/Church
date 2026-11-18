import React, { useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../src/firebase.js";
import { Auth } from "../src/functions/auth.js";
import { callGod } from "../src/page_functions/god.js";
import { askPosition } from "../src/page_functions/place.js";
import { UserFetch } from "../src/page_functions/user.js";

const accounts = new Auth();
const users = new UserFetch();
const googleProvider = new GoogleAuthProvider();

/*
  The whole surface of the subapp. It is a lean mirror of the main app's editorial style — same
  Playfair heading, same black-filled button — but not a shared CSS file, so nothing on this page
  depends on the main SPA loading first. A phone that scans a QR at the door of a hall should see
  this in a fraction of a second, on any browser, without a stylesheet that isn't here.

  The page carries two panels: sign-in for the returning member, sign-up for the first-timer who
  walked in cold. Both hand off to the same path — once Firebase reports a signed-in person, the
  scan's four digits first get spent joining them to the fellowship if they are not in it yet, and
  only then does the arrival POST run, exactly once. Nobody on this page is asked for a join code:
  the proof that you belong is that you are standing in a room with a check-in open in front of it,
  which is the same proof the register itself accepts. A first-timer therefore lands on the same
  "Attendance marked" screen as a member who has been coming for years.
*/
const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;color:#111;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6;-webkit-text-size-adjust:100%}
.qr{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px;box-sizing:border-box}
.qr .panel{max-width:400px;width:100%}
.qr .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}
.qr .logo{font-size:22px;text-decoration:none;color:#111}
.qr h1{font-size:32px;line-height:1.2;margin:20px 0 8px}
.qr .lede{color:#666;margin:0 0 22px}
.qr .label{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600;margin:16px 0 6px}
.qr .field{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #bdbdbd;border-radius:2px;background:#fff;color:#111;box-sizing:border-box}
.qr .field:focus{outline:none;border-color:#111}
.qr .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.qr button{margin-top:18px;background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;width:100%;box-sizing:border-box}
.qr button.ghost{background:#fff;color:#111;border:1px solid #111;margin-top:10px}
.qr button.link{background:none;border:0;color:#111;text-decoration:underline;font-weight:400;font-size:14px;margin-top:14px;padding:6px 0;width:auto;display:block;margin-left:auto;margin-right:auto}
.qr button:disabled{opacity:.5;cursor:default}
.qr .err{color:#a11111;font-size:14px;margin:14px 0 0}
.qr .say{margin:22px 0 0;padding:14px 18px;border-left:3px solid #1f7a3f;background:#fafafa;font-size:15px}
.qr .say.bad{border-left-color:#a11111}
.qr .exit{margin-top:18px;font-size:14px;color:#666}
.qr .quiet{margin-top:14px;font-size:13px;color:#666;text-align:center}
.qr .note{margin:18px 0 0;padding:12px 14px;border-left:3px solid #111;background:#fafafa;font-size:13px;color:#444}
`;

// What the QR encodes in the URL: /qr?pin=…&session_id=…&community_id=…
function readParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    pin: q.get("pin") || "",
    session_id: q.get("session_id") || "",
    community_id: q.get("community_id") || "",
  };
}

function loginMessage(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Sign in with email and password below instead.";
    case "auth/wrong-password":
      return "Your email or password is incorrect.";
    case "auth/invalid-credential":
      return "We could not find an account for that email, or the password is wrong.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Your password must be at least 6 characters.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function Qr() {
  const [who, setWho] = useState(null);
  const [settled, setSettled] = useState(false);
  const [params] = useState(readParams);

  // Which panel the signed-out visitor sees: an existing member signing in, or a first-timer
  // creating an account inline so the check-in does not become a dead end at the door.
  const [panel, setPanel] = useState("signin");

  // Sign-in form state.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Sign-up form state. Name and surname are all it asks: the fellowship this person is being
  // added to comes out of the scan, from the session the four digits name, and never from a box.
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");

  /*
    The auth listener fires the instant Firebase hands back a signed-in user, which during a
    sign-up is before the users row exists and before the join has run. Without this guard, the
    auto-check-in effect would POST a request for a person who is not yet a member and land them
    on "Not marked" with a confusing 403. The signup handler sets this true at the top and false
    once the users row and community join have both finished — only then does the effect on `who`
    fire the check-in.
  */
  const [pending, setPending] = useState(false);

  /*
    One scan, one arrival — guarded by a ref rather than by `state` alone, because a handler and
    the effect above can otherwise reach `doCheckIn` in the same second: sign-up runs its own
    sequence while the listener has already reported the new person, and a pending flag that
    commits before the check-in starts would let the effect walk in beside it. A ref is set the
    moment the door is used and cannot be re-read as false by a render that has not happened yet.
  */
  const entered = useRef(false);

  // Check-in flow: "idle" (nothing yet) → "working" (asking location + POSTing) → "done".
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null); // {kind:'ok'|'bad', text}

  // The one source of truth for whether the browser already holds a Kopano session. Firebase
  // storage settles once, then this listener fires on every real change of person.
  useEffect(
    () =>
      accounts.onChange((account) => {
        setWho(account);
        setSettled(true);
      }),
    [],
  );

  /*
    Signed in, and every QR param is here. Reaching this is the one rule the whole page is built
    around: a person never checks in before the membership has been settled, because the register
    answers a non-member with a 403 and would send a first-timer to "Not marked" for a step nobody
    asked them to take. So the effect waits on `pending` — raised by every path that writes to the
    database below — and each handler calls `enter()` itself the moment its own work is done.
    `entered` is then what keeps the whole page to one arrival per scan, whoever reaches it first.
  */
  useEffect(() => {
    if (!settled || !who || pending) return;
    if (state !== "idle") return;
    if (!params.pin || !params.community_id || !params.session_id) return;
    enter(who.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, who, pending, state, params]);

  async function signInWithPassword(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const done = await signInWithEmailAndPassword(auth, email, password);
      await enter(done.user?.email);
    } catch (cause) {
      setLoginError(loginMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setLoginError("");
    try {
      const done = await signInWithPopup(auth, googleProvider);
      await enter(done.user?.email);
    } catch (cause) {
      setLoginError(loginMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /*
    What a scan bought, as far as the database is concerned. The four digits are matched against a
    check-in that is open right now and the community off that row is where this person is added —
    no code, because a stranger at the door has nothing to type and the room they are standing in
    is the better proof anyway. /api/self works out all of it; this passes on what the picture
    carried and nothing else.

    A member coming back through the same door is refused by that endpoint as "already in", and
    that answer is a success here: they are where they need to be, and the check-in that follows
    will say so. Anything else is worth their attention, so it is reported and the arrival is
    attempted anyway — a phone that cannot reach the server would show the same message twice,
    which is quieter than a page that seems to hang.

    No address is sent. The endpoint reads it off this browser's own id token, which is what makes
    it "this phone is being held by somebody who belongs here" rather than a way to enrol anyone.
  */
  async function ensureMembership() {
    try {
      await callGod("community", {
        function: "join_at_session",
        community_id: params.community_id,
        session_id: params.session_id,
        pin: params.pin,
      });
    } catch (cause) {
      if (String(cause?.message || '').toLowerCase().includes('already in')) return;
      setLoginError(cause?.message || "You could not be added to this fellowship.");
    }
  }

  // The single way onto the arrival: membership first, then the check-in, with `pending` held up
  // across both so the effect cannot slip between them. Claimed once, and only once, per scan.
  // `email` is the address the scan was made under, and it is only a signal here: no address, no
  // membership step, which is how a browser whose listener has not reported one yet stays honest.
  async function enter(email) {
    if (entered.current) return;
    entered.current = true;
    setPending(true);
    try {
      if (email) await ensureMembership();
      await doCheckIn();
    } finally {
      setPending(false);
    }
  }

  /*
    A first-timer walking up to the hall with no account. Two writes happen here in a fixed order
    — create the Firebase user, then their row in the `users` table, the same call /signup makes —
    and both have to finish before `enter()` spends the scan on the membership and the arrival. A
    failure leaves them signed in and back on a panel with a specific message: half-way is close
    enough that we should not discard their session as well.
  */
  async function signUpAndJoin(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    setPending(true);
    let created = null;
    try {
      created = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(created.user, { displayName: `${name} ${surname}`.trim() });
      // Firebase reports the new user immediately, which would otherwise fire the check-in effect
      // before the users row and community link exist. The pending flag above holds it off.
      await users.create({ email: created.user.email, name, surname });
      setPending(false);
    } catch (cause) {
      // The account exists and the person is signed in even though a step failed, so releasing the
      // guard here lets the arrival run and answer honestly instead of leaving them staring at a
      // spinner. Whatever went wrong is shown on this panel first.
      setPending(false);
      setLoginError(signupMessage(cause));
      // They are signed in, so the page would otherwise swap to the check-in flow on its own.
      // Putting them back on the sign-in panel keeps the message where they can act on it — a
      // duplicated address, say, which is solved by signing in rather than by trying again.
      setPanel("signin");
    } finally {
      setBusy(false);
    }
    // Only an account that this form actually opened gets the membership step. A password Firebase
    // refused or an address already in use belongs to somebody who may not be here at all, and
    // spending this scan on it would add a stranger to the fellowship.
    if (created) await enter(created.user.email);
  }

  function signupMessage(error) {
    const base = loginMessage(error);
    if (base && base !== "Something went wrong. Please try again.") return base;
    // callGod throws plain Errors with the server's message text; a failed join reads as that.
    return error?.message || "Could not create your account. Please try again.";
  }

  async function doCheckIn() {
    setState("working");
    setResult(null);
    // The reading is asked for the instant the page decides to check in — never remembered, so
    // a place held from an earlier scan cannot claim this room.
    const read = await askPosition();
    const held = read.state === "held";
    try {
      const came = await callGod("event", {
        function: "checkin",
        community_id: params.community_id,
        session_id: params.session_id,
        pin: params.pin,
        latitude: held ? read.latitude : null,
        longitude: held ? read.longitude : null,
      });
      setResult({
        kind: "ok",
        text: came.already
          ? "The register already had you at this gathering — that arrival stands."
          : "You have been marked present.",
      });
    } catch (cause) {
      // A phone that would not give its place still gets its own reason appended after the
      // server's, so a refusal inside a WebView reads as one sentence, not two.
      const where = !held && read.state === "refused" ? ` ${read.message}` : "";
      setResult({ kind: "bad", text: `${cause.message}${where}` });
    } finally {
      setState("done");
    }
  }

  const missing = !params.pin || !params.community_id || !params.session_id;

  return (
    <div className="qr">
      <style>{css}</style>
      <div className="panel">
        <a className="logo serif" href="/">Kopano</a>

        {!settled && <p className="lede">Checking your sign-in…</p>}

        {settled && who === null && !missing && panel === "signin" && (
          <>
            <h1 className="serif">Sign in to mark yourself present</h1>
            <p className="lede">
              This opens the check-in for one gathering. Use the same details you use in the
              Kopano app — nothing new is created here.
            </p>
            <form onSubmit={signInWithPassword}>
              <label className="label" htmlFor="qr-email">
                Email
              </label>
              <input
                id="qr-email"
                className="field"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label className="label" htmlFor="qr-password">
                Password
              </label>
              <input
                id="qr-password"
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="submit" disabled={busy || !email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <button className="ghost" type="button" onClick={signInWithGoogle} disabled={busy}>
              Continue with Google
            </button>
            {/* Sign-in used to be the plain path and the join code the awkward one. Now one scan
                settles both, so a member who was ever removed from this fellowship walks back in
                through the same door as everybody else instead of hunting for a code. */}
            <p className="note">
              This scan also puts you back on the community's register if you are not on it any
              more — no join code needed.
            </p>
            {loginError && <p className="err">{loginError}</p>}
            <button
              className="link"
              type="button"
              onClick={() => {
                setPanel("signup");
                setLoginError("");
              }}
            >
              New here? Create an account
            </button>
          </>
        )}

        {settled && who === null && !missing && panel === "signup" && (
          <>
            <h1 className="serif">Join us and mark yourself present</h1>
            <p className="lede">
              Two minutes, and nothing to ask anyone for. The code you just scanned is what signs
              you in to this fellowship — a name, a surname, and a password are all that is left.
            </p>
            <form onSubmit={signUpAndJoin}>
              <div className="row2">
                <div>
                  <label className="label" htmlFor="qr-name">
                    Name
                  </label>
                  <input
                    id="qr-name"
                    className="field"
                    type="text"
                    autoComplete="given-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="qr-surname">
                    Surname
                  </label>
                  <input
                    id="qr-surname"
                    className="field"
                    type="text"
                    autoComplete="family-name"
                    value={surname}
                    onChange={(event) => setSurname(event.target.value)}
                  />
                </div>
              </div>
              <label className="label" htmlFor="qr-signup-email">
                Email
              </label>
              <input
                id="qr-signup-email"
                className="field"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label className="label" htmlFor="qr-signup-password">
                Password
              </label>
              <input
                id="qr-signup-password"
                className="field"
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {/* Deliberately not a box any more. Asking a stranger at the door for a code the
                  leader keeps on another screen was the part of this flow that could actually
                  stall, and the scan already proves more: those four digits only answer while
                  the gathering's check-in is open. */}
              <p className="note">
                Your account will be added to this fellowship as a member, and you will be marked
                present — both from the code you scanned, so there is nothing else to type.
              </p>
              <button
                type="submit"
                disabled={busy || !name || !surname || !email || password.length < 6}
              >
                {busy ? "Creating your account…" : "Create account and check in"}
              </button>
            </form>
            {loginError && <p className="err">{loginError}</p>}
            <button
              className="link"
              type="button"
              onClick={() => {
                setPanel("signin");
                setLoginError("");
              }}
            >
              Already have an account? Sign in
            </button>
          </>
        )}

        {settled && who === null && missing && (
          <>
            <h1 className="serif">This code is incomplete</h1>
            <p className="lede">
              The link did not carry the pin, session and community this page needs. Ask the
              leader to show the QR code again.
            </p>
            <p className="exit">You can close this page now.</p>
          </>
        )}

        {who && missing && (
          <>
            <h1 className="serif">This code is incomplete</h1>
            <p className="lede">
              The link did not carry the pin, session and community this page needs. Ask the
              leader to show the QR code again.
            </p>
            <p className="exit">You can close this page now.</p>
          </>
        )}

        {who && !missing && state === "idle" && (
          <p className="lede">Checking that you are on this fellowship's register…</p>
        )}

        {who && !missing && state === "working" && (
          <>
            <h1 className="serif">Marking you present…</h1>
            <p className="lede">
              Adding you to the fellowship if this scan has not already done so, reading this
              device's location, and matching the four digits against the open session.
            </p>
          </>
        )}

        {who && !missing && state === "done" && result && (
          <>
            <h1 className="serif">{result.kind === "ok" ? "Attendance marked" : "Not marked"}</h1>
            <p className={`say${result.kind === "bad" ? " bad" : ""}`}>{result.text}</p>
            <p className="exit">You can close this page now.</p>
          </>
        )}

        <p className="quiet">
          <a href="/login">Open the full Kopano app instead</a>
        </p>
      </div>
    </div>
  );
}
