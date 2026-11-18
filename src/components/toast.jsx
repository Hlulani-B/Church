import React, { useEffect, useRef, useState } from "react";

/*
  A short, non-blocking confirmation that lives in the corner of the screen — the thing you
  look at to know the check-in landed, since the card you were standing on disappears the
  moment the register writes you. Delay before showing is intentional: it lets the removal of
  the card register first, so the toast arrives into a screen that has already changed rather
  than competing with it.

  Toasts stack from a single `push(text)` — a session_live Card calls it once per check-in,
  and a page could call it a second time if there were something else worth saying. Auto-fade
  after the given life (6s default), or on click, whichever comes first.
*/
const css = `
.kt-wrap{position:fixed;right:20px;bottom:20px;z-index:80;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.kt{pointer-events:auto;background:#111;color:#fff;border-radius:2px;padding:12px 18px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:14px;line-height:1.4;max-width:min(360px,80vw);box-shadow:0 4px 16px rgba(17,17,17,.2);opacity:0;transform:translateY(10px);transition:opacity .25s ease,transform .25s ease}
.kt.on{opacity:1;transform:translateY(0)}
.kt.out{opacity:0;transform:translateY(10px)}
.kt .t{display:block;font-weight:600;margin-bottom:2px}
.kt .d{color:#dcdcdc;font-size:13px}
@media (max-width:520px){
  .kt-wrap{right:12px;left:12px;bottom:12px}
  .kt{max-width:none}
}
`;

// The one bus every toast goes through, so any component can push one without prop drilling.
let listeners = new Set();
export function pushToast({ title, detail = "", life = 6000, delay = 0 }) {
  const id = Math.random().toString(36).slice(2);
  const fire = () => listeners.forEach((l) => l({ id, title, detail, life }));
  if (delay > 0) setTimeout(fire, delay);
  else fire();
  return id;
}

export default function ToastHost() {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    const onPush = (next) => {
      setItems((before) => [...before, { ...next, exiting: false }]);
      const fade = setTimeout(() => {
        setItems((before) => before.map((one) => (one.id === next.id ? { ...one, exiting: true } : one)));
        const drop = setTimeout(() => {
          setItems((before) => before.filter((one) => one.id !== next.id));
          timers.current.delete(next.id);
        }, 260);
        timers.current.set(`${next.id}:drop`, drop);
      }, next.life);
      timers.current.set(next.id, fade);
    };
    listeners.add(onPush);
    const held = timers.current;
    return () => {
      listeners.delete(onPush);
      held.forEach((t) => clearTimeout(t));
      held.clear();
    };
  }, []);

  if (!items.length) return null;
  return (
    <>
      <style>{css}</style>
      <div className="kt-wrap" role="region" aria-label="Notifications">
        {items.map((one) => (
          <div
            key={one.id}
            className={`kt${one.exiting ? " out" : " on"}`}
            onClick={() => setItems((before) => before.filter((row) => row.id !== one.id))}
          >
            <span className="t">{one.title}</span>
            {one.detail && <span className="d">{one.detail}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
