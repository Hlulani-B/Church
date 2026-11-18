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
    intro: "You own the community: its people, their roles, the join code at the door.",
    steps: [
      { t: "Open a check-in", d: "From the dashboard, press “Take attendance”. Four digits and a scannable QR appear; you are marked present the moment you save, so you never type your own PIN." },
      { t: "Add or remove people", d: "The Roster card lists everybody. Give somebody the join code and they add themselves; use Remove to take them off. Change a role from the same row." },
      { t: "Reset the join code", d: "Only if it has leaked. The old code stops working immediately, and the new one is what your members will need to give the next walk-up." },
      { t: "Approve testimonies", d: "Whatever a member posts sits in a queue until you approve it. Hiding a testimony does not delete it — you can bring it back." },
      { t: "Feedback lives above the community", d: "Admin feedback is app-wide, not per-fellowship. Everyone in the pile sees the same notes." },
    ],
  },
  leader: {
    heading: "Taking attendance",
    intro: "You can open a check-in and read a community's roster, but you cannot change who belongs to it.",
    steps: [
      { t: "Open a check-in", d: "Press “Take attendance”. Read the four digits out, or turn the screen around so the QR is visible. You are marked present automatically when you save." },
      { t: "Choose a distance", d: "By default a check-in only accepts arrivals near the leader. Widen the radius if the hall reads badly, or turn the rule off for a gathering that meets in three places at once." },
      { t: "Cancel early", d: "Cancel from the same card if the room emptied or the service ran long. Cancellation is one-way — a called-off session cannot be reopened." },
      { t: "Read the register", d: "Attendance shows everybody recorded for a gathering, present and absent together, and it names who opened each." },
    ],
  },
  member: {
    heading: "Being in the room",
    intro: "You came, you mark it, you get on with the service.",
    steps: [
      { t: "Check in with the PIN", d: "A card appears on your dashboard while a session is open. Type the four digits the leader just read out. That is the whole thing." },
      { t: "Or scan the QR", d: "Same effect: hold your phone up to the leader's screen. It opens a small page that reads your location and marks you present — no typing." },
      { t: "Once marked, the card is gone", d: "You cannot check in twice at the same gathering. If you change your mind about a future Sunday, use “Not attending”." },
      { t: "Send an apology in advance", d: "Not coming? Leave a note against that day. It is filed separately from attendance and does not count as a mark." },
      { t: "Share a testimony", d: "Anything you post goes to the leader or admin first. Once approved, the whole community sees it." },
    ],
  },
  communities: {
    heading: "Communities",
    intro: "This page lists every fellowship you belong to. Each card opens its dashboard.",
    steps: [
      { t: "Join one", d: "Press “Join by code” and type the six characters your leader shared. The code is the door — anyone with it becomes a plain member of that community." },
      { t: "Start one", d: "Press “Create a community”. You become its admin and get a code to hand out. Nothing about its structure can be changed later except the code." },
      { t: "There is no invite-by-email yet", d: "You cannot add a specific person; you share the code and they add themselves. Same rule applies whether you are a member or an admin." },
      { t: "Leave one", d: "Not yet built. For now an admin has to remove you, so keep the code you give out close to people you actually want in the room." },
    ],
  },
  feedback: {
    heading: "Feedback",
    intro: "Five questions about the app itself. Nothing you write shows up on any dashboard.",
    steps: [
      { t: "It is anonymous by default", d: "Tick the box at the bottom of the form only if you want a reply to be possible. Left off, the row carries no address." },
      { t: "Admins see the whole pile", d: "Because the table is not tied to a community, every community's admin can read every row. Assume that anything you write will be read by somebody who runs a different fellowship." },
    ],
  },
};

const css = `
.gd-scrim{position:fixed;inset:0;background:rgba(17,17,17,.55);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:60}
.gd-scrim.on{opacity:1;pointer-events:auto}
.gd-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-48%);opacity:0;pointer-events:none;background:#fff;color:#111;border:1px solid #d4d4d4;border-radius:2px;max-width:min(640px,92vw);max-height:min(86vh,720px);overflow:auto;padding:32px 34px;z-index:70;transition:opacity .22s ease,transform .22s ease;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.55}
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
