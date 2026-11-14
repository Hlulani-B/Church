import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { CommunityFetch } from "../page_functions/community.js";
import { UserFetch } from "../page_functions/user.js";
import Menu from "../components/menu.jsx";

const accounts = new Auth();
const users = new UserFetch();
const communities = new CommunityFetch();

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au.loading{display:block}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

/* top bar: menu button on the left, next to the name */
.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line);position:relative;z-index:10}
.au .bar .logo{font-size:24px;text-decoration:none}
.au .menuwrap{display:flex;align-items:center;position:relative}

/* dark section under the header */
.au .hero{background:linear-gradient(135deg,#5a5a5a 0%,#2a2a2a 100%);color:#fff}
.au .hero .inner{max-width:1000px;margin:0 auto;padding:72px 56px}
.au .hero h2{font-size:clamp(28px,4vw,42px);line-height:1.2;margin:0 0 14px;max-width:560px}
.au .hero h2 em{font-style:italic}
.au .hero p{color:#d0d0d0;max-width:460px;margin:0 0 28px}
.au .hero .btn{display:inline-block;background:#fff;color:#111;border:0;border-radius:2px;padding:13px 30px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}

/* main area */
.au .main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au .wave{display:block;margin:22px 0 8px}
.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:24px 0 0}

.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:44px 0 16px;font-weight:600}
.au .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.au .card{border:1px solid var(--line);border-radius:2px;padding:24px;background:#fff}
.au .card h4{font-size:20px;margin:0 0 6px;font-weight:500}
.au .card p{margin:0;color:var(--muted);font-size:14px}

/* create community popup */
.au .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.au .pop{background:#fff;border-radius:2px;width:100%;max-width:420px;padding:28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.au .pop h2{font-size:26px;margin:0 0 8px}
.au .pop .lead{color:var(--muted);font-size:15px;margin:0 0 20px}
.au .pop label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 6px}
.au .pop input{width:100%;border:1px solid var(--line);border-radius:2px;padding:11px 12px;font-size:16px;font-family:inherit;color:var(--text)}
.au .pop input:focus{outline:2px solid #111;outline-offset:1px}
.au .pop .fail{color:#a11111;font-size:14px;margin:14px 0 0}
.au .pop .row{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}
.au .pop .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:11px 20px;font-size:15px;font-family:inherit;cursor:pointer}
.au .pop .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .pop .go:disabled{opacity:.55;cursor:default}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:40px 24px 72px}
  .au h1{font-size:32px}
}
`;

export default function CommunityPage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(null);
  const [member, setMember] = useState(null);
  const [mine, setMine] = useState([]);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [saving, setSaving] = useState(false);
  const [popupError, setPopupError] = useState("");

  function closePopup() {
    setCreating(false);
    setCommunityName("");
    setPopupError("");
  }

  async function submitCommunity(event) {
    event.preventDefault();
    const name = communityName.trim();
    if (!name) {
      setPopupError("Give the community a name first.");
      return;
    }
    setSaving(true);
    setPopupError("");
    try {
      const created = await communities.createCommunity(name);
      closePopup();
      setNote(`“${created.name}” is open, and you are its admin.`);
    } catch (error) {
      setPopupError(error.message);
      return;
    } finally {
      setSaving(false);
    }
    communities.getCommunities().then(setMine).catch((error) => setNote(error.message));
  }

  useEffect(() => {
    return accounts.onChange((user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      setSignedIn(user);
      users
        .find()
        .then((row) => {
          setMember(row);
          if (!row) {
            setNote(
              "Your sign-in works, but the members table has no row for this address, so nothing is recorded against you yet.",
            );
          }
        })
        .catch((error) => setNote(error.message));
      communities
        .getCommunities()
        .then(setMine)
        .catch((error) => setNote((current) => current || error.message));
    });
  }, [navigate]);

  useEffect(() => {
    if (!creating) return undefined;
    function onKey(event) {
      if (event.key === "Escape") closePopup();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating]);

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

  const first = member?.name || signedIn.displayName?.split(" ")[0] || "there";

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
      </div>

      <section className="hero">
        <div className="inner">
          <h2 className="serif">Bring your fellowship <em>together.</em></h2>
          <p>Create a community to track attendance, understand why people miss, and keep every testimony.</p>
          <button className="btn" type="button" onClick={() => setCreating(true)}>Create Community</button>
        </div>
      </section>

      <main className="main">
        <h1 className="serif">Your <em>community</em></h1>
        <p className="sub">Good to see you, {first}.</p>
        <svg className="wave" width="120" height="14" viewBox="0 0 120 14" fill="none" stroke="#111" strokeWidth="1.2" aria-hidden="true">
          <path d="M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7" />
        </svg>

        {note && <div className="note">{note}</div>}

        <h3>Your communities</h3>
        {mine.length ? (
          <div className="cards">
            {mine.map((one) => (
              <div className="card" key={one.community_id}>
                <h4 className="serif">{one.name}</h4>
                <p>Community ID {one.community_id}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="sub">You are not in a community yet.</p>
        )}
      </main>

      {creating && (
        <div
          className="veil"
          role="dialog"
          aria-modal="true"
          aria-label="Create community"
          onClick={closePopup}
        >
          <div className="pop" onClick={(event) => event.stopPropagation()}>
            <h2 className="serif">Create Community</h2>
            <p className="lead">
              A community keeps its own fellowship list, attendance and testimonies. You
              will be its admin.
            </p>
            <form onSubmit={submitCommunity}>
              <label htmlFor="community-name">Community name</label>
              <input
                id="community-name"
                value={communityName}
                onChange={(event) => setCommunityName(event.target.value)}
                placeholder="e.g. Kopano Youth Fellowship"
                maxLength={80}
                autoFocus
              />
              {popupError && <p className="fail">{popupError}</p>}
              <div className="row">
                <button className="ghost" type="button" onClick={closePopup}>
                  Cancel
                </button>
                <button className="go" type="submit" disabled={saving}>
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}