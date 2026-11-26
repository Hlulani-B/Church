import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { UserFetch } from "../page_functions/user.js";
import { CommunityFetch } from "../page_functions/community.js";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import BackToCommunities from "../components/back.jsx";

const accounts = new Auth();
const users = new UserFetch();
const groups = new CommunityFetch();

// Which dashboard each community_members role opens. The /community page navigates by
// asking the server for the caller's role in that community; here the role is already
// on the row `memberOf` returned, so a click does not need a round trip first.
const DASHBOARDS = {
  admin: "/admin-dashboard",
  leader: "/leader-dashboard",
  member: "/member-dashboard",
};

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:1px solid var(--line);font-size:14px}
.au .bar .logo{font-size:22px;text-decoration:none}

.au .doc{max-width:680px;margin:0 auto;padding:56px 24px 80px}
.au h1{font-size:36px;line-height:1.2;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au p{color:#333;margin:0 0 12px}
.au .sub{color:var(--muted)}

.au h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:22px;margin:56px 0 6px;padding-top:28px;border-top:1px solid var(--line)}
.au h2 + p{color:var(--muted);font-size:14px;margin:0 0 20px}

.au .field{margin:28px 0 16px}
.au label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.au input[type="text"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.au input[type="text"]:focus{outline:none;border-color:#111}
.au .email{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;background:#f4f4f4;color:var(--muted)}
.au .hint{font-size:13px;color:var(--muted);margin:6px 0 0}

.au .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:#111;color:#fff;border:1px solid #111}
.au .btn:disabled{opacity:.55;cursor:not-allowed}
.au .btn.ghost{background:#fff;color:#111}
.au .error,.au .saved{border-left:3px solid #111;padding:10px 14px;font-size:14px;margin:20px 0 0}
.au .saved{background:#f4f4f4}
.au .error{background:#f4f4f4;border-left-color:#111}

.au .communities{display:flex;flex-direction:column;gap:10px;margin:20px 0 0}
.au .community{display:flex;align-items:baseline;justify-content:space-between;gap:14px;width:100%;text-align:left;padding:14px 18px;border:1px solid var(--line);border-radius:2px;background:#fff;cursor:pointer;font:inherit;color:inherit}
.au .community:hover{border-color:#111}
.au .community .n{font-weight:600}
.au .community .r{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 10px;white-space:nowrap}
.au .empty{border:1px dashed var(--line);border-radius:2px;padding:16px 18px;font-size:14px;color:var(--muted);margin:20px 0 0}

.au .row{display:flex;gap:10px;margin:14px 0 0}
.au .row .btn{width:auto;flex:1}
`;

export default function ProfilePage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [member, setMember] = useState(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [communities, setCommunities] = useState([]);
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false);

  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    return accounts.onChange((user) => {
      /*
        A null here means this browser could not read its saved session, which is not a
        sign-out, so the page keeps the person where they are instead of sending them off.
        Log out in the menu is the only thing that leaves.
      */
      setSignedIn(user || null);
      setNoSession(!user);
      if (!user) return;
      users.find()
        .then((row) => {
          setMember(row);
          if (row) {
            setName(row.name || "");
            setSurname(row.surname || "");
          }
        })
        .catch((fetchError) => setError(fetchError.message));
      groups
        .getCommunities()
        .then((rows) => setCommunities(Array.isArray(rows) ? rows : []))
        .catch(() => {
          /* A failed read here is about the sidebar below, not about the person's name.
             The list just says "could not read" instead of pretending there are none. */
          setCommunities(null);
        })
        .finally(() => setCommunitiesLoaded(true));
    });
  }, []);

  const dirty = name !== (member?.name || "") || surname !== (member?.surname || "");
  const canSave = Boolean(member) && !busy && dirty && name.trim() && surname.trim();

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const row = await users.update({ name, surname });
      setMember(row);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setResetBusy(true);
    setResetSent("");
    setResetError("");
    try {
      const to = await accounts.resetPassword();
      setResetSent(to);
    } catch (err) {
      setResetError(err?.message || "The reset email could not be sent.");
    } finally {
      setResetBusy(false);
    }
  }

  function openCommunity(one) {
    const to = DASHBOARDS[one.role];
    if (!to) return;
    navigate(to, {
      state: { community_id: one.community_id, name: one.name, email: signedIn.email },
    });
  }

  // The communities this address belongs to, a chunk of them at a time like every other list.
  const joined = usePager(communities ?? [], PER_PAGE);

  if (!signedIn) {
    return (
      <div className="au">
        <style>{css}</style>
        <article className="doc">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing to change here.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
        </article>
      </div>
    );
  }

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <a className="logo serif" href="/community">Kopano</a>
        <Menu />
        <BackToCommunities />
      </div>

      <article className="doc">
        <h1 className="serif">Your <em>profile</em></h1>
        <p className="sub">Only your name and surname are yours to change.</p>

        {error && <div className="error">{error}</div>}
        {!member && !error && (
          <div className="error">
            No member row for {signedIn.email} yet, so there is nothing to edit.
          </div>
        )}

        {member && (
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                required
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="surname">Surname</label>
              <input
                id="surname"
                type="text"
                required
                autoComplete="family-name"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="email" id="email" type="text" value={member.email} readOnly />
              <p className="hint">
                Your email address is how your attendance and testimonies are linked to you, so
                it cannot be changed here. Ask a leader if it is wrong.
              </p>
            </div>

            <button className="btn" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : "Save changes"}
            </button>

            {saved && <div className="saved">Saved.</div>}
          </form>
        )}

        {/*
          Two things a signed-in person actually comes here for, once they have changed
          their name: getting a reset link because they have since forgotten the password
          again, and moving between the fellowships they belong to. Both used to mean
          signing out and starting over from /login or /community.
        */}
        <h2 className="serif">Password</h2>
        <p>Sends a reset link to {signedIn.email}. Nothing changes until you use it.</p>
        <button className="btn ghost" type="button" onClick={sendReset} disabled={resetBusy}>
          {resetBusy ? "Sending…" : "Send me a reset link"}
        </button>
        {resetSent && <div className="saved">Check {resetSent} for the message.</div>}
        {resetError && <div className="error">{resetError}</div>}

        <h2 className="serif">Your communities</h2>
        <p>
          Every fellowship this address belongs to. A click opens whichever dashboard your role
          in that community is the one for.
        </p>

        {!communitiesLoaded && (
          <LoadingBoxes count={2} words="Reading the communities you belong to…" />
        )}
        {communitiesLoaded && communities === null && (
          <div className="empty">
            The list did not come back. It will be there again the next time this page loads;
            in the meantime <a href="/community">/community</a> is the same set of cards.
          </div>
        )}
        {communitiesLoaded && Array.isArray(communities) && communities.length === 0 && (
          <div className="empty">
            Not in a community yet. <a href="/community">Join by code or start one</a> and
            it will be listed here.
          </div>
        )}
        {communitiesLoaded && Array.isArray(communities) && communities.length > 0 && (
          <div className="communities" id={joined.anchorId}>
            {joined.chunk.map((one) => (
              <button
                key={one.community_id}
                type="button"
                className="community"
                onClick={() => openCommunity(one)}
              >
                <span className="n">{one.name || "This community"}</span>
                <span className="r">{one.role || "member"}</span>
              </button>
            ))}
          </div>
        )}
        <Pager state={joined} noun={joined.total === 1 ? "community" : "communities"} />

        <h2 className="serif">Anything to say about the app?</h2>
        <p>
          Five short questions, signed with the address you signed in with and stored that way —
          never printed next to your words. It goes to whoever runs Kopano, not to your fellowship.
        </p>
        <div className="row">
          <button className="btn" type="button" onClick={() => navigate("/feedback")}>
            Open feedback
          </button>
        </div>
      </article>
    </div>
  );
}
