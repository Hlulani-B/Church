import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";
import { pretty } from "../components/view_functions.jsx";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const functions = new ChurchFunctionsFetch();

/*
  What is still to come in this community, and the only way a plain member reaches a function. Every
  dashboard carries the button that opens this page, and the list underneath is deliberately short:
  the functions whose day has not gone by, soonest first, in this community and nobody else's. A day
  that has passed drops off rather than sitting there greyed, because there is nothing left to do
  about a function that has already happened, and the register a leader reads is the place history is
  kept.

  Nothing here counts people. Who is coming and who has paid is a leader's read at /api/leader; this
  page asks one question of one person, and the answer to it is what opening a row goes to write.
  The read itself goes to /api/self, which is why no role is checked on the way in — belonging to the
  community is the whole requirement, and the server settles that off the token rather than off
  anything this page claims.
*/

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

.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:40px 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.au h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}

.av .tablewrap{border:1px solid var(--line);border-radius:2px;overflow-x:auto;margin-top:14px}
.av table{width:100%;border-collapse:collapse;font-size:15px}
.av th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid var(--line)}
.av td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.av tbody tr:last-child td{border-bottom:0}
.av tbody tr:hover td{background:#fafafa}
.av .free{color:var(--muted)}
.av .hint{font-size:13px;color:var(--muted);margin:14px 0 0}
.av .answer{width:1%;white-space:nowrap}

/* The name of the function is the thing a person recognises, so it is the second way into it — a
   heading, not a decoration, and it goes to exactly the same place the button in the last column
   does. */
.av .name button{background:none;border:0;padding:0;font:inherit;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;text-align:left;border-bottom:1px solid var(--line)}
.av .name button:hover{border-bottom-color:#111}

.av .answer button{background:#111;color:#fff;border:1px solid #111;border-radius:2px;padding:8px 16px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.av .answer button:hover{background:#333;border-color:#333}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
}

/* Four columns will not sit side by side on a phone, so the list becomes one card per function and
   every cell reads its own heading — the move the register and the opened-out function both make. */
@media (max-width:640px){
  .av .tablewrap{border:0;overflow-x:visible}
  .av table,.av tbody{display:block}
  .av thead{display:none}
  .av tr{display:block;border:1px solid var(--line);border-radius:2px;margin:0 0 10px}
  .av tr:last-child{margin-bottom:0}
  .av td{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f0f0f0}
  .av td:last-child{border-bottom:0}
  .av tbody tr:last-child td{border-bottom:1px solid #f0f0f0}
  .av tr:last-child td:last-child{border-bottom:0}
  .av td::before{content:attr(data-label);flex:none;width:72px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
  .av td>*,.av td{min-width:0;overflow-wrap:anywhere}
  /* The 1% that keeps the RSVP column narrow in the table is a handful of pixels in a card, so it
     goes with the table; the button takes its own width back and holds its words on one line. */
  .av td.answer{width:auto}
  .av td.answer button{flex:none;width:auto;min-width:0;white-space:nowrap;overflow-wrap:normal;padding:12px 18px;font-size:15px}
}
`;

// A price, in words, or the plain word for there not being one. Said rather than styled because a
// person scanning this list is deciding whether they can afford to come.
function cost(one) {
  if (!one.requires_payment) return <span className="free">Free</span>;
  const amount = Number(one.amount);
  return Number.isFinite(amount) ? `R ${amount.toFixed(2)}` : <span className="free">—</span>;
}

export default function AvailableFunctionsPage() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  // null until the first read lands, so an empty community and a read still in flight are not the
  // same screen.
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: admin.name, email: admin.email });
  }, [communityId, admin.name, admin.email]);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    The list is read for the community this page was opened on, and only kept if the answer is about
    that same community: a person who moves between two fellowships quickly could otherwise be shown
    the first one's plans under the second one's name.
  */
  useEffect(() => {
    if (!communityId) return;
    let live = true;
    functions
      .getAvailableFunctions(communityId)
      .then((list) => {
        if (!live) return;
        setRows({ community_id: communityId, list: list || [] });
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setRows(null);
        setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [communityId]);

  const listed = rows?.community_id === communityId ? rows.list : [];
  // Nothing for this community has arrived yet — either the first read is still out, or the person
  // moved to a second fellowship and the old one's list is being kept only until the new answer
  // comes. Both are "reading", and neither is the same sentence as "nothing is planned".
  const reading = rows === null || rows.community_id !== communityId;

  /*
    Opening one invitation goes to the RSVP page for this community and this function, and takes this
    page's own role along: the RSVP page has to be able to hand the reader back to the dashboard that
    started the detour, and only the screen that made the jump knows which of the three it was.
  */
  function openRsvp(one) {
    navigate("/rsvp", { state: { ...admin, function_id: one.id, role: route?.role } });
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
        {route?.role ? (
          <BackToDashboard role={route.role} state={admin} />
        ) : (
          <BackToCommunities />
        )}
      </div>

      <main className="main">
        <p className="eyebrow">Available functions</p>
        <h1 className="serif">{admin.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to answer here. Go back, click a community
            and open its dashboard.
          </div>
        ) : (
          <section className="av">
            <h3>
              Still to come
              {listed.length ? <span className="count">{listed.length}</span> : null}
            </h3>

            {error && <div className="note bad">{error}</div>}

            {listed.length ? (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Function</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Cost</th>
                      <th className="answer">Your answer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listed.map((one) => (
                      <tr key={one.id}>
                        <td className="name" data-label="Function">
                          <button type="button" onClick={() => openRsvp(one)}>
                            {one.name}
                          </button>
                        </td>
                        <td data-label="Date">{pretty(one.function_date)}</td>
                        <td data-label="Location">{one.location || <span className="free">—</span>}</td>
                        <td data-label="Cost">{cost(one)}</td>
                        <td className="answer" data-label="Your answer">
                          <button type="button" onClick={() => openRsvp(one)}>
                            RSVP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !error &&
              (reading ? (
                <LoadingBoxes words="Reading what is still to come…" />
              ) : (
                <p className="sub">
                  Nothing is planned in this community that has not already happened.
                </p>
              ))
            )}

            <p className="hint">
              {listed.length
                ? `${listed.length} ${
                    listed.length === 1 ? "function is" : "functions are"
                  } still to come, soonest first. Opening one tells the fellowship whether you are coming and, when money is asked for, what you have done about it.`
                : "A function is planned by a leader or an admin, and it appears here once its day has not gone by."}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
