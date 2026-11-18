import React, { useEffect, useState } from "react";
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
  walked in cold. Both hand off to the same check-in path — the moment Firebase reports a signed-in
  person and the join step has finished, the effect below does the arrival POST exactly once, so a
  first-timer ends up on the same "Attendance marked" screen as a member who has been coming for
  years.
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
.qr .hint{margin:8px 0 0;font-size:13px;color:#666}
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

  // Sign-up form state — name, surname and the community's 6-character join code, which the
  // leader shares with anyone walking in cold. The code is what proves they belong to a
  // fellowship; the QR itself proves nothing about membership.
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [joinCode, setJoinCode] = useState("");

  /*
    The auth listener fires the instant Firebase hands back a signed-in user, which during a
    sign-up is before the users row exists and before the join has run. Without this guard, the
    auto-check-in effect would POST a request for a person who is not yet a member and land them
    on "Not marked" with a confusing 403. The signup handler sets this true at the top and false
    once the users row and community join have both finished — only then does the effect on `who`
    fire the check-in.
  */
  const [pending, setPending] = useState(false);

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

  // Signed in, no signup sequence in flight, and every QR param is here: do the check-in exactly
  // once. Any further re-render is either the "working" or the "done" state and must not fire
  // another POST.
  useEffect(() => {
    if (!settled || !who || pending) return;
    if (state !== "idle") return;
    if (!params.pin || !params.community_id || !params.session_id) return;
    doCheckIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, who, pending, state, params]);

  async function signInWithPassword(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
      await signInWithPopup(auth, googleProvider);
    } catch (cause) {
      setLoginError(loginMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /*
    A first-timer walking up to the hall with no account. Three writes happen in a fixed order
    and the whole sequence has to finish before the check-in auto-fires: create the Firebase user,
    write their row in the users table (the same call /signup makes), then join them to the
    community using the 6-character code the leader gave them. A failure at step two or three
    leaves them signed in and returns them to the panel with a specific message — half-way is
    close enough that we should not discard their session as well.
  */
  async function signUpAndJoin(event) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    setPending(true);
    try {
      const created = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(created.user, { displayName: `${name} ${surname}`.trim() });
      // Firebase reports the new user immediately, which would otherwise fire the check-in effect
      // before the users row and community link exist. The pending flag above holds it off.
      await users.create({ email: created.user.email, name, surname });
      await callGod("community", { function: "join", join_id: joinCode });
      // On success, the caller stays signed in and pending=false lets the effect run the check-in.
      setPending(false);
    } catch (cause) {
      // A user row that already existed for this address, or a code that matched no community:
      // the person is signed in but not a member. Release the pending guard so the check-in
      // effect fires — the server will refuse it with a clear message rather than leave them
      // staring at a spinner — but show what went wrong on this side first.
      setPending(false);
      setLoginError(signupMessage(cause));
      // The user is signed in, so the panel below naturally swaps to the check-in flow. If the
      // join failed, force them back to the sign-in panel with the message so they can retry
      // the join from /community rather than loop here.
      setPanel("signin");
    } finally {
      setBusy(false);
    }
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
              Two minutes to set up. You will need the six-character join code for this
              fellowship — ask the leader who is taking attendance.
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
              <label className="label" htmlFor="qr-join-code">
                Join code
              </label>
              <input
                id="qr-join-code"
                className="field"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
              />
              <p className="hint">
                Six letters and numbers, e.g. <span className="serif">K3M9QT</span>. Only your
                leader has it.
              </p>
              <button
                type="submit"
                disabled={busy || !name || !surname || !email || password.length < 6 || joinCode.length < 4}
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
          <p className="lede">Preparing to mark you present…</p>
        )}

        {who && !missing && state === "working" && (
          <>
            <h1 className="serif">Marking you present…</h1>
            <p className="lede">
              Reading this device's location and matching the four digits against the open
              session.
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
