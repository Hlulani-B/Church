import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Menu from "../components/menu.jsx";
import { FeedbackFetch } from "../page_functions/feedback.js";

const feedback = new FeedbackFetch();

/*
  Everything anybody has said about the app. Not one admin's view of a private pile: the
  table is not tied to a community, so it would have been odd for its read to be tied to a
  role either. Any signed-in person can see what everybody else has already raised — the
  feedback is about Kopano itself, and the people who use it are the ones it is for.

  Rows come back newest first with no paging: this is a list somebody scrolls once a week
  to see whether the same complaint keeps showing up, not a report. If the pile ever
  outgrows a screen, sorting and filtering become real work; until then, an empty state
  and a plain list carry the whole job.
*/
const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");
.fx{--ink:#111;--muted:#666;--line:#d4d4d4;min-height:100vh;background:#fff;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.fx *{box-sizing:border-box}
.fx .serif{font-family:"Playfair Display",Georgia,serif;font-weight:500}
.fx .bar{display:flex;align-items:center;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.fx .bar .logo{font-size:24px;text-decoration:none;color:var(--ink);margin-right:auto}
.fx .main{max-width:960px;margin:0 auto;padding:44px 32px 96px}
.fx h1{font-size:34px;line-height:1.15;margin:0 0 8px}
.fx .lede{color:var(--muted);margin:0 0 32px}
.fx .top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 24px}
.fx .backs{display:flex;gap:18px;flex-wrap:wrap}
.fx .back{color:var(--ink);text-decoration:none;border-bottom:1px solid currentColor;font-size:14px;font-weight:600}
.fx .tools{display:flex;gap:8px;flex-wrap:wrap}
.fx .write{display:inline-block;padding:9px 18px;background:#111;color:#fff;border-radius:2px;text-decoration:none;font-size:14px;font-weight:600}
.fx .btn{font:inherit;font-size:14px;font-weight:600;padding:9px 18px;background:#fff;color:var(--ink);border:1px solid var(--ink);border-radius:2px;cursor:pointer}
.fx .btn:hover,.fx .btn:focus-visible{background:#111;color:#fff}
.fx .btn:disabled{opacity:.5;cursor:default;background:#fff;color:var(--ink)}
.fx .note{margin:0 0 20px;font-size:14px;color:var(--muted)}
.fx .ok{padding:10px 14px;background:#f2f7f2;border-left:3px solid #111;font-size:14px;margin:0 0 20px}
.fx .summary{display:flex;gap:24px;flex-wrap:wrap;margin:0 0 32px;padding:16px 20px;border:1px solid var(--line);border-radius:2px;background:#fafafa}
.fx .summary div{display:flex;flex-direction:column}
.fx .summary .k{font-size:26px;font-weight:600;line-height:1}
.fx .summary .l{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:4px;font-weight:600}
.fx .row{border:1px solid var(--line);border-left:4px solid #111;border-radius:2px;padding:14px 18px;margin:0 0 12px;background:#fff}
.fx .row .head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:baseline;margin:0 0 6px}
.fx .row .stars{color:#111;letter-spacing:.06em;font-size:16px}
.fx .row .stars .off{color:#e0e0e0}
.fx .row .when{font-size:12px;color:var(--muted)}
.fx .row .solved{font-size:13px;color:var(--muted)}
.fx .row .ans{margin:12px 0 0;padding:10px 12px;background:#fafafa;border-left:2px solid var(--line);font-size:14px;white-space:pre-wrap;color:var(--ink)}
.fx .row .ans .lb{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:4px}
.fx .empty{padding:60px 20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:2px}
.fx .err{color:#a11111;padding:14px 18px;border-left:3px solid #a11111;background:#fbeaea;margin:0 0 20px}
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

export default function FeedbackList() {
  // The role whose dashboard opened this list. Nothing here is about a community, but the screen
  // is still reached from one person's dashboard, and that is the page they expect to return to.
  const role = useLocation().state?.role;
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  // Which export is being written, so the two buttons cannot both be pressed at once. The
  // sentence left behind by the last one is a separate thing: a finished download should keep
  // saying what it called the file until something else goes wrong.
  const [writing, setWriting] = useState("");
  const [note, setNote] = useState("");

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

  /*
    An export reads the pile again rather than writing the rows already on screen: the same
    limit, so it is the same hundred-odd notes somebody just counted, but read at the moment the
    button was pressed rather than at the moment the page opened. Both writers build the file in
    the browser — no server step, nothing uploaded.
  */
  async function writeOut(kind) {
    setWriting(kind);
    setError("");
    setNote("");
    try {
      const done = kind === "excel" ? await feedback.exportExcel() : await feedback.exportPdf();
      setNote(`${done.count} ${done.count === 1 ? "note" : "notes"} written to ${done.name}.`);
    } catch (e) {
      setError(e.message || "The file could not be written.");
    } finally {
      setWriting("");
    }
  }

  const avg = rows.length ? (rows.reduce((sum, one) => sum + Number(one.stars || 0), 0) / rows.length) : 0;
  const yeses = rows.filter((one) => one.solves_problem).length;

  return (
    <div className="fx">
      <style>{css}</style>
      <header className="bar">
        <Link to="/community" className="logo serif">Kopano</Link>
        <Menu heading="Feedback" items={[{ label: "Write feedback", to: "/feedback" }]} />
      </header>
      <main className="main">
        <div className="top">
          <div className="backs">
            {role && (
              <Link to={`/${role}-dashboard`} className="back">
                ← The {role} dashboard
              </Link>
            )}
            <Link to="/community" className="back">← Your communities</Link>
          </div>
          <span className="tools">
            <Link to="/feedback" className="write">Write feedback</Link>
            <button className="btn" type="button" disabled={state !== "ready" || !!writing} onClick={() => writeOut("excel")}>
              {writing === "excel" ? "Writing…" : "Export Excel"}
            </button>
            <button className="btn" type="button" disabled={state !== "ready" || !!writing} onClick={() => writeOut("pdf")}>
              {writing === "pdf" ? "Writing…" : "Download PDF"}
            </button>
          </span>
        </div>

        {/* One slot, either outcome of the last click: a file that went out, or a reason it did not. */}
        {note && <div className="ok">{note}</div>}
        {error && <div className="err">{error}</div>}

        <h1 className="serif">What everyone is saying</h1>
        <p className="lede">
          Every note anybody has left about the app itself, newest first. Each one was written by a
          signed-in account and the address is stored with it, but it is not shown here — what you
          can read is what they said, and when. An export carries the address, because a file is
          something somebody chose to download.
        </p>

        {state === "loading" && <p className="lede">Loading…</p>}

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
          <div className="empty">
            Nothing has been said yet. Be the first — <Link to="/feedback">the form is here</Link>.
          </div>
        )}

        {state === "ready" && rows.map((one) => (
          <article key={one.id} className="row">
            <p className="head">
              <Starline n={one.stars} />
              <span className="when">{when(one.created_at)}</span>
            </p>
            {/* No name, no surname, no address: a row says what was said and nothing about who
                said it. The identity is on the row in the database and in an export. */}
            <p className="solved">solves problem: {one.solves_problem ? "yes" : "no"}</p>
            {one.improvements && <p className="ans"><span className="lb">Improve</span>{one.improvements}</p>}
            {one.additions && <p className="ans"><span className="lb">Missing</span>{one.additions}</p>}
            {one.most_challenging && <p className="ans"><span className="lb">Most challenging</span>{one.most_challenging}</p>}
          </article>
        ))}
      </main>
    </div>
  );
}
