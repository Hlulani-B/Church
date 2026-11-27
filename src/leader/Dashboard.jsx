import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import { CommunityFetch } from "../page_functions/community.js";
import { heroStyle, pictureUrl } from "../page_functions/picture.js";
import LeaderMenu from "./menu.jsx";
import BackToCommunities from "../components/back.jsx";
import AttendanceControl from "../components/attendance_control.jsx";
import SessionLive from "../components/session_live.jsx";
import AvailableFunctions from "../components/available_functions.jsx";
import ExtraMembers from "../components/extra_members.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const dashboard = new AdminDashboardFetch();
const fellowships = new CommunityFetch();

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

/*
  The band the admin dashboard opens with, so a leader stands in the same fellowship their admin does:
  the width of the window rather than the width of the column, the community's own picture behind it,
  and the words lined up with everything underneath by the same measure and padding .main carries. The
  white laid from the left is what keeps it readable — every word here would otherwise be dark on top
  of a photograph somebody chose themselves — and the right of the picture still comes through nearly
  whole. With no picture saved none of this happens and the plain band shows.
*/
.au .hero{background:#faf9f7;background-size:cover;background-position:center;border-bottom:1px solid var(--line)}
.au .hero.picture{position:relative}
.au .hero.picture::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.75) 45%,rgba(255,255,255,.25) 100%)}
.au .hero .inner{position:relative;z-index:1;max-width:1000px;width:100%;margin:0 auto;padding:56px 56px 48px}

.au .main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}
.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:48px 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.au h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}

/* three ways out of the roster, with taking attendance as the main action.
   Solid grounds and a shadow, both: the row sits over a photograph now, and a button that let the
   picture through behind it would be a label nobody could read at a glance. */
.au .links{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0 0}
.au .links button{background:#ffffff;color:#111;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(17,17,17,.12)}
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


@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au .hero .inner{padding:32px 24px 36px}
  .au h1{font-size:32px}
  .au .stats{grid-template-columns:1fr}
  .au td,.au th{font-size:14px;padding:10px 12px}
}
`;

export default function LeaderDashboard() {
  const navigate = useNavigate();
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
    The name above the list is the one the card carried. This page does not read the whole community
    row: that row carries the join code, and a code is an admin's to see. So a leader who arrives here
    without a name on the link — a bookmark, a reload after the storage was cleared — is shown the
    address they signed in with and the list, and nothing is invented for the heading.
  */
  const heading = admin;
  const { name: leaderName, email: leaderEmail } = heading;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: leaderName, email: leaderEmail });
  }, [communityId, leaderName, leaderEmail]);

  /*
    The band of picture the admin dashboard opens with, which is what Community settings paints and
    what a leader was until now the only one not to see. It comes off the caller's own list of
    fellowships rather than off the community row, because that list carries name and picture for the
    groups this address belongs to and no others, and answers to a member or a leader as it stands. A
    community with nothing saved, or with something in the column that is not an http address, leaves
    the plain band — the same banner minus the photograph, checked by pictureUrl on the way in.
  */
  const [picture, setPicture] = useState("");
  useEffect(() => {
    if (!communityId) return;
    let alive = true;
    fellowships
      .getCommunities()
      .then((groups) => {
        if (!alive) return;
        const one = (groups || []).find((each) => each.community_id === communityId);
        setPicture(pictureUrl(one?.picture));
      })
      // A banner that will not read is no banner at all; the roster underneath is this page's work.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [communityId]);

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
  /*
    The roster is a chunk at a time, so a community of two hundred names cannot push the rest of this
    page off the screen. The search above still answers for every match it found; only the printing
    is cut, and the line under the table says which of how many is on the screen.
  */
  const people = usePager(listed, PER_PAGE, `${communityId}|${find}`);

  // the three numbers shown above the table
  const adminCount = rows.filter((one) => one.role === "admin").length;
  const leaderCount = rows.filter((one) => one.role === "leader").length;
  const memberCount = rows.filter((one) => one.role === "member").length;

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
        <BackToCommunities />
      </div>

      {/*
        The fellowship's own banner, from the top bar down past the buttons and no further: the
        attendance control and the roster underneath start on white again. What is painted behind it is
        the address Community settings saved, checked before it is used as a background, so a value that
        is not a real picture leaves the plain band rather than a broken one.
      */}
      <section className={`hero${picture ? " picture" : ""}`} style={heroStyle(picture)}>
        <div className="inner">
          <p className="eyebrow">Leader</p>
          <h1 className="serif">{heading.name || "This community"}</h1>
          <p className="sub">{admin.email}</p>

          {/* The page-to-page buttons come first, and they come first inside the banner the way they
              do on the admin's screen. Attendance and the roster below get long, and a leader who
              wants to leave this page should not have to scroll past either to find the way out. */}
          {communityId && (
            <div className="links">
              <button
                className="primary"
                type="button"
                onClick={() => navigate("/take-attendance", { state: { ...heading, role: "leader" } })}
              >
                Take attendance
              </button>
              <button
                type="button"
                onClick={() => navigate("/leader-attendance", { state: heading })}
              >
                View attendance
              </button>
              <button
                type="button"
                onClick={() => navigate("/leader-testimonies", { state: heading })}
              >
                View testimonies
              </button>
              <button
                type="button"
                onClick={() => navigate("/prayer-topics", { state: { ...heading, role: "leader" } })}
              >
                Prayer topics
              </button>
              <button
                type="button"
                onClick={() => navigate("/servings", { state: { ...heading, role: "leader" } })}
              >
                Servings
              </button>
              <button
                type="button"
                onClick={() => navigate("/functions", { state: { ...heading, role: "leader" } })}
              >
                Functions
              </button>
              {/* A leader is invited to a function the same way a member is, and answers it the same
                  way. This button goes to the list of what is still to come; the Functions button
                  above it is the register, where the answers being read are everybody else's. */}
              <AvailableFunctions state={{ ...heading, role: "leader" }} />
            </div>
          )}
        </div>
      </section>

      <main className="main">
        {/* Attendance comes next: the notice (which carries its own PIN box) and the leader's own
            control sit above the roster, so a leader sees a gathering being counted the moment
            the page opens rather than after the people list. */}
        {communityId && <SessionLive community_id={communityId} />}
        {communityId && <AttendanceControl community_id={communityId} admin={false} />}

        {error && <div className="note bad">{error}</div>}

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to open here. Go back, click a
            community, and its people and its attendance open on these pages.
          </div>
        ) : (
          <>
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
              <div className="tablewrap" id={people.anchorId}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Surname</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.chunk.map((one) => (
                      // The address stays as the row's identity — for React, and for the
                      // read that follows when a role is chosen or somebody is taken out.
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
            {listed.length ? <Pager state={people} noun={rows.length === 1 ? "person" : "people"} /> : null}
            <p className="tally">
              {rows.length
                ? `${rows.length} ${rows.length === 1 ? "person" : "people"} in ${
                    heading.name || "this community"
                  }. A leader reads this list: only an admin gives a role, takes somebody out or draws a new join code.`
                : ""}
            </p>
          </section>

          {/* Only the roster of the people who never joined lives here, beside the real members it
              mirrors. Their attendance is kept on the attendance page and their servings on the
              servings page, each where the matching feature already lives. */}
          <ExtraMembers communityId={communityId} email={email} />
          </>
        )}
      </main>
    </div>
  );
}