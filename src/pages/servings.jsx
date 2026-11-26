import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import servings from "../page_functions/servings.js";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import ExtraServings from "../components/extra_servings.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();

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

.au .main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 16px;font-weight:600}
.au .tablewrap{border:1px solid var(--line);border-radius:2px;overflow-x:auto;margin-top:14px}
.au table{width:100%;border-collapse:collapse;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--line)}
.au td{padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:middle}
.au tbody tr:last-child td{border-bottom:0}
.au td .who{display:flex;align-items:center;gap:12px;font-weight:500}
.au .avatar{flex:none;width:34px;height:34px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:15px}
.au .role{display:inline-block;border:1px solid var(--line);padding:2px 10px;font-size:12px;font-weight:600;text-transform:capitalize;background:#fff}

.au .edit{display:flex;gap:8px;align-items:center}
.au .edit input{font:inherit;font-size:14px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:7px 10px;min-width:0}
.au .edit input:focus{outline:none;border-color:#111}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:7px 14px;font-size:13px;font-family:inherit;cursor:pointer}
.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer}
.au .go:disabled{opacity:.55;cursor:default}
.au .hint{font-size:13px;color:var(--muted);margin:14px 0 0}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
}

/*
  On a phone four columns cannot sit side by side: the address alone is wider than the screen, so
  the register used to run off to the right and the reader scrolled sideways through it. Below 640px
  it stops being a table and becomes one card per person. The header row goes away and each cell
  picks up the label of the column it came from, read off its own data-label — so adding a fifth
  column to the table later means writing its label on the new cell and touching nothing here.
*/
@media (max-width:640px){
  .au .tablewrap{border:0;overflow-x:visible}
  .au table,.au tbody{display:block}
  .au thead{display:none}
  .au tr{display:block;border:1px solid var(--line);border-radius:2px;margin:0 0 10px}
  .au tr:last-child{margin-bottom:0}
  .au td{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f0f0f0}
  .au td:last-child{border-bottom:0}
  /* The desktop rule that leaves the last row without a border would take the dividers out of the
     last card too, where every cell but the last still needs one, so it is put back and only the
     cell that truly closes a card goes without. */
  .au tbody tr:last-child td{border-bottom:1px solid #f0f0f0}
  .au tr:last-child td:last-child{border-bottom:0}
  /* the label holds its lane; the value takes the rest and breaks a long address inside it */
  .au td::before{content:attr(data-label);flex:none;width:72px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
  .au td>*,.au td{min-width:0;overflow-wrap:anywhere}
  .au .edit{flex-wrap:wrap}
  .au .role{flex:none}
}
`;

// One row's role: plain for anybody who cannot manage servings, editable for an admin or leader.
function RoleCell({ one, canManage, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(one.role || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave(one.email, value.trim());
    setSaving(false);
    if (ok) {
      setEditing(false);
      setValue(value.trim());
    }
  }

  if (!canManage) {
    return <span className="role">{one.role || "—"}</span>;
  }
  if (!editing) {
    return (
      <div className="edit">
        <span className="role">{one.role || "—"}</span>
        <button className="ghost" type="button" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="edit">
      <input
        type="text"
        value={value}
        placeholder="role"
        onChange={(event) => setValue(event.target.value)}
        autoFocus
      />
      <button className="go" type="button" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        className="ghost"
        type="button"
        disabled={saving}
        onClick={() => {
          setEditing(false);
          setValue(one.role || "");
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default function ServingsPage() {
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  // null until the servings read lands, so a list still out is not drawn as a community with
  // nobody serving in it. A refresh keeps the rows already on the screen rather than going back
  // to null, which would make every saved role flash the loading boxes.
  const [rows, setRows] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  // Only an admin or a leader may change a role; a member sees the list read-only.
  const canManage = route?.role === "admin" || route?.role === "leader";

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: admin.name, email: admin.email });
  }, [communityId, admin.name, admin.email]);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  function load() {
    if (!communityId) {
      setRows([]);
      return;
    }
    servings
      .getRoles(communityId)
      .then((list) => {
        setRows(list || []);
        setError("");
      })
      // An empty array with the message above it: the read is over, and the failure is said by
      // the note rather than by a sentence about who is missing from the list.
      .catch((e) => {
        setRows([]);
        setError(e.message);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  // One row per serving, a chunk of them at a time: a fellowship that serves in many teams used to
  // scroll past the whole register before it reached the extra servings kept beside it.
  const paged = usePager(rows ?? [], PER_PAGE, communityId);

  async function onSaveRole(email, role) {
    setError("");
    try {
      await servings.changeRole({ email, community_id: communityId, role });
      setNote("That serving's role is updated.");
      load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  if (!signedIn) {
    return (
      <div className="au loading">
        <style>{css}</style>
        <div className="main">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing to open.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
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
        {/* The dashboard that opened this page is the way out of it. Reached with no role — a
            bookmark, a typed url — there is no dashboard to name, so the communities link stands. */}
        {route?.role ? (
          <BackToDashboard role={route.role} state={admin} />
        ) : (
          <BackToCommunities />
        )}
      </div>

      <main className="main">
        <p className="eyebrow">Servings</p>
        <h1 className="serif">{admin.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {error && <div className="note bad">{error}</div>}
        {note && !error && <div className="note">{note}</div>}

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to show here. Go back, click a community,
            and open its servings from the dashboard.
          </div>
        ) : (
          <section>
            <h3>Servings</h3>
            {rows === null ? (
              <LoadingBoxes words="Reading this community's servings…" />
            ) : rows.length ? (
              <div className="tablewrap" id={paged.anchorId}>
                <table>
                  <thead>
                    {/* No Address column: this list is read by whoever leads or admins the community,
                        and an address is how the people in it sign in rather than who they are. The
                        row is still keyed on it, because that is what the serving is written against. */}
                    <tr>
                      <th>Name</th>
                      <th>Surname</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.chunk.map((one) => (
                      <tr key={one.email}>
                        <td data-label="Name">
                          <div className="who">
                            <span className="avatar" aria-hidden="true">
                              {(one.name || "?").charAt(0).toUpperCase()}
                            </span>
                            {one.name}
                          </div>
                        </td>
                        <td data-label="Surname">{one.surname}</td>
                        <td data-label="Role">
                          <RoleCell one={one} canManage={canManage} onSave={onSaveRole} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
                !error && <p className="sub">Nobody is listed under servings for this community yet.</p>
            )}
            <Pager state={paged} noun={rows?.length === 1 ? "serving" : "servings"} />
            <p className="hint">
              {canManage
                ? "Change a serving's role here. Only admins and leaders can do this."
                : "Only an admin or a leader can change a serving's role."}
            </p>
          </section>
        )}

        {/* The same servings, kept apart, for the people who never joined the app. It lives here on
            the servings page beside the register it mirrors, and only for the hands that may manage
            a serving at all — an admin or a leader. */}
        {communityId && canManage && <ExtraServings communityId={communityId} />}
      </main>
    </div>
  );
}
