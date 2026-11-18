import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Menu from "../components/menu.jsx";
import { FeedbackFetch } from "../page_functions/feedback.js";

const feedback = new FeedbackFetch();

/*
  The one place in the app that talks about the product rather than about a fellowship. There
  is no community_id on the row and there is no per-community gate: any signed-in person can say
  what they think, and the row they leave carries the address on their own ID token.

  That is not a choice the form offers any more, so the page says it out loud above the boxes.
  What a person can still control is how much of themselves goes in the text — and what nobody
  sees on this page is the address itself, which is stored and exported but never printed.
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
.fb .sign{font-size:14px;color:var(--muted);margin:24px 0 0;padding:12px 14px;border-left:3px solid var(--ink);background:#fafafa}
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
          <Menu guideRole="feedback" items={[{ label: "See everyone's notes", to: "/feedback/all" }]} />
        </header>
        <main className="main">
          <div className="thanks">
            <p className="big serif">✦</p>
            <h1 className="serif">Thank <em>you.</em></h1>
            <p className="lede">Your notes go straight to whoever runs this app, and into the pile everybody here can read. Nothing else happens automatically — your address is stored with the note but never shown beside it.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => navigate(-1)}>Back</button>
              <Link to="/feedback/all" className="btn ghost">See what others have said</Link>
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
        <Menu guideRole="feedback" items={[{ label: "See everyone's notes", to: "/feedback/all" }]} />
      </header>
      <main className="main">
        <h1 className="serif">How is <em>Kopano</em> going?</h1>
        <p className="lede">
          Five short questions. Nothing here appears on a community's dashboard. Everybody who uses
          the app can read the pile — <Link to="/feedback/all">see what has been said</Link> — and
          what they see is your words, never your address.
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

          {/* Not a choice, so not a checkbox: the row is signed, and the page says so rather
              than letting somebody discover it afterwards. */}
          <p className="sign">
            This is signed with the address you are signed in with. It is stored with the note and
            travels into an export, and it is never printed next to your words on the pile page.
          </p>

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
