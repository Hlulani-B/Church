import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase.js";
import { Auth } from "../functions/auth.js";

const accounts = new Auth();
const googleProvider = new GoogleAuthProvider();

const EMAIL_KEY = "kopano_email";

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

.au{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .side{background:linear-gradient(135deg,#5a5a5a 0%,#2e2e2e 100%);color:#fff;padding:32px 48px;display:flex;flex-direction:column;justify-content:space-between}
.au .side .logo{font-size:22px;text-decoration:none}
.au .side h2{font-size:34px;line-height:1.25;margin:0 0 16px;max-width:360px}
.au .side h2 em{font-style:italic}
.au .side p{color:#ccc;max-width:340px;margin:0}
.au .wave{display:block;margin-top:28px;opacity:.85}

.au .main{display:flex;flex-direction:column;padding:32px 24px}
.au .mlogo{display:none;font-size:22px;text-decoration:none}
.au .formwrap{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 0}
.au .box{width:100%;max-width:400px}
.au h1{font-size:32px;line-height:1.2;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0 0 28px}

.au .field{margin-bottom:16px}
.au label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.au input[type="email"],.au input[type="password"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.au input:focus{outline:none;border-color:#111}

.au .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.au .btn.black{background:#111;color:#fff;border:1px solid #111}
.au .btn.outline{background:#fff;color:#111;border:1px solid #111}
.au .btn:disabled{opacity:.55;cursor:not-allowed}

.au .divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:13px;margin:22px 0}
.au .divider::before,.au .divider::after{content:"";flex:1;height:1px;background:var(--line)}
.au .error{background:#f4f4f4;border-left:3px solid #111;padding:10px 14px;font-size:14px;margin-bottom:16px}
.au .forgot{display:block;font-size:13px;margin:-4px 0 20px;color:var(--muted)}
.au .switch{margin:24px 0 0;font-size:14px;color:var(--muted);text-align:center}
.au .switch a{color:var(--text);font-weight:600}

@media (max-width:860px){
  .au{grid-template-columns:1fr}
  .au .side{display:none}
  .au .mlogo{display:block}
}
`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const notice = useLocation().state?.notice || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [suggestSignup, setSuggestSignup] = useState(false);
  const [busy, setBusy] = useState(false);

  // A held session means you are already inside: opening /login should not ask again.
  // Through Auth.onChange, so it waits for storage the same way every other page does.
  useEffect(() => {
    return accounts.onChange((user) => {
      if (user) navigate("/community", { replace: true });
    });
  }, [navigate]);

  function goHome() {
    navigate("/community");
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    setError("");
    setSuggestSignup(false);
    setBusy(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem(EMAIL_KEY, result.user.email);
      goHome();
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        navigate("/signup", {
          state: { notice: "We could not find an account for that email, so create one." },
        });
        return;
      }
      setSuggestSignup(err.code === "auth/invalid-credential");
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      localStorage.setItem(EMAIL_KEY, result.user.email);
      goHome();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="au">
      <style>{css}</style>

      <aside className="side">
        <a className="logo serif" href="/login">Kopano</a>
        <div>
          <h2 className="serif">
            Notice people <em>while they are still here.</em>
          </h2>
          <p>Mark your availability, check in on Sunday and share what God is doing in your life.</p>
          <svg className="wave" width="120" height="14" viewBox="0 0 120 14" fill="none" stroke="#fff" strokeWidth="1.2" aria-hidden="true">
            <path d="M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7" />
          </svg>
        </div>
        <span />
      </aside>

      <main className="main">
        <a className="mlogo serif" href="/login">Kopano</a>
        <div className="formwrap">
          <div className="box">
            <h1 className="serif">Welcome <em>back</em></h1>
            <p className="sub">Log in to mark your availability and share your testimony.</p>

            {(error || notice) && (
              <div className="error">
                {error || notice}
                {suggestSignup && (
                  <> Not signed up yet? <a href="/signup">Create an account</a></>
                )}
              </div>
            )}

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
              <a className="forgot" href="/forgot-password">Forgot password?</a>
              <button className="btn black" type="submit" disabled={busy}>Log in</button>
            </form>

            <div className="divider">or</div>

            <button className="btn outline" type="button" onClick={handleGoogle} disabled={busy}>
              <GoogleIcon /> Continue with Google
            </button>

            <p className="switch">
              New here? <a href="/signup">Create an account</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}