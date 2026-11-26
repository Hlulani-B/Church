import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import { PurgeFetch } from "../page_functions/purge.js";
import { adminState } from "../admin/state.js";

const accounts = new Auth();
const dashboard = new AdminDashboardFetch();
const purging = new PurgeFetch();

/*
  The typing screen. Everything on it exists to make one irreversible act slower than the click that
  starts it: the community is named, what goes and what stays are both listed, and the name has to be
  written out before the button will answer.

  What this screen clears is the record rather than the fellowship: functions, gatherings, check-ins,
  servings, testimonies, the extra people noted against them, and every uploaded file those rows point
  at. The community row, its members and their roles are left exactly as they were, so the admin who
  came here for space goes back afterwards to a community that is still there and still theirs.

  Nothing here is trusted from the link that brought the person. The row is read again from the
  server so the name being typed back is the name in the table, and the sign-in is re-checked against
  `created_by` so a bookmark, a reload or a browser left open on somebody else's account lands back on
  the sign-in page rather than on a delete button. The server asks both questions again before it
  touches a row; this page only refuses to show a way to skip what it already knows will be refused.
*/
const WHAT_GOES = [
  "Functions and the attendance, payments and receipts recorded under them",
  "Gatherings, check-in sessions and their attendance",
  "Servings, testimonies and the files attached to either",
  "Extra members and everything noted about them",
];

const WHAT_STAYS = [
  "The community itself, its name and its join code",
  "Its members and the roles they hold",
  "Everybody's own account, and their place in every other community",
];

// Rows come back keyed by table; only the tables that held something are worth a line.
function counted(rows) {
  return Object.entries(rows || {}).filter(([, count]) => Number(count) > 0);
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.kpx{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#faf9f7;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6;display:flex;align-items:center;justify-content:center;padding:32px 20px}
.kpx *{box-sizing:border-box}
.kpx a{color:inherit}
.kpx .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.kpx .wrap{width:100%;max-width:560px}
.kpx .band{background:#111;color:#fff;padding:24px 28px}
.kpx .band .logo{font-size:18px;text-decoration:none;display:block;margin-bottom:12px}
.kpx .band h1{font-size:26px;line-height:1.25;margin:0}
.kpx .band h1 em{font-style:italic}
.kpx .band p{color:#bbb;font-size:14px;margin:10px 0 0}

.kpx .card{background:#fff;border:1px solid var(--line);border-top:0;padding:28px}
.kpx h2{font-size:15px;margin:0 0 10px}
.kpx ul{margin:0 0 22px;padding-left:20px;font-size:14px;color:var(--muted)}
.kpx ul li{margin-bottom:6px}
.kpx ul.stays{color:var(--text)}
.kpx .note{font-size:13px;color:var(--muted);margin:0 0 22px}
.kpx label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.kpx .typed{font-size:13px;color:#111;background:#f4f4f4;border:1px dashed var(--line);padding:6px 10px;display:inline-block;margin-bottom:10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.kpx input[type="text"]{width:100%;padding:12px 14px;border:1px solid #111;border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.kpx input:focus{outline:none;border-color:#111}
.kpx .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #111}
.kpx .btn.red{background:#8b1a1a;color:#fff;border-color:#8b1a1a}
.kpx .btn.black{background:#111;color:#fff}
.kpx .btn:disabled{opacity:.4;cursor:not-allowed}
.kpx .error{background:#f4f4f4;border-left:3px solid #8b1a1a;padding:10px 14px;font-size:14px;margin-bottom:16px}
.kpx .done{border-left:3px solid #111;background:#f4f4f4;padding:12px 14px;font-size:14px;margin-bottom:18px}
.kpx table{width:100%;border-collapse:collapse;font-size:14px;margin:0 0 22px}
.kpx th{ text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--line);padding:6px 0}
.kpx td{padding:7px 0;border-bottom:1px solid #eee}
.kpx td.n{text-align:right;font-variant-numeric:tabular-nums}
.kpx .back{display:block;margin-top:22px;font-size:13px;color:var(--muted);text-align:center}
.kpx .back a{font-weight:600}
`;

export default function DeleteCommunityConfirmPage() {
  const navigate = useNavigate();
  const state = adminState(null, useLocation().state);
  const [community, setCommunity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  function backToSignIn(notice) {
    navigate("/delete-community", { replace: true, state: { ...state, notice } });
  }

  // Whichever way this page is reached, it settles on the server's answer before it shows a button.
  useEffect(() => {
    if (!state.community_id) {
      backToSignIn("This screen only works from inside the community whose data you want to delete.");
      return undefined;
    }
    let cancelled = false;
    const stop = accounts.onChange((user) => {
      if (cancelled) return;
      if (!user) {
        backToSignIn("Sign in with the address that opened this community.");
        return;
      }
      dashboard
        .getCommunity(state.community_id)
        .then((found) => {
          if (cancelled) return;
          if (!found) {
            setError("There is no community with that id, so there is nothing here to delete.");
            setChecking(false);
            return;
          }
          const founder = String(found.created_by || "").trim().toLowerCase();
          if (!founder) {
            setError(
              "This community was opened before the app recorded who created it, so nobody can be shown to own emptying it. Set created_by on the community row first.",
            );
            setChecking(false);
            return;
          }
          if (founder !== String(user.email).trim().toLowerCase()) {
            backToSignIn("That address did not open this community, so it cannot delete all its data.");
            return;
          }
          setCommunity(found);
          setChecking(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err.message || "We could not read this community, so nothing was deleted.");
          setChecking(false);
        });
    });
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const answer = await purging.deleteAll({ community_id: state.community_id, name: typed });
      setReport(answer);
      setTyped("");
    } catch (err) {
      setError(err.message || "Nothing was deleted. The server refused this request.");
    } finally {
      setBusy(false);
    }
  }

  const matching =
    Boolean(community) && typed.trim().toLowerCase() === String(community.name || "").trim().toLowerCase();

  const rows = counted(report?.rows);
  const files = report?.files || {};
  const total = rows.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="kpx">
      <style>{css}</style>
      <div className="wrap">
        <div className="band">
          <a className="logo serif" href="/community">Kopano</a>
          <h1 className="serif">
            {report ? <>The data <em>is</em> gone</> : <>Delete <em>the data</em></>}
          </h1>
          <p>
            {report
              ? `${community?.name || "This community"} is still here — empty, but still a community.`
              : "Every record inside one community, and every file those records point at. The community itself stays."}
          </p>
        </div>

        <div className="card">
          {checking && <p className="note">Checking who opened this community…</p>}

          {!checking && error && <div className="error">{error}</div>}

          {!checking && !error && !report && community && (
            <>
              <h2>What goes</h2>
              <ul>
                {WHAT_GOES.map((one) => (
                  <li key={one}>{one}</li>
                ))}
              </ul>
              <h2>What stays</h2>
              <ul className="stays">
                {WHAT_STAYS.map((one) => (
                  <li key={one}>{one}</li>
                ))}
              </ul>
              <p className="note">
                If you came here to free space and want the records first, the download buttons on the
                functions, servings and testimonies pages save them all as PDFs before anything is
                deleted.
              </p>
              <form onSubmit={handleDelete}>
                <label htmlFor="confirm-name">Type the community name to confirm</label>
                <div className="typed">{community.name}</div>
                <input
                  id="confirm-name"
                  type="text"
                  autoComplete="off"
                  spellCheck="false"
                  placeholder={community.name}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <div style={{ height: "18px" }} />
                <button className="btn red" type="submit" disabled={!matching || busy}>
                  {busy ? "Deleting…" : `Delete all the data in ${community.name}`}
                </button>
              </form>
            </>
          )}

          {report && (
            <>
              <div className="done">
                {report.functions
                  ? `${report.functions} function${report.functions === 1 ? "" : "s"}, `
                  : ""}
                {total} row{total === 1 ? "" : "s"} and {Number(files.removed)} file
                {Number(files.removed) === 1 ? "" : "s"} were removed from {community.name}.
                {Number(files.refused)
                  ? ` ${files.refused} file${files.refused === 1 ? "" : "s"} could not be removed from storage.`
                  : ""}{" "}
                The community, its members and their roles are untouched.
              </div>
              {rows.length > 0 && (
                <table>
                  <thead>
                    <tr><th>Table</th><th className="n">Rows</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(([table, count]) => (
                      <tr key={table}><td>{table}</td><td className="n">{count}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <a className="btn black" href="/admin-dashboard">Back to the dashboard</a>
            </>
          )}

          {!checking && !report && (
            <p className="back">
              Leave it alone? <a href="/admin-dashboard">Back to the dashboard</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
