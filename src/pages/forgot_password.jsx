import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase.js";

function friendlyError(error) {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
      return "We could not find an account for that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a while.";
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
.au input[type="email"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.au input:focus{outline:none;border-color:#111}

.au .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.au .btn.black{background:#111;color:#fff;border:1px solid #111}
.au .btn.outline{background:#fff;color:#111;border:1px solid #111}
.au .btn:disabled{opacity:.55;cursor:not-allowed}
.au .btn + .btn{margin-top:12px}

.au .error{background:#f4f4f4;border-left:3px solid #111;padding:10px 14px;font-size:14px;margin-bottom:16px}
.au .switch{margin:24px 0 0;font-size:14px;color:var(--muted);text-align:center}
.au .switch a{color:var(--text);font-weight:600}

@media (max-width:860px){
  .au{grid-template-columns:1fr}
  .au .side{display:none}
  .au .mlogo{display:block}
}
`;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setEntered(email);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy(false);
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
            {sent ? (
              <>
                <h1 className="serif">Check your <em>inbox</em></h1>
                <p className="sub">
                  If an account exists for {entered}, a reset link is on its way. The link works once and expires
                  after an hour. If nothing arrives, check your spam folder or try again.
                </p>
                <a className="btn black" href="/login" style={{ textDecoration: "none" }}>Go to log in</a>
                <button className="btn outline" type="button" onClick={handleReset} disabled={busy}>
                  Send again
                </button>
              </>
            ) : (
              <>
                <h1 className="serif">Forgot your <em>password?</em></h1>
                <p className="sub">Enter your email and we will send you a link to choose a new password.</p>

                {error && <div className="error">{error}</div>}

                <form onSubmit={handleReset}>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <button className="btn black" type="submit" disabled={busy}>
                    {busy ? "Sending" : "Send reset link"}
                  </button>
                </form>

                <p className="switch">
                  Remembered it? <a href="/login">Log in</a> · New here? <a href="/signup">Create an account</a>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
