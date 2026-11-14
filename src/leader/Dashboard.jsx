import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import LeaderMenu from "./menu.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

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

.au .main{padding:56px 56px 96px;max-width:1100px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 14px;font-weight:600}

/* One box over the list, and it filters what this page already holds: a name, a surname,
   an address, or any words from more than one of them. */
.au .find{margin:0 0 6px}
.au .find input{width:100%;max-width:460px;font:inherit;font-size:16px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:11px 14px}
.au .find input:focus{outline:none;border-color:#111}
.au .clear{background:none;border:0;padding:0;font:inherit;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:1px solid var(--line)}
.au .clear:hover{color:#111;border-bottom-color:#111}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au table{width:100%;border-collapse:collapse;margin-top:8px;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0 12px 8px 0;border-bottom:1px solid var(--line)}
.au td{padding:11px 12px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.au td.name{font-weight:500}
.au .role{display:inline-block;border:1px solid var(--line);padding:1px 9px;font-size:12px;font-weight:600;text-transform:capitalize}
.au .role.admin{border-color:#111;background:#111;color:#fff}
.au .tally{font-size:14px;color:var(--muted);margin:14px 0 0}

.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au td,.au th{font-size:14px}
}
`;

export default function LeaderDashboard() {
  /*
    Which community this page is about and whose address opened it. The card on /community
    hands both over, and src/admin/state.js fills in whatever the link did not carry from the
    last community this browser opened — so a reload, a bookmark or the back button lands on
    this community rather than on an empty page.
  */
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [roster, setRoster] = useState({ community_id: "", rows: [] });
  const [error, setError] = useState("");
  /*
    One search box over the roster. The list is read whole and it is small, so typing filters
    what this page already holds rather than asking the server again.
  */
  const [find, setFind] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;

  /*
    The name above the list is the one the card carried. This page does not read the community
    row itself: that read answers with the join code, and a code is an admin's to see. So a
    leader who arrives here without a name on the link — a bookmark, a reload after the
    storage was cleared — is shown the address they signed in with and the list, and nothing
    is invented for the heading.
  */
  const heading = admin;
  const { name: leaderName, email: leaderEmail } = heading;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: leaderName, email: leaderEmail });
  }, [communityId, leaderName, leaderEmail]);

  useEffect(() => {
    return accounts.onChange((user) => {
      /*
        Nobody is thrown out of here. A null means this browser could not read its saved
        session, which is not a sign-out — only Log out in the menu leaves. The page waits,
        then offers the way back in.
      */
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    The read waits for a person to be signed in and for the community they came from, and it
    waits on the address rather than the session object: Firebase re-reports the same person
    whenever it reloads their account, and the page would read again on each one. The answer is
    tagged with the community it was read for, and only a tag matching the community on screen
    is listed — a response that arrives after the community changed shows nothing rather than
    somebody else's members.
  */
  const email = signedIn?.email || "";
  useEffect(() => {
    if (!email || !communityId) return;
    dashboard
      .getMembers(communityId)
      .then((people) => {
        setRoster({ community_id: communityId, rows: people });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [communityId, email]);

  const rows = roster.community_id === communityId ? roster.rows : [];
  /*
    The search works on what is already read: every word typed has to turn up in the row's
    name, surname or address, whatever the case, so "thabo", "mokoena", "thabo m" and
    "gmail" all find the same person.
  */
  const terms = find.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const listed = terms.length
    ? rows.filter((one) =>
        terms.every((term) =>
          `${one.name || ""} ${one.surname || ""} ${one.email || ""}`
            .toLowerCase()
            .includes(term),
        ),
      )
    : rows;

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
          <LeaderMenu state={heading} />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
      </div>

      <main className="main">
        <p className="eyebrow">Leader</p>
        <h1 className="serif">{heading.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {error && <div className="note bad">{error}</div>}

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to open here. Go back, click a
            community, and its people and its attendance open on these pages.
          </div>
        ) : (
          <section className="roster">
            <h3>Members</h3>
            {rows.length ? (
              <div className="find">
                <input
                  type="search"
                  value={find}
                  placeholder="Search by name, surname or email"
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
                  {listed.map((one) => (
                    <tr key={one.email}>
                      <td className="name">{one.name}</td>
                      <td>{one.surname}</td>
                      <td>{one.email}</td>
                      <td>
                        <span className={one.role === "admin" ? "role admin" : "role"}>
                          {one.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : terms.length ? (
              !error && <p className="tally">Nobody here matches “{find.trim()}”.</p>
            ) : (
              !error && <p className="sub">Loading…</p>
            )}
            <p className="tally">
              {rows.length
                ? `${rows.length} ${rows.length === 1 ? "person" : "people"} in ${
                    heading.name || "this community"
                  }. A leader reads this list: only an admin gives a role, takes somebody out or draws a new join code.`
                : ""}
            </p>
          </section>
        )}

        <a className="back" href="/community">Back to your communities</a>
      </main>
    </div>
  );
}
