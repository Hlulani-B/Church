import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch, ROLES } from "../page_functions/admin_dashboard.js";
import AdminMenu from "./menu.jsx";
import BackToCommunities from "../components/back.jsx";
import AttendanceControl from "../components/attendance_control.jsx";
import SessionLive from "../components/session_live.jsx";
import AvailableFunctions from "../components/available_functions.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import { adminState, rememberAdmin } from "./state.js";
import servings from "../page_functions/servings.js";

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

.au .main{padding:64px 56px 96px;max-width:1400px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}
.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:48px 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.au h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}

/* three ways out of the roster, with taking attendance as the main action */
.au .links{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0 0}
.au .links button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .links button:hover{background:#111;color:#fff}
.au .links button.primary{background:#111;color:#fff}
.au .links button.primary:hover{background:#333;border-color:#333}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

/* small numbers about the community */
.au .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 20px}
.au .stat{border:1px solid var(--line);border-radius:2px;padding:16px 18px;background:#fafafa}
.au .stat .n{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:30px;line-height:1.1}
.au .stat .l{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-top:4px}

/* One box over the list, and it filters what this page already holds. */
.au .find{margin:0 0 6px}
.au .find input{width:100%;max-width:460px;font:inherit;font-size:16px;color:var(--text);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 14px center;border:1px solid #bdbdbd;border-radius:2px;padding:11px 14px 11px 42px}
.au .find input:focus{outline:none;border-color:#111}
.au .clear{background:none;border:0;padding:0;font:inherit;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:1px solid var(--line)}
.au .clear:hover{color:#111;border-bottom-color:#111}

/* The roster is the wide column and the join code sits beside it once there is room,
   so an admin reads the list and the code without scrolling between the two. */
.au .grid{display:grid;grid-template-columns:minmax(0,1fr);gap:44px;margin-top:20px}
.au .grid h3{margin-top:0}
.au .grid .side{align-self:start;border:1px solid var(--line);border-radius:2px;padding:22px 24px 24px}

/* the members table sits in a card */
.au .tablewrap{border:1px solid var(--line);border-radius:2px;overflow-x:auto;margin-top:14px}
.au table{width:100%;border-collapse:collapse;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--line)}
.au td{padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:middle}
.au tbody tr:last-child td{border-bottom:0}
.au tbody tr:hover td{background:#fafafa}
.au td .who{display:flex;align-items:center;gap:12px;font-weight:500}
.au .avatar{flex:none;width:34px;height:34px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:15px}
.au .role{display:inline-block;border:1px solid var(--line);padding:2px 10px;font-size:12px;font-weight:600;text-transform:capitalize;background:#fff}
.au .role.leader{border-color:#111}
.au .role.admin{border-color:#111;background:#111;color:#fff}
.au .tally{font-size:14px;color:var(--muted);margin:14px 0 0}

/* One row menu, opened by the three dots at the end of each line. */
.au th.last,.au td.last{width:44px;text-align:right;padding-right:0}
.au .dotswrap{position:relative;display:inline-block}
.au .dots{background:#fff;border:1px solid transparent;border-radius:2px;width:32px;height:28px;font-size:17px;line-height:1;cursor:pointer;color:#111}
.au .dots:hover,.au .dots.on{border-color:var(--line)}
.au .rowmenu{position:absolute;top:32px;right:0;background:#fff;border:1px solid var(--line);border-radius:2px;box-shadow:0 10px 26px rgba(0,0,0,.14);z-index:12;min-width:170px}
.au .rowmenu button{display:block;width:100%;text-align:left;background:#fff;border:0;padding:11px 14px;font-size:14px;font-family:inherit;cursor:pointer;color:#a11111}
.au .rowmenu button:hover{background:#f4f4f4}
.au .rowmenu button.plain{color:#111}

/* Choosing a role is a decision about what somebody can open, so each choice says that on
   its own line rather than leaving the word to be remembered. */
.au .roles{display:grid;gap:10px;margin:18px 0 0}
.au .roles label{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--line);border-radius:2px;padding:12px 14px;cursor:pointer;font-size:14px;color:var(--text)}
.au .roles label.on{border-color:#111;box-shadow:inset 0 0 0 1px #111}
.au .roles input{margin:2px 0 0}
.au .roles .what{display:flex;flex-direction:column;gap:3px}
.au .roles .what b{font-size:15px;font-weight:600;text-transform:capitalize}
.au .roles .what span{color:var(--muted);font-size:13px;line-height:1.45}
.au .pop.wide{max-width:520px}
.au .pop .go{margin-top:0}

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

@media (min-width:1200px) and (orientation:landscape){
  /* The code keeps a lane of its own so the roster is never squeezed to fit it. */
  .au .grid{grid-template-columns:minmax(0,1fr) 340px;gap:48px}
}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au .stats{grid-template-columns:1fr}
  .au td,.au th{font-size:14px;padding:10px 12px}
  .au .grid .side{padding:18px}
}
`;

// A role in the sentence that says somebody holds it now.
function spoken(role) {
  return role === "admin" ? "an admin" : `a ${role}`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  /*
    Which community this page administers and whose address opened it. The card on
    /community hands both over, and src/admin/state.js fills in whatever the link did not
    carry from the last community this browser opened — so a reload, a bookmark or the back
    button lands on this community rather than on an empty page. Nothing is ever guessed
    from the roster: this page shows one row of community and no other.
  */
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [community, setCommunity] = useState(null);
  const [roster, setRoster] = useState({ community_id: "", rows: [] });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [confirmError, setConfirmError] = useState("");
  const [removing, setRemoving] = useState(false);
  /*
    The role being chosen for one person: who it is for, which of the three has been clicked,
    and whether the write is still on its way. The person is tagged with the community that
    listed them, exactly as a removal is, because the roster underneath is being replaced a
    moment after this saves.
  */
  const [assign, setAssign] = useState(null);
  const [chosen, setChosen] = useState("");
  const [assignError, setAssignError] = useState("");
  const [saving, setSaving] = useState(false);
  /*
    One search box over the roster. The list is read whole and it is small, so typing filters
    what this page already holds rather than asking the server again.
  */
  const [find, setFind] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;

  /*
    An answer belongs to the community that was asked, so it is only ever shown for that
    one. Coming back to an earlier entry in the history, or a response that arrives after
    the community changed, leaves this page holding the other community's row and roster:
    both are checked against the id on screen, and a mismatch shows nothing rather than
    somebody else's members. The heading takes the name that was just read, so the list and
    the name above it cannot disagree.
  */
  const shown = community?.community_id === communityId ? community : null;
  const rows = roster.community_id === communityId ? roster.rows : [];
  /*
    The search works on what is already read: every word typed has to turn up in the row's
    name or surname, whatever the case, so "lerato", "mokoena" and "lerato m" all find the same
    person. An address is not in the haystack, because matching one would let the number of
    matches say whether some address belongs to this community.
  */
  const terms = find.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const listed = terms.length
    ? rows.filter((one) =>
        terms.every((term) =>
          `${one.name || ""} ${one.surname || ""}`.toLowerCase().includes(term),
        ),
      )
    : rows;

  // the three numbers shown above the table
  const adminCount = rows.filter((one) => one.role === "admin").length;
  const leaderCount = rows.filter((one) => one.role === "leader").length;
  const memberCount = rows.filter((one) => one.role === "member").length;

  // The row this browser's own address is in, and the one row with no menu on it.
  const mine = (admin.email || "").toLowerCase();
  // The person a removal was asked for belongs to the community that listed them.
  const target = confirm?.community_id === communityId ? confirm : null;
  // and so does the person a role is being chosen for.
  const person = assign?.community_id === communityId ? assign : null;
  const heading = { ...admin, name: shown?.name || admin.name };
  const { name: adminName, email: adminEmail } = heading;
  const joinCode = shown?.join_id || "";

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: adminName, email: adminEmail });
  }, [communityId, adminName, adminEmail]);

  function askRemove(row) {
    setMenuFor("");
    setConfirmError("");
    setConfirm({ ...row, community_id: communityId });
  }

  function closeConfirm() {
    if (removing) return;
    setConfirm(null);
  }

  function askAssign(row) {
    setMenuFor("");
    setAssignError("");
    setChosen(row.role);
    setAssign({ ...row, community_id: communityId });
  }

  function closeAssign() {
    if (saving) return;
    setAssign(null);
  }

  /*
    One click, one new role for one person in this community. The write is the server's:
    /api/admin has already shown the caller is an admin of this community before it let the
    popup open at all. The list is read again afterwards, so what the table shows is the role
    the row holds rather than the one that was typed. A refusal — an address that is not here,
    the community's only admin giving the role up — stays in the popup, where the choice was
    made.
  */
  async function saveRole() {
    setSaving(true);
    setAssignError("");
    try {
      const link = await dashboard.assignRole(communityId, person.email, chosen);
      setRoster({
        community_id: communityId,
        rows: await dashboard.getMembers(communityId),
      });
      setNote(
        `${person.name} ${person.surname} is now ${spoken(link.role)} of ${shown?.name || "this community"}.`,
      );
      setAssign(null);
    } catch (e) {
      setAssignError(e.message);
    } finally {
      setSaving(false);
    }
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
      const row = await dashboard.removeMember(communityId, target.email);
      setCommunity(row);
      setCopied(false);
      setRoster({ community_id: communityId, rows: await dashboard.getMembers(communityId) });
      // Take their serving row out of the same community too. They are already removed, so a
      // failure here is noted rather than allowed to undo the removal.
      let serving = "";
      try {
        await servings.removeRole({ email: target.email, community_id: communityId });
      } catch (e) {
        serving = ` Their serving row was not removed: ${e.message}`;
      }
      setNote(
        `${target.name} ${target.surname} is out of ${row.name}. Its join code is now ${row.join_id}, so tell everyone the new one.${serving}`,
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
      /*
        Nobody is thrown out of here. A null means this browser could not read its saved
        session, which is not a sign-out — only Log out in the menu leaves, and it says so
        itself. The page waits, then offers the way back in.
      */
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    Both reads describe the community that was chosen, and nothing else. They wait for the
    session: asking for the roster before anybody is known to be signed in used to fail
    with a token read off no-one, and the page then showed that instead of a list. The
    address, not the session object, is what the read waits on — Firebase hands out a new
    object for the same person every time it reloads the account, and the page would fetch
    again on each of those.
  */
  const email = signedIn?.email || "";
  useEffect(() => {
    if (!email || !communityId) return;
    dashboard
      .getCommunity(communityId)
      .then(setCommunity)
      .catch((e) => setError((current) => current || e.message));
    dashboard
      .getMembers(communityId)
      .then((people) => setRoster({ community_id: communityId, rows: people }))
      .catch((e) => setError((current) => current || e.message));
  }, [communityId, email]);

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

  // Escape leaves the role popup too, unless the write is still on its way.
  useEffect(() => {
    if (!assign) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !saving) setAssign(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assign, saving]);

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
          <AdminMenu state={heading} />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">Admin</p>
        {/*
          This page is about one community, so its name is the biggest thing here rather
          than a small label over the list. It is the name the card carried, or the one this
          page just read, whichever is known — the heading does not wait for the read.
        */}
        <h1 className="serif">{heading.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {/* The page-to-page buttons sit above everything else. This is a busy screen — a live
            check-in card, the admin's own attendance control, the roster, the join code — and
            needing to scroll past all of that to reach "View testimonies" made the buttons
            feel like they belonged to a page further down rather than this one. */}
        {communityId && (
          <div className="links">
            <button
              className="primary"
              type="button"
              onClick={() => navigate("/take-attendance", { state: { ...heading, role: "admin" } })}
            >
              Take attendance
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin-attendance", { state: heading })}
            >
              View attendance
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin-testimonies", { state: heading })}
            >
              View testimonies
            </button>
            <button
              type="button"
              onClick={() => navigate("/feedback/all", { state: { ...heading, role: "admin" } })}
            >
              Read feedback
            </button>
            <button
              type="button"
              onClick={() => navigate("/servings", { state: { ...heading, role: "admin" } })}
            >
              Servings
            </button>
            <button
              type="button"
              onClick={() => navigate("/functions", { state: { ...heading, role: "admin" } })}
            >
              Functions
            </button>
            {/* Planning a function and being invited to one are different buttons: the one above
                reads everybody's answers, this one is the admin's own standing under the plans that
                have not happened yet, exactly as a member sees them. */}
            <AvailableFunctions state={{ ...heading, role: "admin" }} />
          </div>
        )}

        {/* Attendance comes next: the notice (which carries its own PIN box) and the admin's own
            control sit above the roster and join code, so the whole picture of the room is the
            first real content here. */}
        {communityId && <SessionLive community_id={communityId} />}
        {communityId && <AttendanceControl community_id={communityId} admin />}

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
              <h3>
                Members
                {rows.length ? <span className="count">{rows.length}</span> : null}
              </h3>

              {rows.length ? (
                <div className="stats">
                  <div className="stat">
                    <div className="n">{memberCount}</div>
                    <div className="l">{memberCount === 1 ? "Member" : "Members"}</div>
                  </div>
                  <div className="stat">
                    <div className="n">{leaderCount}</div>
                    <div className="l">{leaderCount === 1 ? "Leader" : "Leaders"}</div>
                  </div>
                  <div className="stat">
                    <div className="n">{adminCount}</div>
                    <div className="l">{adminCount === 1 ? "Admin" : "Admins"}</div>
                  </div>
                </div>
              ) : null}

              {rows.length ? (
                <div className="find">
                  <input
                    type="search"
                    value={find}
                    placeholder="Search by name or surname"
                    aria-label="Search the members"
                    onChange={(event) => setFind(event.target.value)}
                  />
                  {terms.length ? (
                    <p className="tally">
                      {listed.length} of {rows.length}{" "}
                      {rows.length === 1 ? "person" : "people"} match.{" "}
                      <button className="clear" type="button" onClick={() => setFind("")}>
                        Clear
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : null}
              {listed.length ? (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Surname</th>
                        <th>Role</th>
                        <th className="last" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {listed.map((one) => (
                        <tr key={one.email}>
                          <td className="name">
                            <div className="who">
                              <span className="avatar" aria-hidden="true">
                                {(one.name || "?").charAt(0).toUpperCase()}
                              </span>
                              {one.name}
                            </div>
                          </td>
                          <td>{one.surname}</td>
                          <td>
                            <span
                              className={
                                one.role === "admin"
                                  ? "role admin"
                                  : one.role === "leader"
                                    ? "role leader"
                                    : "role"
                              }
                            >
                              {one.role}
                            </span>
                          </td>
                          <td className="last">
                            {/*
                              The signed-in address is listed like anybody else and offers
                              nothing: this page changes other people's roles and memberships, and
                              it is not the way an admin leaves a community or hands their own role
                              on.
                            */}
                            {one.email?.toLowerCase() === mine ? null : (
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
                                    <button className="plain" type="button" onClick={() => askAssign(one)}>
                                      Assign role
                                    </button>
                                    <button type="button" onClick={() => askRemove(one)}>
                                      Remove member
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : terms.length ? (
                !error && <p className="tally">Nobody here matches “{find.trim()}”.</p>
              ) : (
                !error && <LoadingBoxes count={5} words="Reading the people in this community…" />
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
                People type this code to find {shown?.name || "the community"}.
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
      </main>

      {target && (
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
                {target.name} {target.surname}
              </span>{" "}
              stops being a member of {shown?.name} — their role here is{" "}
              <span className="who">{target.role}</span>. Their attendance and testimonies
              stay recorded against them.
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

      {person && (
        <div
          className="veil"
          role="dialog"
          aria-modal="true"
          aria-label={`Assign a role to ${person.name} ${person.surname}`}
          onClick={closeAssign}
        >
          <div className="pop wide" onClick={(event) => event.stopPropagation()}>
            <h2 className="serif">Assign a role</h2>
            <p>
              <span className="who">
                {person.name} {person.surname}
              </span>{" "}
              is <span className="who">{person.role}</span> in{" "}
              {shown?.name || "this community"}. The choice takes effect as soon as it is saved.
            </p>

            <div className="roles">
              {ROLES.map((one) => (
                <label key={one.role} className={chosen === one.role ? "on" : undefined}>
                  <input
                    type="radio"
                    name="role"
                    value={one.role}
                    checked={chosen === one.role}
                    onChange={() => setChosen(one.role)}
                  />
                  <span className="what">
                    <b>{one.role}</b>
                    <span>{one.does}</span>
                  </span>
                </label>
              ))}
            </div>

            {assignError && <p className="fail">{assignError}</p>}

            <div className="row">
              <button className="ghost" type="button" onClick={closeAssign} disabled={saving}>
                Cancel
              </button>
              <button
                className="go"
                type="button"
                onClick={saveRole}
                disabled={saving || chosen === person.role}
              >
                {saving ? "Saving…" : "Save role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
