import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import Menu from "../components/menu.jsx";

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
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:32px 0 0}
.au .back{display:inline-block;margin:32px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:40px 24px 72px}
  .au h1{font-size:32px}
}
`;

export default function MemberDashboard() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(null);

  useEffect(() => {
    return accounts.onChange((user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      setSignedIn(user);
    });
  }, [navigate]);

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
        <h1 className="serif">Member <em>dashboard</em></h1>
        <p className="sub">{signedIn.email}</p>
        <div className="note">
          Empty for now. This is where you mark your availability for Sunday and log what
          God has done in your life this week.
        </div>
        <a className="back" href="/community">Back to your communities</a>
      </main>
    </div>
  );
}
