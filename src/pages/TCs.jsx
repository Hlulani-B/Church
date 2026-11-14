import React from "react";

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
.au h1{font-size:36px;line-height:1.2;margin:0 0 12px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au h3{font-size:18px;margin:32px 0 6px;font-weight:600}
.au p,.au li{color:#333}
.au ul{padding-left:20px;margin:8px 0}
.au .updated{color:var(--muted);font-size:14px}
.au .wave{display:block;margin:20px 0 8px}
.au .next{display:block;width:100%;margin-top:40px;padding:13px 16px;background:#111;color:#fff;border:1px solid #111;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
`;

export default function TermsPage() {
  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <a className="logo serif" href="/login">Kopano</a>
      </div>

      <article className="doc">
        <h1 className="serif">Terms and <em>Conditions</em></h1>
        <p className="updated">Please read this before you create an account.</p>
        <svg className="wave" width="120" height="14" viewBox="0 0 120 14" fill="none" stroke="#111" strokeWidth="1.2" aria-hidden="true">
          <path d="M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7" />
        </svg>

        <h3>What we collect</h3>
        <p>The only personal information Kopano takes from you is:</p>
        <ul>
          <li>your name</li>
          <li>your surname</li>
          <li>your email address</li>
        </ul>
        <p>
          If you sign up with Google, we receive your name and email address from your Google account, and nothing else.
          If you sign up with email, you also choose a password. Your password is handled by Firebase Authentication,
          which keeps it secure. We cannot see it.
        </p>

        <h3>Why we collect it</h3>
        <p>
          We use these details to create your account, to let you log in, and to link your attendance and testimonies
          to you so your fellowship can care for you well.
        </p>

        <h3>Who can see it</h3>
        <p>
          Leaders of your fellowship can see your name and email so they can follow up with you. We do not sell your
          information or share it with advertisers.
        </p>

        <h3>On your device</h3>
        <p>Your email address is kept in your browser's local storage so the app can recognise you when you return.</p>

        <h3>Your choices</h3>
        <p>You can ask your fellowship leaders to delete your account and the details we hold about you at any time.</p>

        <h3>Changes</h3>
        <p>We may update these terms. If we do, we will change this page.</p>

        <button className="next" type="button" onClick={() => (window.location.href = "/signup")}>
          Back
        </button>
      </article>
    </div>
  );
}