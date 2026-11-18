import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Menu from "../components/menu.jsx";
import { FeedbackFetch } from "../page_functions/feedback.js";

const feedback = new FeedbackFetch();

/*
  The one place in the app that talks about the product rather than about a fellowship. There
  is no community_id on the row and there is no per-community gate: any signed-in person can
  say what they think, and the address on the row is either the token's (if they ticked the
  box) or nobody's. Keeping it anonymous-by-default is on purpose — the person with the sharpest
  criticism is often the one least willing to attach their name to it, and the pile is not
  interesting without them.
*/
const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");
.fb{--ink:#111;--muted:#666;--line:#d4d4d4;min-height:100vh;background:#fff;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.fb *{box-sizing:border-box}
.fb .serif{font-family:"Playfair Display",Georgia,serif;font-weight:500}
.fb .bar{display:flex;align-items:center;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.fb .bar .logo{font-size:24px;text-decoration:none;color:var(--ink)}
.fb .main{max-width:640px;margin:0 auto;padding:56px 32px 96px}
.fb h1{font-size:38px;line-height:1.15;margin:0 0 12px}
.fb h1 em{font-style:italic}
.fb .lede{color:var(--muted);margin:0 0 32px;font-size:17px}
.fb h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:32px 0 10px;font-weight:600}
.fb .stars{display:flex;gap:6px}
.fb .stars button{background:#fff;border:1px solid var(--line);border-radius:2px;font-size:26px;line-height:1;padding:8px 12px;cursor:pointer;color:#bdbdbd;font-family:inherit}
.fb .stars button.on{border-color:#111;color:#111;background:#fafafa}
.fb .radio{display:flex;gap:12px;flex-wrap:wrap}
.fb .radio label{border:1px solid var(--line);border-radius:2px;padding:10px 16px;cursor:pointer;font-size:15px;background:#fff}
.fb .radio label.on{border-color:#111;background:#111;color:#fff}
.fb .radio input{position:absolute;opacity:0;pointer-events:none}
.fb textarea{width:100%;min-height:96px;font:inherit;font-size:15px;padding:12px 14px;border:1px solid var(--line);border-radius:2px;background:#fff;color:var(--ink);resize:vertical}
.fb textarea:focus{outline:none;border-color:#111}
.fb .check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--muted);margin:20px 0 0}
.fb .check input{margin-top:4px;accent-color:#111}
.fb .row{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap}
.fb .btn{background:#111;color:#fff;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.fb .btn.ghost{background:#fff;color:#111}
.fb .btn:disabled{opacity:.5;cursor:default}
.fb .err{background:#fbeaea;border-left:3px solid #a11111;color:#7a1010;padding:12px 16px;margin:20px 0 0;font-size:14px}
.fb .thanks{text-align:center;padding:80px 20px}
.fb .thanks .big{font-size:60px;line-height:1;color:#111;margin:0 0 12px}
`;

function Stars({ value, onChange, disabled }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Overall rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={n <= value ? "on" : ""}
          onClick={() => !disabled && onChange(n)}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function YesNo({ value, onChange, name, disabled }) {
  return (
    <div className="radio" role="radiogroup" aria-label={name}>
      <label className={value === true ? "on" : ""}>
        <input type="radio" name={name} checked={value === true} onChange={() => !disabled && onChange(true)} disabled={disabled} />
        Yes
      </label>
      <label className={value === false ? "on" : ""}>
        <input type="radio" name={name} checked={value === false} onChange={() => !disabled && onChange(false)} disabled={disabled} />
        No
      </label>
    </div>
  );
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [stars, setStars] = useState(0);
  const [solves, setSolves] = useState(null);
  const [improvements, setImprovements] = useState("");
  const [additions, setAdditions] = useState("");
  const [challenging, setChallenging] = useState("");
  const [includeEmail, setIncludeEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!stars) return setError("Choose a star rating first.");
    if (solves === null) return setError("Answer whether the app solves your problem.");
    setBusy(true);
    try {
      await feedback.submit({
        stars,
        solves_problem: solves,
        improvements,
        additions,
        most_challenging: challenging,
        include_email: includeEmail,
      });
      setDone(true);
    } catch (cause) {
      setError(cause.message || "Could not send your feedback. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="fb">
        <style>{css}</style>
        <header className="bar">
          <Link to="/community" className="logo serif">Kopano</Link>
          <Menu guideRole="feedback" />
        </header>
        <main className="main">
          <div className="thanks">
            <p className="big serif">✦</p>
            <h1 className="serif">Thank <em>you.</em></h1>
            <p className="lede">Your notes go straight to whoever runs this app. Nothing else happens automatically — no reply will follow unless you put your email on it.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => navigate(-1)}>Back</button>
              <Link to="/community" className="btn ghost">My communities</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fb">
      <style>{css}</style>
      <header className="bar">
        <Link to="/community" className="logo serif">Kopano</Link>
        <Menu guideRole="feedback" />
      </header>
      <main className="main">
        <h1 className="serif">How is <em>Kopano</em> going?</h1>
        <p className="lede">
          Five short questions. Nothing you write here shows up on a dashboard, and the row is
          anonymous unless you tick the box at the bottom.
        </p>

        <form onSubmit={submit}>
          <h3>Overall rating</h3>
          <Stars value={stars} onChange={setStars} disabled={busy} />

          <h3>Does it solve the problem you have?</h3>
          <YesNo value={solves} onChange={setSolves} name="solves" disabled={busy} />

          <h3>What would you improve?</h3>
          <textarea
            placeholder="Anything that feels clumsy, slow or confusing."
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            maxLength={4000}
            disabled={busy}
          />

          <h3>What is missing that you want?</h3>
          <textarea
            placeholder="A feature you have been waiting for."
            value={additions}
            onChange={(e) => setAdditions(e.target.value)}
            maxLength={4000}
            disabled={busy}
          />

          <h3>What has been most challenging?</h3>
          <textarea
            placeholder="A moment where you nearly gave up, if there was one."
            value={challenging}
            onChange={(e) => setChallenging(e.target.value)}
            maxLength={4000}
            disabled={busy}
          />

          <div className="check">
            <input
              id="fb-include-email"
              type="checkbox"
              checked={includeEmail}
              onChange={(e) => setIncludeEmail(e.target.checked)}
              disabled={busy}
            />
            <label htmlFor="fb-include-email">
              Include my email so a reply is possible. Left off, the row is anonymous.
            </label>
          </div>

          {error && <div className="err">{error}</div>}

          <div className="row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
            <Link to="/community" className="btn ghost">Cancel</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
