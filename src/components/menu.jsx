import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { forgetAdmin } from "../admin/state.js";
import Guide, { shouldAutoOpen, markSeen } from "./guide.jsx";

const accounts = new Auth();

const css = `
.kp-scrim{position:fixed;inset:0;background:rgba(17,17,17,.4);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:40}
.kp-scrim.on{opacity:1;pointer-events:auto}

.kp-panel{position:fixed;top:0;left:0;height:100%;width:min(78vw,300px);background:#fff;color:#111;border-right:1px solid #d9d9d9;transform:translateX(-100%);transition:transform .25s ease,visibility .25s;visibility:hidden;z-index:50;display:flex;flex-direction:column;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.kp-panel.on{transform:translateX(0);visibility:visible}
.kp-panel .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.kp-panel .head .t{font-family:"Playfair Display",Georgia,serif;font-size:22px}
.kp-panel .x{background:none;border:0;font-size:20px;line-height:1;cursor:pointer;color:#111;padding:4px 6px}

.kp-panel nav{display:flex;flex-direction:column;gap:10px}
.kp-panel nav button{width:100%;text-align:left;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:#fff;color:#111;border:1px solid #111}
.kp-panel nav button.ghost{border-color:#d9d9d9;color:#666;font-weight:400}

.kp-trigger{background:none;border:1px solid #d9d9d9;border-radius:2px;padding:7px 12px;font-size:15px;line-height:1;cursor:pointer;color:#111}
`;

// Where the URL is on the page, so the Guide can pick sensible content without every caller
// having to name its role explicitly. A page that lives above the routing (e.g. /qr, /feedback)
// passes guideRole; a page that fits one of these patterns does not have to.
function inferRole() {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  if (path.startsWith("/admin-")) return "admin";
  if (path.startsWith("/leader-")) return "leader";
  if (path.startsWith("/member-")) return "member";
  if (path === "/community") return "communities";
  if (path === "/feedback" || path.startsWith("/feedback/")) return "feedback";
  if (path === "/take-attendance") return "leader";
  return null;
}

/*
  The slide-over every signed-in page carries. `items` is what a particular screen puts
  above Profile and Log out — src/admin/menu.jsx is the only caller that passes any — and
  each item's `state` travels with the navigation, the same way a community card hands the
  community to the page it opens.

  The Guide link sits at the top of the list because it is the one thing every role wants
  when they have been away from the app for a few weeks. `guideRole` names which content
  to open; without it, the role is inferred from the current path. First-visit auto-open is
  handled here so no page has to do it themselves — a dashboard mounts, we check the flag,
  and if it is unset for this role the modal slides in once.
*/
export default function Menu({ heading = "Menu", items = [], guideRole }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = guideRole || inferRole();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  // One auto-open per role per browser: the first page you land on that carries this menu
  // raises the guide, and closing it writes the flag. A page re-mount or a route change does
  // not re-open it because the flag has already been set by markSeen.
  useEffect(() => {
    if (!role) return;
    if (!shouldAutoOpen(role)) return;
    const t = setTimeout(() => setGuideOpen(true), 400);
    return () => clearTimeout(t);
  }, [role]);

  function go(to, state) {
    setOpen(false);
    navigate(state ? { pathname: to, state } : to);
  }

  async function signOut() {
    setOpen(false);
    await accounts.signOut();
    // The next person to sign in on this browser is not the one who left, so the
    // community and address the admin screens were carrying go with them.
    forgetAdmin();
    navigate("/login", { replace: true });
  }

  function openGuide() {
    setOpen(false);
    if (role) setGuideOpen(true);
  }

  return (
    <>
      <style>{css}</style>
      <button className="kp-trigger" type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        &#9776;
      </button>

      <div className={`kp-scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`kp-panel${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-labelledby="kp-heading">
        <div className="head">
          <span className="t" id="kp-heading">{heading}</span>
          <button className="x" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>
        <nav>
          {role && (
            <button type="button" onClick={openGuide}>Guide</button>
          )}
          {items.map((one) => (
            <button key={one.to} type="button" onClick={() => go(one.to, one.state)}>
              {one.label}
            </button>
          ))}
          <button type="button" onClick={() => go("/feedback")}>Feedback</button>
          <button type="button" onClick={() => go("/profile")}>Profile</button>
          {/* Sitting beside Profile rather than among a role's own tools, because leaving is something
              every member can do and only an admin can undo. */}
          <button type="button" onClick={() => go("/leave-community")}>Leave a community</button>
          <button className="ghost" type="button" onClick={signOut}>Log out</button>
        </nav>
      </aside>

      {role && (
        <Guide
          role={role}
          open={guideOpen}
          onClose={() => { markSeen(role); setGuideOpen(false); }}
        />
      )}
    </>
  );
}
