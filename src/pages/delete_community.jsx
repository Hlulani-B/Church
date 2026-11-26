import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import { adminState } from "../admin/state.js";

const dashboard = new AdminDashboardFetch();
const googleProvider = new GoogleAuthProvider();

const EMAIL_KEY = "kopano_email";

/*
  A second sign-in, asked for only by the screen that empties a community of its data.

  This is not a spare copy of /login. /login lets a held session walk straight through, because
  coming back to your own dashboard should not cost you a password; here a session in the browser
  is not the point — the point is proving, at the moment of an irreversible decision, that the
  person typing is the address that opened the fellowship. So nothing is skipped and nobody is
  carried through on a cookie.

  The address is checked against `community.created_by`, read from the server rather than from
  anything this browser remembers. When it does not match, the message says what went wrong without
  naming the address that was expected: whoever is refused here is by definition not the person it
  belongs to, and this app does not read other people's emails out loud.
*/
function friendlyError(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/wrong-password":
      return "Your email or password is incorrect.";
    // Email enumeration protection is on, so an unknown address and a wrong
    // password both arrive as invalid-credential.
    case "auth/invalid-credential":
      return "We could not find an account for that email, or the password is wrong.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google popup. Please allow popups and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.kpd{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#faf9f7;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6;display:flex;align-items:center;justify-content:center;padding:32px 20px}
.kpd *{box-sizing:border-box}
.kpd a{color:inherit}
.kpd .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.kpd .wrap{width:100%;max-width:520px}
.kpd .band{background:#111;color:#fff;padding:24px 28px}
.kpd .band .logo{font-size:18px;text-decoration:none;display:block;margin-bottom:12px}
.kpd .band h1{font-size:26px;line-height:1.25;margin:0}
.kpd .band h1 em{font-style:italic}
.kpd .band p{color:#bbb;font-size:14px;margin:10px 0 0}

.kpd .card{background:#fff;border:1px solid var(--line);border-top:0;padding:28px}
.kpd .who{font-size:14px;color:var(--muted);margin:0 0 22px}
.kpd .who b{color:var(--text)}
.kpd .field{margin-bottom:16px}
.kpd label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.kpd input[type="email"],.kpd input[type="password"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.kpd input:focus{outline:none;border-color:#111}

.kpd .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.kpd .btn.black{background:#111;color:#fff;border:1px solid #111}
.kpd .btn.outline{background:#fff;color:#111;border:1px solid #111}
.kpd .btn:disabled{opacity:.55;cursor:not-allowed}

.kpd .divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:13px;margin:22px 0}
.kpd .divider::before,.kpd .divider::after{content:"";flex:1;height:1px;background:var(--line)}
.kpd .error{background:#f4f4f4;border-left:3px solid #111;padding:10px 14px;font-size:14px;margin-bottom:16px}
.kpd .back{display:block;margin-top:22px;font-size:13px;color:var(--muted);text-align:center}
.kpd .back a{font-weight:600}
`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export default function DeleteCommunitySignInPage() {
  const navigate = useNavigate();
  const route = useLocation();
  const state = adminState(null, route.state);
  const notice = route.state?.notice || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function stop(text) {
    setError(text);
    setBusy(false);
  }

  /*
    Signed in, so now the only question that matters on this page: was this the address that opened
    the community? The row is read from the server, so an answer comes from the table and not from
    what this browser was last shown.
  */
  async function proceed(user) {
    localStorage.setItem(EMAIL_KEY, user.email);
    setError("");
    setBusy(true);
    let community;
    try {
      community = await dashboard.getCommunity(state.community_id);
    } catch (err) {
      stop(err.message || "We could not check who opened this community, so nothing was deleted.");
      return;
    }
    const founder = String(community?.created_by || "").trim().toLowerCase();
    if (!founder) {
      stop(
        "This community was opened before the app recorded who created it, so there is nothing to check your sign-in against and nothing can be deleted. Set created_by on the community row first.",
      );
      return;
    }
    if (founder !== String(user.email).trim().toLowerCase()) {
      stop("That address did not open this community, so it cannot delete all its data. Sign in as the person who opened it.");
      return;
    }
    navigate("/delete-community/confirm", {
      state: { community_id: state.community_id, name: community.name, email: user.email },
    });
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await proceed(result.user);
    } catch (err) {
      stop(friendlyError(err));
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await proceed(result.user);
    } catch (err) {
      stop(friendlyError(err));
    }
  }

  if (!state.community_id) {
    return (
      <div className="kpd">
        <style>{css}</style>
        <div className="wrap">
          <div className="band">
            <a className="logo serif" href="/community">Kopano</a>
            <h1 className="serif">No community <em>in hand</em></h1>
          </div>
          <div className="card">
            <p className="who">
              This screen empties one community of its data and nothing else, so it needs to know which
              one. Open the community from your list and reach it from the menu there.
            </p>
            <a className="btn black" href="/community">Go to my communities</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kpd">
      <style>{css}</style>
      <div className="wrap">
        <div className="band">
          <a className="logo serif" href="/community">Kopano</a>
          <h1 className="serif">Sign in again <em>to delete</em></h1>
          <p>
            Its functions, gatherings, attendance, servings, testimonies and every file attached to
            them are about to be removed. The community itself and its members stay. None of the rest
            can be undone.
          </p>
        </div>

        <div className="card">
          <p className="who">
            {state.name ? (
              <>Emptying <b>{state.name}</b> of its data. Only the person who opened this community may
              do it, so sign in with that address.</>
            ) : (
              <>Only the person who opened this community may delete its data, so sign in with that
              address.</>
            )}
          </p>

          {(error || notice) && <div className="error">{error || notice}</div>}

          <form onSubmit={handleEmailLogin}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn black" type="submit" disabled={busy}>Verify and continue</button>
          </form>

          <div className="divider">or</div>

          <button className="btn outline" type="button" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon /> Continue with Google
          </button>

          <p className="back">
            Changed your mind? <a href="/admin-dashboard">Back to the dashboard</a>
          </p>
        </div>
      </div>
    </div>
  );
}
