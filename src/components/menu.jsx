import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";

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

export default function Menu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  async function leave() {
    setOpen(false);
    await accounts.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <style>{css}</style>
      <button className="kp-trigger" type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        &#9776;
      </button>

      <div className={`kp-scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`kp-panel${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="head">
          <span className="t">Menu</span>
          <button className="x" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>
        <nav>
          <button type="button" onClick={() => go("/profile")}>Profile</button>
          <button className="ghost" type="button" onClick={leave}>Log out</button>
        </nav>
      </aside>
    </>
  );
}
