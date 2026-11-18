import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Menu from "../components/menu.jsx";
import { FeedbackFetch } from "../page_functions/feedback.js";

const feedback = new FeedbackFetch();

/*
  An admin's read of the whole feedback pile, not one community's. The rows come back newest
  first with no paging: this is a table somebody scrolls once a week to see whether the same
  complaint keeps showing up, not a report. If the pile ever outgrows a screen, sorting and
  filtering become real work; until then, an empty state and a plain list carry the whole job.
*/
const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");
.fx{--ink:#111;--muted:#666;--line:#d4d4d4;min-height:100vh;background:#fff;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.fx *{box-sizing:border-box}
.fx .serif{font-family:"Playfair Display",Georgia,serif;font-weight:500}
.fx .bar{display:flex;align-items:center;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.fx .bar .logo{font-size:24px;text-decoration:none;color:var(--ink)}
.fx .main{max-width:960px;margin:0 auto;padding:44px 32px 96px}
.fx h1{font-size:34px;line-height:1.15;margin:0 0 8px}
.fx .lede{color:var(--muted);margin:0 0 32px}
.fx .summary{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 32px;padding:16px 20px;border:1px solid var(--line);border-radius:2px;background:#fafafa}
.fx .summary div{display:flex;flex-direction:column}
.fx .summary .k{font-size:26px;font-weight:600;line-height:1}
.fx .summary .l{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:4px;font-weight:600}
.fx .row{border:1px solid var(--line);border-left:4px solid #111;border-radius:2px;padding:14px 18px;margin:0 0 12px;background:#fff}
.fx .row .head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:baseline;margin:0 0 6px}
.fx .row .stars{color:#111;letter-spacing:.06em;font-size:16px}
.fx .row .stars .off{color:#e0e0e0}
.fx .row .when{font-size:12px;color:var(--muted)}
.fx .row .email{font-size:13px;color:var(--muted)}
.fx .row .email.anon{font-style:italic}
.fx .row .ans{margin:12px 0 0;padding:10px 12px;background:#fafafa;border-left:2px solid var(--line);font-size:14px;white-space:pre-wrap;color:var(--ink)}
.fx .row .ans .lb{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:4px}
.fx .empty{padding:60px 20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:2px}
.fx .err{color:#a11111;padding:14px 18px;border-left:3px solid #a11111;background:#fbeaea;margin:0 0 20px}
.fx .back{color:var(--ink);text-decoration:none;border-bottom:1px solid currentColor;font-size:14px;font-weight:600}
`;

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Starline({ n }) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return (
    <span className="stars" aria-label={`${v} out of 5`}>
      {"★".repeat(v)}
      <span className="off">{"★".repeat(5 - v)}</span>
    </span>
  );
}

export default function AdminFeedback() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    feedback
      .list()
      .then((data) => {
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
        setState("ready");
      })
      .catch((cause) => {
        if (!alive) return;
        setError(cause.message || "Could not read the feedback pile.");
        setState("bad");
      });
    return () => { alive = false; };
  }, []);

  const avg = rows.length ? (rows.reduce((sum, one) => sum + Number(one.stars || 0), 0) / rows.length) : 0;
  const yeses = rows.filter((one) => one.solves_problem).length;

  return (
    <div className="fx">
      <style>{css}</style>
      <header className="bar">
        <Link to="/community" className="logo serif">Kopano</Link>
        <Menu heading="Admin" guideRole="feedback" items={[{ label: "Admin dashboard", to: "/admin-dashboard" }]} />
      </header>
      <main className="main">
        <p><Link to="/admin-dashboard" className="back">← Admin dashboard</Link></p>
        <h1 className="serif">Feedback</h1>
        <p className="lede">Everything anyone has said about the app. Rows without an email are anonymous.</p>

        {state === "loading" && <p className="lede">Loading…</p>}
        {state === "bad" && <div className="err">{error}</div>}

        {state === "ready" && rows.length > 0 && (
          <div className="summary">
            <div><span className="k">{rows.length}</span><span className="l">Total notes</span></div>
            <div><span className="k">{avg.toFixed(1)}★</span><span className="l">Average</span></div>
            <div>
              <span className="k">{rows.length ? Math.round((yeses / rows.length) * 100) : 0}%</span>
              <span className="l">Solved the problem</span>
            </div>
          </div>
        )}

        {state === "ready" && !rows.length && (
          <div className="empty">Nothing has been said yet. The pile grows as people find the Feedback panel.</div>
        )}

        {state === "ready" && rows.map((one) => (
          <article key={one.id} className="row">
            <p className="head">
              <Starline n={one.stars} />
              <span className="when">{when(one.created_at)}</span>
            </p>
            <p className={`email${one.email ? "" : " anon"}`}>
              {one.email || "anonymous"} · solves problem: {one.solves_problem ? "yes" : "no"}
            </p>
            {one.improvements && <p className="ans"><span className="lb">Improve</span>{one.improvements}</p>}
            {one.additions && <p className="ans"><span className="lb">Missing</span>{one.additions}</p>}
            {one.most_challenging && <p className="ans"><span className="lb">Most challenging</span>{one.most_challenging}</p>}
          </article>
        ))}
      </main>
    </div>
  );
}
