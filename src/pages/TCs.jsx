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
.au strong{font-weight:600;color:var(--text)}
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
          We use these details to create your account, to let you log in, and to link your attendance and your
          testimonies to you so your fellowship can care for you well. Your email address is that link, and it is used
          for nothing else. The only messages sent to it are about your own account — a verification note when you
          sign up, and a reset link when you ask for one. There is no newsletter and no marketing.
        </p>

        <h3>Your email address is never shared</h3>
        <p>
          The only address any Kopano screen will ever show you is <strong>your own</strong>. Every other member of a
          fellowship is a name and a surname — in the roster, on an attendance register, beside a serving, in a
          function list, in feedback, and in every list a leader or an admin downloads. We do not sell your
          information, we do not share it with advertisers, and we do not hand anybody a mailing list of the community.
        </p>
        <p>
          Your address still does the quiet work underneath — it is how a row knows whose it is, and how a sign-in
          finds your own testimonies again — but it is never how one person is presented to another.
        </p>

        <h3>Your testimonies are sealed</h3>
        <p>
          When you share a testimony in words, the app encrypts it <strong>in your browser, before it is stored</strong>,
          and it encrypts the email address that shared it in the same step. Each is sealed with its own random
          initial value, so two testimonies from the same person do not even look alike.
        </p>
        <p>
          That means a testimony cannot be traced back to an email address in the database: what is kept there is
          unreadable text on both sides of the row, and a register of who shared what cannot be assembled from it.
          The words are turned back into sentences only in the browser of somebody allowed to read them, and that
          happens after the row has arrived on their screen.
        </p>
        <p>
          A testimony you share as a photo, a PDF or a document is kept as that file rather than as sealed writing,
          and the address that shared it is encrypted all the same. Anyone reading a testimony sees the person as a
          name and a surname — a leader or an admin included.
        </p>

        <h3>You choose who reads each testimony</h3>
        <p>
          As you save one, the app asks you once: <em>Allow everybody to read this?</em> Say yes and anyone in your
          fellowship can read it. Say no and you name the readers by picking their names; the testimony then reaches
          nobody else. <strong>A leader's or an admin's role is not a key to it</strong> — they are held to the same
          list as everybody else.
        </p>
        <p>
          You can change that decision later on the testimony itself, under "update who can see", and the change
          takes effect the next time anyone opens the list.
        </p>

        <h3>What a leader or an admin can see</h3>
        <ul>
          <li>your name, your surname, and the role you hold in the community</li>
          <li>whether you were present at a gathering, and any apology you sent for missing one</li>
          <li>the servings you are listed under, and the dates connected with them</li>
          <li>the answers you gave for a function, and the testimonies you allowed them to read</li>
        </ul>

        <h3>On your device</h3>
        <p>
          Your own email address is kept in your browser's local storage so the app can recognise you when you
          return, and the last community you were working in is kept beside it. Nothing about anybody else is stored
          on your device.
        </p>

        <h3>Your choices</h3>
        <ul>
          <li>restrict or reopen any testimony you have shared, at any time, from the testimony itself</li>
          <li>delete a testimony you wrote, which takes its attached file with it</li>
          <li>leave a community when you no longer belong to one; your attendance and serving history stays, and
            you can also have your own testimonies and their files removed as you go</li>
          <li>ask your fellowship leaders to delete your account and the details held about you</li>
        </ul>

        <h3>Changes</h3>
        <p>We may update these terms. If we do, we will change this page.</p>

        <button className="next" type="button" onClick={() => (window.location.href = "/signup")}>
          Back
        </button>
      </article>
    </div>
  );
}