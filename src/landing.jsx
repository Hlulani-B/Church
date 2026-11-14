import React from "react";
import { useNavigate } from "react-router-dom";
/*
  CC0 "Christians praying church Advent" via Openverse (rawpixel asset).
  Public-domain dedication, so no credit line is required.
  Remote hero photo; rendered black and white by the .hero::before filter.
*/
const PHOTO =
  "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwzODkzMTg4MTM4Mi1pbWFnZS1rdHdtb2lubC5qcGc.jpg";

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#2a2a2a;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.kp{--text:#f4f4f4;--muted:#d0d0d0;--line:rgba(255,255,255,.25);background:linear-gradient(180deg,#3a3a3a 0,#2a2a2a 100%);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6;overflow-x:hidden}
.kp *{box-sizing:border-box}
.kp a{text-decoration:none;color:inherit}
.kp .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}
.kp .wrap{max-width:1100px;margin:0 auto;padding:0 24px}

/* hero with photo background */
.kp .hero{position:relative;min-height:640px;background:#444;overflow:hidden;display:flex;flex-direction:column}
.kp .hero::before{content:"";position:absolute;inset:0;background-image:var(--photo);background-size:cover;background-position:center top;filter:grayscale(1) contrast(1.05)}
.kp .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(20,20,20,.88) 0%,rgba(20,20,20,.6) 50%,rgba(20,20,20,.25) 100%)}
.kp .hero > .wrap{position:relative;z-index:1;width:100%;flex:1;display:flex;flex-direction:column}

.kp nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:24px 0;font-size:14px}
.kp .links{display:flex;gap:24px}
.kp .links a{opacity:.8}
.kp .links a:first-child{opacity:1;font-weight:700}
.kp .logo{font-size:22px}
.kp .nav-right{text-align:right}
.kp .outline{display:inline-block;border:1px solid var(--text);padding:8px 18px;border-radius:2px;font-weight:600}
.kp .btn{display:inline-block;background:#fff;color:#111;padding:12px 30px;border-radius:2px;font-weight:600}

.kp .copy{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:520px;padding:32px 0 72px}
.kp h1{font-size:clamp(30px,4.6vw,48px);line-height:1.2;margin:0 0 20px;text-transform:uppercase}
.kp h1 em{text-transform:none;font-style:italic}
.kp .copy p{color:var(--muted);max-width:400px;margin:0 0 28px;font-size:15px}
.kp .wave{display:block;margin-top:36px;opacity:.85}

/* sections */
.kp section{padding:88px 0}
.kp .split{display:grid;grid-template-columns:1fr 1.4fr;gap:56px;align-items:start}
.kp h2{font-size:clamp(28px,3.6vw,38px);line-height:1.2;margin:0 0 16px}
.kp .lead{color:var(--muted);max-width:340px;margin:0}

.kp .row{display:grid;grid-template-columns:48px 1fr;gap:16px;padding:22px 0;border-top:1px solid var(--line)}
.kp .row:last-child{border-bottom:1px solid var(--line)}
.kp .row .n{font-size:26px;font-style:italic;font-family:"Playfair Display",Georgia,serif}
.kp .row h3{margin:0 0 4px;font-size:18px;font-weight:600}
.kp .row p{margin:0;color:var(--muted)}

.kp .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:0 40px;margin-top:40px}
.kp .item{padding:22px 0;border-top:1px solid var(--line)}
.kp .item h3{margin:0 0 4px;font-size:18px;font-weight:600}
.kp .item p{margin:0;color:var(--muted)}

.kp .closing{text-align:center;border-top:1px solid var(--line)}
.kp .closing h2{max-width:620px;margin:0 auto 16px}
.kp .closing p{color:var(--muted);max-width:460px;margin:0 auto 28px}

.kp footer{border-top:1px solid var(--line);padding:28px 0;font-size:14px;color:var(--muted)}
.kp footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}

@media (max-width:820px){
  .kp nav{grid-template-columns:1fr auto}
  .kp .links{display:none}
  .kp .hero{min-height:560px}
  .kp .hero::after{background:rgba(20,20,20,.6)}
  .kp .split{grid-template-columns:1fr;gap:32px}
  .kp .cols{grid-template-columns:1fr}
  .kp section{padding:64px 0}
}
`;

const steps = [
  { title: "Say if you are coming", text: "Mark Attending or Not Attending for the week in one tap." },
  { title: "Give a reason", text: "If you cannot come, pick Work, Transport, Sick, Family or Other." },
  { title: "Check in on the day", text: "Scan the code or enter the PIN at the meeting to confirm you are there." },
  { title: "Share a testimony", text: "Log your weekly testimony so it is recorded and celebrated." },
];

const leaderPoints = [
  { title: "Weekly view", text: "See who is attending, not attending and yet to respond." },
  { title: "Monthly patterns", text: "Track attendance per member and for the whole fellowship." },
  { title: "Early follow up", text: "Spot members who have missed several weeks in a row." },
  { title: "Reasons for absence", text: "Know whether to help with transport, work or illness." },
  { title: "Testimony count", text: "See who shares, how often, and encourage more." },
  { title: "Add for others", text: "Record attendance for members who do not use the app." },
];

export default function LandingPage() {
    const navigate= useNavigate();
  return (
    <div className="kp" id="top">
      <style>{css}</style>

      <header className="hero" style={{ "--photo": `url(${PHOTO})` }}>
        <div className="wrap">
          <nav>
            <div className="links">
              <a href="#top">Home</a>
              <a href="#how">How it works</a>
              <a href="#leaders">For leaders</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="logo serif">Kopano</div>
            <div className="nav-right">
             <a className="outline" href="/login">Log in</a>
            </div>
          </nav>

          <div className="copy">
            <h1 className="serif">
              Care for people <em>before they drift away</em> and keep every testimony.
            </h1>
            <p>Mark your availability, check in on Sunday and share what God is doing in your life.</p>
            <div>
              <a className="btn" href="/signup">Get started</a>
            </div>
            <svg className="wave" width="120" height="14" viewBox="0 0 120 14" fill="none" stroke="#fff" strokeWidth="1.2" aria-hidden="true">
              <path d="M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7" />
            </svg>
          </div>
        </div>
      </header>

      <section id="how">
        <div className="wrap split">
          <div>
            <h2 className="serif">How it works</h2>
            <p className="lead">Four small steps each week. Nothing to learn and nothing to set up.</p>
          </div>
          <div>
            {steps.map((s, i) => (
              <div className="row" key={s.title}>
                <div className="n">{i + 1}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="leaders">
        <div className="wrap">
          <h2 className="serif">Built for leaders</h2>
          <p className="lead" style={{ maxWidth: 520 }}>
            See what is happening in your fellowship early enough to care for people well.
          </p>
          <div className="cols">
            {leaderPoints.map((p) => (
              <div className="item" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="join" className="closing">
        <div className="wrap">
          <h2 className="serif">Notice people <em>while they are still here.</em></h2>
          <p>Join your fellowship on Kopano and start caring with clearer eyes.</p>
          <a className="btn" href="/login">Log in</a>
        </div>
      </section>

      <footer id="contact">
        <div className="wrap">
          <span className="serif">Kopano</span>
          <span>Made for fellowship.</span>
        </div>
      </footer>
    </div>
  );
}