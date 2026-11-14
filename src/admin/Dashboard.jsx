import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import Menu from "../components/menu.jsx";

const accounts = new Auth();
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

.au .main{padding:56px 56px 96px;max-width:1400px;width:100%}
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0;font-size:17px}

.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 14px;font-weight:600}

/* The roster is the wide column and the join code sits beside it once there is room,
   so an admin reads the list and the code without scrolling between the two. */
.au .grid{display:grid;grid-template-columns:minmax(0,1fr);gap:44px;margin-top:20px}
.au .grid h3{margin-top:0}
.au .grid .side{align-self:start;border:1px solid var(--line);border-radius:2px;padding:22px 24px 24px}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au table{width:100%;border-collapse:collapse;margin-top:8px;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0 12px 8px 0;border-bottom:1px solid var(--line)}
.au td{padding:11px 12px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.au td.name{font-weight:500}
.au .role{display:inline-block;border:1px solid var(--line);padding:1px 9px;font-size:12px;font-weight:600;text-transform:capitalize}
.au .role.admin{border-color:#111;background:#111;color:#fff}

/* One row menu, opened by the three dots at the end of each line. */
.au th.last,.au td.last{width:44px;text-align:right;padding-right:0}
.au .dotswrap{position:relative;display:inline-block}
.au .dots{background:#fff;border:1px solid transparent;border-radius:2px;width:32px;height:28px;font-size:17px;line-height:1;cursor:pointer;color:#111}
.au .dots:hover,.au .dots.on{border-color:var(--line)}
.au .rowmenu{position:absolute;top:32px;right:0;background:#fff;border:1px solid var(--line);border-radius:2px;box-shadow:0 10px 26px rgba(0,0,0,.14);z-index:12;min-width:170px}
.au .rowmenu button{display:block;width:100%;text-align:left;background:#fff;border:0;padding:11px 14px;font-size:14px;font-family:inherit;cursor:pointer;color:#a11111}
.au .rowmenu button:hover{background:#f4f4f4}

/* Confirming a removal is a popup, because it changes the code for everybody. */
.au .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.au .pop{background:#fff;border-radius:2px;width:100%;max-width:440px;padding:28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.au .pop h2{font-size:24px;margin:0 0 12px}
.au .pop p{color:var(--muted);font-size:15px;margin:0 0 10px}
.au .pop .who{color:var(--text);font-weight:600}
.au .pop .fail{color:#a11111;font-size:14px;margin:14px 0 0}
.au .pop .row{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.au .pop .ghost{padding:11px 20px;font-size:15px}
.au .danger{background:#a11111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .danger:disabled{opacity:.55;cursor:default}

.au .codebox{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px}
.au .code{font-size:34px;letter-spacing:.14em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:9px 18px;font-size:14px;font-family:inherit;cursor:pointer}
.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:10px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:20px}
.au .go:disabled{opacity:.55;cursor:default}
.au .hint{font-size:13px;color:var(--muted);margin:12px 0 0}
.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none}

@media (min-width:1200px) and (orientation:landscape){
  /* The code keeps a lane of its own so the roster is never squeezed to fit it. */
  .au .grid{grid-template-columns:minmax(0,1fr) 340px;gap:48px}
}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au td,.au th{font-size:14px}
  .au .grid .side{padding:18px}
}
`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  /*
    The community whose card was clicked on /community. This page administers that one
    row of community and never another, so there is no picker here to choose from and no
    fallback to whichever community happens to come back first.
  */
  const communityId = useLocation().state?.community_id || "";
  const [signedIn, setSignedIn] = useState(null);
  const [community, setCommunity] = useState(null);
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [confirmError, setConfirmError] = useState("");
  const [removing, setRemoving] = useState(false);

  const joinCode = community?.join_id || "";

  function askRemove(row) {
    setMenuFor("");
    setConfirmError("");
    setConfirm(row);
  }

  function closeConfirm() {
    if (removing) return;
    setConfirm(null);
  }

  /*
    One click does both halves: the address is unlinked from this community, then its join
    code is drawn again by the server. They arrive together because a removal that leaves
    the old code standing is a door still open, and the row that comes back carries the new
    code so it can be told to everyone before the next gathering.
  */
  async function removeMember() {
    setRemoving(true);
    setConfirmError("");
    try {
      const row = await dashboard.removeMember(communityId, confirm.email);
      setCommunity(row);
      setCopied(false);
      setRows(await dashboard.getMembers(communityId));
      setNote(
        `${confirm.name} ${confirm.surname} is out of ${row.name}. Its join code is now ${row.join_id}, so tell everyone the new one.`,
      );
      setConfirm(null);
    } catch (e) {
      // The server refuses an admin's row and an empty community, and says why here.
      setConfirmError(e.message);
    } finally {
      setRemoving(false);
    }
  }

  useEffect(() => {
    return accounts.onChange((user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      setSignedIn(user);
    });
  }, [navigate]);

  // Both reads describe the community that was chosen, and nothing else.
  useEffect(() => {
    if (!communityId) return;
    dashboard
      .getCommunity(communityId)
      .then(setCommunity)
      .catch((e) => setError((current) => current || e.message));
    dashboard
      .getMembers(communityId)
      .then(setRows)
      .catch((e) => setError((current) => current || e.message));
  }, [communityId]);

  // A row menu is open until something else is clicked, or Escape.
  useEffect(() => {
    if (!menuFor) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMenuFor("");
    }
    function onClick() {
      setMenuFor("");
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [menuFor]);

  useEffect(() => {
    if (!confirm) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !removing) setConfirm(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, removing]);

  async function copyCode() {
    setError("");
    try {
      await dashboard.copyJoinCode(joinCode);
      setCopied(true);
    } catch (e) {
      setError(e.message);
    }
  }

  /*
    One click, one new code. The code is drawn on the server and checked against every
    community before it is written, so this page never holds a code box and never decides
    what the next code is.
  */
  async function changeCode() {
    setBusy(true);
    setError("");
    try {
      const row = await dashboard.changeJoinCode(communityId);
      setCommunity(row);
      setCopied(false);
      setNote(`The new join code for ${row.name} is ${row.join_id}.`);
    } catch (e) {
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

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to administer here. Go back,
            click a community, and its members and join code open on this page.
          </div>
        ) : (
          <div className="grid">
            <section className="roster">
              <h3>Members{community ? ` of ${community.name}` : ""}</h3>
              {rows.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Surname</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th className="last" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.email}>
                        <td className="name">{one.name}</td>
                        <td>{one.surname}</td>
                        <td>{one.email}</td>
                        <td><span className={one.role === "admin" ? "role admin" : "role"}>{one.role}</span></td>
                        <td className="last">
                          <div className="dotswrap">
                            <button
                              className={menuFor === one.email ? "dots on" : "dots"}
                              type="button"
                              aria-label={`Options for ${one.name} ${one.surname}`}
                              aria-haspopup="true"
                              aria-expanded={menuFor === one.email}
                              onClick={(event) => {
                                event.stopPropagation();
                                setMenuFor((current) => (current === one.email ? "" : one.email));
                              }}
                            >
                              ⋮
                            </button>
                            {menuFor === one.email && (
                              <div className="rowmenu">
                                <button type="button" onClick={() => askRemove(one)}>
                                  Remove member
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                !error && <p className="sub">Loading…</p>
              )}
            </section>

            <section className="side">
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
                People type this code to find {community?.name || "the community"}.
              </p>

              <button className="go" type="button" onClick={changeCode} disabled={busy}>
                {busy ? "Drawing a new code…" : "Change code"}
              </button>
              <p className="hint">
                The old code stops working the moment this one appears.
              </p>
            </section>
          </div>
        )}

        <a className="back" href="/community">Back to your communities</a>
      </main>

      {confirm && (
        <div
          className="veil"
          role="dialog"
          aria-modal="true"
          aria-label="Remove member"
          onClick={closeConfirm}
        >
          <div className="pop" onClick={(event) => event.stopPropagation()}>
            <h2 className="serif">Remove this member?</h2>
            <p>
              <span className="who">
                {confirm.name} {confirm.surname} ({confirm.email})
              </span>{" "}
              stops being a member of {community?.name} — their role here is{" "}
              <span className="who">{confirm.role}</span>. Their attendance and testimonies
              stay recorded against their address.
            </p>
            <p>
              The join code is drawn again at the same time, so anybody who had it cannot
              type their way back in. Everyone else has to be told the new code.
            </p>

            {confirmError && <p className="fail">{confirmError}</p>}

            <div className="row">
              <button className="ghost" type="button" onClick={closeConfirm} disabled={removing}>
                Cancel
              </button>
              <button className="danger" type="button" onClick={removeMember} disabled={removing}>
                {removing ? "Removing…" : "Remove and change code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
