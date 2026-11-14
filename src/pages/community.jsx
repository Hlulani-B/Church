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
.au .card p{margin:0 0 16px;color:var(--muted);font-size:14px}
.au .badge{display:inline-block;border:1px solid #111;padding:2px 10px;font-size:12px;font-weight:600}

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

  // Placeholder. Fill this in later (for example, go to a create community page).
  function createCommunity() {}

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
          <button className="btn" type="button" onClick={createCommunity}>Create Community</button>
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
    </div>
  );
}