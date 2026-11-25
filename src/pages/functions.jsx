import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";
import CreateFunction from "../components/create_function.jsx";
import ViewFunctions, { pretty } from "../components/view_functions.jsx";
import IndividualFunction from "../components/individual_function.jsx";
import Menu from "../components/menu.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const functions = new ChurchFunctionsFetch();

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

/* the one action on this page sits above the list, where it is the first thing a leader sees */
.au .links{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0 0}
.au .links button{background:#111;color:#fff;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .links button:hover{background:#333;border-color:#333}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
}
`;

// The day as the community says it lives in view_functions.jsx, next to the register that prints it,
// and the page imports it for the one sentence it writes after a function is planned.

export default function FunctionsPage() {
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [note, setNote] = useState("");
  const [popup, setPopup] = useState(false);
  // Which function this page is showing opened out, and how many times the list has been re-read.
  // Both are the page's business rather than the register's: the list is what Back returns to, and
  // the re-read is what a freshly planned function arrives on.
  const [chosen, setChosen] = useState(null);
  const [reload, setReload] = useState(0);

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  /*
    Planning is offered to the roles this page is reached from. It is not a permission — /api/leader
    refuses a plain member whatever the screen says — so a blank here is only the absence of an
    invitation, and the button never appears on a link that did not name a role.
  */
  const canPlan = route?.role === "admin" || route?.role === "leader";

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
    The register reads itself, in view_functions.jsx, off the community_id and the reload count held
    here. Coming back from an opened function remounts it, so the list is read again rather than
    shown from whatever was fetched before the detour — which is the point of a page whose rows are
    counts of other people's answers.
  */
  async function onCreate(values) {
    const created = await functions.createFunction({ community_id: communityId, ...values });
    // The list is only re-read once the write has come back, so a refused function cannot leave
    // a row on the screen that is not in the table.
    setPopup(false);
    setNote(`“${created.name}” is planned for ${pretty(created.function_date)}.`);
    setReload((count) => count + 1);
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
        {/* The register and a function opened out of it share this page, so this is the way back to
            whichever dashboard opened it for either of them. */}
        {route?.role ? (
          <BackToDashboard role={route.role} state={admin} />
        ) : (
          <BackToCommunities />
        )}
      </div>

      <main className="main">
        {chosen ? (
          /*
            One function opened out takes the whole page, heading and all: its own name is the thing
            being read, and a community heading over the top of it would be the wrong h1. The key is
            what makes it a fresh read and a fresh set of open sections rather than the previous
            function's state wearing a new id. Back puts the register and the Create button where they
            were.
          */
          <IndividualFunction
            key={chosen.id}
            community_id={communityId}
            function_id={chosen.id}
            email={admin.email}
            onBack={() => setChosen(null)}
          />
        ) : (
          <>
            <p className="eyebrow">Functions</p>
            <h1 className="serif">{admin.name || "This community"}</h1>
            <p className="sub">{admin.email}</p>

            {canPlan && communityId && (
              <div className="links">
                <button type="button" onClick={() => setPopup(true)}>
                  Create function
                </button>
              </div>
            )}

            {note && <div className="note">{note}</div>}

            {!communityId ? (
              <div className="note">
                No community was chosen, so there is nothing to plan here. Go back, click a community
                and open its functions from the dashboard.
              </div>
            ) : (
              <ViewFunctions
                community_id={communityId}
                reload={reload}
                onOpen={(row) => setChosen(row)}
              />
            )}
          </>
        )}
      </main>

      {popup && (
        <CreateFunction
          onCancel={() => setPopup(false)}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}
