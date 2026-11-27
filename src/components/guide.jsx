import React, { useEffect } from "react";

/*
  The onboarding every dashboard shows a first-timer, and every page can re-open from the menu.
  Content is keyed by role rather than by page — an admin sees the same guide whether they open
  it from the admin dashboard or from the profile page — so the text lives here and the pages
  just say which one they want.

  Two things worth stating about what a guide is for:
    - It is *not* a manual. It is six or seven sentences that get a first-timer to their first
      real action without leaving the page.
    - It is *not* a one-shot. The menu always carries a Guide link, so anyone can reopen it.
      The localStorage flag controls only the automatic first-visit open, not access.

  `seen-key` lives in localStorage rather than on the user row because there is no reason to
  make a device-independent promise about whether somebody has been shown an intro; a person
  who switches phones should probably see it again anyway.
*/
const seenKey = (role) => `kopano_guide_seen_${role}`;

export function shouldAutoOpen(role) {
  if (!role || typeof localStorage === "undefined") return false;
  return localStorage.getItem(seenKey(role)) !== "1";
}

export function markSeen(role) {
  if (!role || typeof localStorage === "undefined") return;
  try { localStorage.setItem(seenKey(role), "1"); } catch { /* a private window: forget it */ }
}

const CONTENT = {
  admin: {
    heading: "Running a fellowship",
    intro: "You own the community: its people, their roles, the join code.",
    steps: [
      { t: "Open a check-in", d: "From the dashboard, press “Take attendance”. Four digits and a scannable QR appear; you are marked present the moment you save, so you never type your own PIN." },
      { t: "Add or remove people", d: "The Roster card lists everybody. Someone who walks in during a service just scans the QR — the open check-in adds them as a member, so you never have to find a code. Anyone who did not attend still needs one: give them the join code and they add themselves. Use Remove to take somebody off, and change a role from the same row." },
      { t: "Reset the join code", d: "Only if it has leaked. The old code stops working immediately, and the new one is what anybody who joins outside a service will need. A scan during an open check-in never uses the code, so resetting it does not lock the door behind a walk-up." },
      { t: "Approve testimonies", d: "There is no approval queue yet — anything a member posts appears on the community's list straight away. What you can do today is export the pile to Excel or PDF, and search it by name and date." },
      { t: "Prayer topics", d: "The list is the fellowship's own — anybody in it can ask for a prayer and only the person who asked can reword it or take it back, so there is nothing for you to moderate. Deleting a community's data takes these rows, and the address on each one, with it." },
      { t: "Feedback is above the community", d: "The pile is app-wide, not per-fellowship, and every signed-in person can read it — including you, from \"Read feedback\" on this page. Addresses are stored on the rows and printed in an export, never on the page. What you write there is signal for whoever runs Kopano, not for your members." },
    ],
  },
  leader: {
    heading: "Taking attendance",
    intro: "You can open a check-in and read a community's roster, but you cannot change anybody's role — and you never have to hand out a code at the door.",
    steps: [
      { t: "Open a check-in", d: "Press “Take attendance”. Read the four digits out, or turn the screen around so the QR is visible. You are marked present automatically when you save." },
      { t: "Choose a distance", d: "By default a check-in only accepts arrivals near the leader. Widen the radius if the hall reads badly, or turn the rule off for a gathering that meets in three places at once." },
      { t: "Cancel early", d: "Cancel from the same card if the room emptied or the service ran long. Cancellation is one-way — a called-off session cannot be reopened." },
      { t: "Nobody needs a code", d: "Someone who walks in cold scans the same QR as everybody else. They are given an account on that page, added to the community as a member, and marked present — no join code to hunt down, because the open check-in is what proves they are in the room." },
      { t: "Read the register", d: "Attendance shows everybody recorded for a gathering, present and absent together, and it names who opened each." },
      { t: "Know what to pray for", d: "“Prayer topics” is the fellowship's list, open to everyone in it: anybody can ask, and only the one who asked can change or withdraw a request. Nothing about the page is leader-only — it is here so the meeting can be led with what people actually need in hand." },
    ],
  },
  member: {
    heading: "Being in the room",
    intro: "You came, you mark it, you get on with the service.",
    steps: [
      { t: "Check in with the PIN", d: "A card appears on your dashboard while a session is open. Type the four digits the leader just read out. That is the whole thing." },
      { t: "Or scan the QR", d: "Same effect: hold your phone up to the leader's screen. It opens a small page that reads your location and marks you present — no typing, and nothing to ask anybody for. If you have no account yet, that page makes one and puts you on the community's register in the same go." },
      { t: "Once marked, the card is gone", d: "You cannot check in twice at the same gathering. If you change your mind about a future Sunday, use “Not attending”." },
      { t: "Send an apology in advance", d: "Not coming? Leave a note against that day. It is filed separately from attendance and does not count as a mark." },
      { t: "Share a testimony", d: "Post what God is doing in your life and it appears on the community's list for everyone there to read. There is no approval step today, so write it the way you would say it out loud." },
      { t: "Ask for prayer", d: "One or two lines on the “Prayer topics” page and it is on the fellowship's list straight away — again nothing to approve. The list shows the words and the day, never the address that asked. Yours is the only one marked, and only you can reword it or take it back." },
    ],
  },
  communities: {
    heading: "Communities",
    intro: "This page lists every fellowship you belong to. Each card opens its dashboard.",
    steps: [
      { t: "Join one", d: "Press “Join by code” and type the six characters your leader shared. The code is the door — anyone with it becomes a plain member of that community. The one exception is a scan during an open check-in, which joins you from those four digits instead." },
      { t: "Start one", d: "Press “Create a community”. You become its admin and get a code to hand out. Nothing about its structure can be changed later except the code." },
      { t: "There is no invite-by-email yet", d: "You cannot add a specific person; you share the code and they add themselves. Same rule applies whether you are a member or an admin — unless a check-in is open, where the scan does it on the PIN's word." },
      { t: "Leave one", d: "Not yet built. For now an admin has to remove you, so keep the code you give out close to people you actually want in the room." },
    ],
  },
  feedback: {
    heading: "Feedback",
    intro: "Five questions about the app itself. Nothing you write shows up on any dashboard.",
    steps: [
      { t: "It is signed, not printed", d: "The address on your note is the one you signed in with — there is no box to tick. It is written to the database and shown to nobody: the pile page prints no address, and the Excel and PDF exports carry the name and surname the app holds for that account instead." },
      { t: "Everyone can read the pile", d: "Press \"See what others have said\" — or open the same list at /feedback/all, which also exports it to Excel and PDF. The feedback is about the app, so it belongs to everybody who uses it, not to the small set of people who administer a fellowship." },
      { t: "Your words are still yours to stand by", d: "Nobody sees your address, on a page or in a file, but your name goes with your note wherever the pile is exported. Say what you mean in the text you choose to leave in." },
    ],
  },
};

const css = `
.gd-scrim{position:fixed;inset:0;background:rgba(17,17,17,.55);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:60}
.gd-scrim.on{opacity:1;pointer-events:auto}
.gd-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-48%);opacity:0;pointer-events:none;background:#fff;color:#111;border:1px solid #d4d4d4;border-radius:2px;width:min(640px,100%);max-height:min(86vh,720px);overflow:auto;padding:32px 34px;z-index:70;transition:opacity .22s ease,transform .22s ease;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.55;box-sizing:border-box}
.gd-panel.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%)}
.gd-panel .serif{font-family:"Playfair Display",Georgia,serif;font-weight:500}
.gd-panel .close{position:absolute;top:12px;right:14px;background:none;border:0;font-size:22px;line-height:1;cursor:pointer;color:#111;padding:4px 8px}
.gd-panel h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:28px;margin:0 0 6px}
.gd-panel .lede{color:#666;margin:0 0 22px;font-size:15px}
.gd-panel ol{margin:0;padding:0;list-style:none;counter-reset:gd}
.gd-panel li{margin:0 0 18px;padding-left:44px;position:relative;counter-increment:gd}
.gd-panel li::before{content:counter(gd);position:absolute;left:0;top:0;width:32px;height:32px;border:1px solid #111;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600}
.gd-panel li .t{display:block;font-weight:600;margin:0 0 4px;font-size:16px}
.gd-panel li .d{margin:0;color:#333;font-size:15px}
.gd-panel .row{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.gd-panel .btn{background:#111;color:#fff;border:1px solid #111;border-radius:2px;padding:10px 22px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.gd-panel .btn.ghost{background:#fff;color:#111}
/* Below the 640px content cap the panel used to sit at 92% of the screen and still lose 34px to
   each inner gutter, which on a phone left a narrow column of text. Now it runs edge-to-edge with
   20px gutters, and the step numbers tighten so the hanging indent still looks deliberate. */
@media (max-width:640px){
.gd-panel{padding:26px 20px 22px;max-height:min(92vh,720px);border-radius:0;border-left:0;border-right:0}
.gd-panel h2{font-size:24px}
.gd-panel li{padding-left:38px}
.gd-panel li::before{width:28px;height:28px;font-size:13px}
}
`;

export default function Guide({ role, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!role) return null;
  const c = CONTENT[role] || CONTENT.member;

  return (
    <>
      <div className={`gd-scrim${open ? " on" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`gd-panel${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gd-heading" aria-hidden={!open}>
        <style>{css}</style>
        <button className="close" type="button" aria-label="Close guide" onClick={onClose}>&times;</button>
        <h2 id="gd-heading" className="serif">{c.heading}</h2>
        <p className="lede">{c.intro}</p>
        <ol>
          {c.steps.map((one) => (
            <li key={one.t}>
              <span className="t">{one.t}</span>
              <span className="d">{one.d}</span>
            </li>
          ))}
        </ol>
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => { markSeen(role); onClose(); }}>Later</button>
          <button className="btn" type="button" onClick={() => { markSeen(role); onClose(); }}>Got it</button>
        </div>
      </aside>
    </>
  );
}
