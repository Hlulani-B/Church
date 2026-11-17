import React, { useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "../src/firebase.js";
import { Auth } from "../src/functions/auth.js";
import { callGod } from "../src/page_functions/god.js";
import { askPosition } from "../src/page_functions/place.js";

const accounts = new Auth();
const googleProvider = new GoogleAuthProvider();

/*
  The whole surface of the subapp. It is a lean mirror of the main app's editorial style — same
  Playfair heading, same black-filled button — but not a shared CSS file, so nothing on this page
  depends on the main SPA loading first. A phone that scans a QR at the door of a hall should see
  this in a fraction of a second, on any browser, without a stylesheet that isn't here.
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
.qr button{margin-top:18px;background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;width:100%;box-sizing:border-box}
.qr button.ghost{background:#fff;color:#111;border:1px solid #111;margin-top:10px}
.qr button:disabled{opacity:.5;cursor:default}
.qr .err{color:#a11111;font-size:14px;margin:14px 0 0}
.qr .say{margin:22px 0 0;padding:14px 18px;border-left:3px solid #1f7a3f;background:#fafafa;font-size:15px}
.qr .say.bad{border-left-color:#a11111}
.qr .exit{margin-top:18px;font-size:14px;color:#666}
.qr .quiet{margin-top:14px;font-size:13px;color:#666;text-align:center}
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
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function Qr() {
  const [who, setWho] = useState(null);
  const [settled, setSettled] = useState(false);
  const [params] = useState(readParams);

  // Sign-in form state.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

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

  // Signed in and every QR param is here: do the check-in exactly once. Any further re-render
  // is either the "working" or the "done" state and must not fire another POST.
  useEffect(() => {
    if (!settled || !who) return;
    if (state !== "idle") return;
    if (!params.pin || !params.community_id || !params.session_id) return;
    doCheckIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, who, state, params]);

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

        {settled && who === null && !missing && (
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
