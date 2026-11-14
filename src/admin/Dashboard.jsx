import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { CommunityFetch } from "../page_functions/community.js";
import {
  AdminDashboardFetch,
  formatJoinCode,
} from "../page_functions/admin_dashboard.js";
import Menu from "../components/menu.jsx";

const accounts = new Auth();
const communities = new CommunityFetch();
const dashboard = new AdminDashboardFetch();

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au.loading{display:block}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line);position:relative;z-index:10}
.au .bar .logo{font-size:24px;text-decoration:none}
.au .menuwrap{display:flex;align-items:center;position:relative}

.au .main{padding:56px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0;font-size:17px}

.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 14px;font-weight:600}
.au .pickers{display:flex;flex-wrap:wrap;gap:10px}
.au .picker{border:1px solid var(--line);border-radius:2px;background:#fff;padding:9px 16px;font-size:15px;font-family:inherit;cursor:pointer}
.au .picker.on{background:#111;color:#fff;border-color:#111}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au table{width:100%;border-collapse:collapse;margin-top:8px;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0 12px 8px 0;border-bottom:1px solid var(--line)}
.au td{padding:11px 12px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.au td.name{font-weight:500}
.au .role{display:inline-block;border:1px solid var(--line);padding:1px 9px;font-size:12px;font-weight:600;text-transform:capitalize}
.au .role.admin{border-color:#111;background:#111;color:#fff}

.au .codebox{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px}
.au .code{font-size:34px;letter-spacing:.14em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:9px 18px;font-size:14px;font-family:inherit;cursor:pointer}
.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:10px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .go:disabled{opacity:.55;cursor:default}
.au .form{display:flex;gap:10px;align-items:flex-end;margin-top:18px;flex-wrap:wrap}
.au .form label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 6px}
.au .form input{border:1px solid var(--line);border-radius:2px;padding:10px 12px;font-size:16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;width:150px;color:var(--text)}
.au .hint{font-size:13px;color:var(--muted);margin:12px 0 0}
.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au td,.au th{font-size:14px}
}
`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(null);
  const [mine, setMine] = useState([]);
  const [communityId, setCommunityId] = useState("");
  const [rows, setRows] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const community = mine.find((one) => one.community_id === communityId) || null;

  useEffect(() => {
    return accounts.onChange((user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      setSignedIn(user);
      communities
        .getCommunities()
        .then((list) => {
          setMine(list);
          if (list.length) setCommunityId((current) => current || list[0].community_id);
        })
        .catch((e) => setError(e.message));
    });
  }, [navigate]);

  // The roster and the join code always describe the community chosen below.
  useEffect(() => {
    if (!communityId) return;
    dashboard
      .getMembers(communityId)
      .then(setRows)
      .catch((e) => setError((current) => current || e.message));
    dashboard
      .getJoinCode(communityId)
      .then(setJoinCode)
      .catch((e) => setError((current) => current || e.message));
  }, [communityId]);

  // Chosen community is what clears the screen, so it is cleared here rather than in the
  // effect above: the effect would otherwise re-render twice on every change.
  function chooseCommunity(id) {
    if (id === communityId) return;
    setCommunityId(id);
    setRows([]);
    setJoinCode("");
    setDraft("");
    setCopied(false);
    setNote("");
    setError("");
  }

  async function copyCode() {
    setError("");
    try {
      await dashboard.copyJoinCode(joinCode);
      setCopied(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveCode(event) {
    event.preventDefault();
    const code = formatJoinCode(draft);
    if (code.length !== 6) {
      setError("A join code is six characters, A to Z or 0 to 9.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const row = await dashboard.changeJoinCode(communityId, code);
      setJoinCode(row.join_id);
      setDraft("");
      setNote(`The join code for ${row.name} is now ${row.join_id}.`);
    } catch (e) {
      // A code somebody else already holds comes back from the unique constraint.
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="au loading">
        <style>{css}</style>
        <div className="main">
          <p className="sub">Checking your sign-in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
      </div>

      <main className="main">
        <h1 className="serif">Admin <em>dashboard</em></h1>
        <p className="sub">{signedIn.email}</p>

        {error && <div className="note bad">{error}</div>}
        {note && !error && <div className="note">{note}</div>}

        {mine.length === 0 ? (
          <>
            <h3>Communities</h3>
            <p className="sub">You are not in a community yet, so there is nothing to administer.</p>
          </>
        ) : (
          <>
            <h3>Community</h3>
            <div className="pickers">
              {mine.map((one) => (
                <button
                  className={one.community_id === communityId ? "picker on" : "picker"}
                  type="button"
                  key={one.community_id}
                  onClick={() => chooseCommunity(one.community_id)}
                >
                  {one.name}
                </button>
              ))}
            </div>

            <h3>Members{community ? ` of ${community.name}` : ""}</h3>
            {rows.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Surname</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((one) => (
                    <tr key={one.email}>
                      <td className="name">{one.name}</td>
                      <td>{one.surname}</td>
                      <td>{one.email}</td>
                      <td><span className={one.role === "admin" ? "role admin" : "role"}>{one.role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              !error && <p className="sub">Loading…</p>
            )}

            <h3>Join code</h3>
            <div className="codebox">
              <span className="code">{joinCode || "——"}</span>
              {joinCode && (
                <button className="ghost" type="button" onClick={copyCode}>
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <p className="hint">
              People type this code to find {community?.name || "the community"}. Joining by
              code is not built yet, so nothing happens with it until that exists.
            </p>

            <form className="form" onSubmit={saveCode}>
              <div>
                <label htmlFor="join-code">New code</label>
                <input
                  id="join-code"
                  value={draft}
                  onChange={(event) => setDraft(formatJoinCode(event.target.value))}
                  placeholder={joinCode || "ABC123"}
                  autoComplete="off"
                />
              </div>
              <button className="go" type="submit" disabled={busy || !communityId}>
                {busy ? "Saving…" : "Change code"}
              </button>
            </form>
          </>
        )}

        <a className="back" href="/community">Back to your communities</a>
      </main>
    </div>
  );
}
