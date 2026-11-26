import React, { useRef, useState } from "react";
import { ratio } from "../page_functions/export/pool.js";

/*
  The button every export sits behind, and the only place the shape of a long job is handled.

  A download that takes ninety seconds is a different piece of interface from one that takes a tenth
  of a second: it has to say it is working, say how far along it is, refuse a second click while the
  first is still going, and say plainly when it failed rather than leaving a spinner turning forever.
  All five export components need exactly that and none of them should own it, so they hand this a
  function to run and it gives them back a label, a progress count and an error line.

  `run` is handed `{ report }`. Calling `report({ done, total })` while it works is what makes the
  button count up; returning is what ends the job; throwing is what writes the sentence under it. The
  component never saves anything itself — it does not know what a file is.
*/

const css = `
.eb{display:inline-flex;flex-direction:column;gap:8px;vertical-align:middle}
.eb button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:9px 18px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.eb button:hover{background:#111;color:#fff}
.eb button:disabled{opacity:.5;cursor:default;background:#fff;color:#111}
.eb .count{font-variant-numeric:tabular-nums;font-weight:400;opacity:.7}
.eb .fail{color:#a11111;font-size:13px;max-width:46ch}
.eb .done{color:#2f6b2f;font-size:13px}
`;

export default function ExportButton({
  label,
  busyLabel,
  run,
  onDone,
  onFailed,
  disabled = false,
  title,
}) {
  const [state, setState] = useState({ phase: "idle", progress: null, message: "" });
  /*
    Whether the job that just finished is still the one this button started. Without it, a component
    unmounted mid-export (a leader clicking back to the register) would call setState on nothing, and
    the browser spends the moment warning about it.
  */
  const live = useRef(true);
  React.useEffect(() => () => { live.current = false; }, []);

  const report = (progress) => { if (live.current) setState((now) => ({ ...now, progress })); };

  async function start() {
    setState({ phase: "running", progress: null, message: "" });
    try {
      const result = await run({ report });
      if (!live.current) return;
      const message = typeof result === "string" ? result : "";
      setState({ phase: "done", progress: null, message });
      onDone?.(result);
    } catch (error) {
      if (!live.current) return;
      setState({ phase: "failed", progress: null, message: error?.message || "The export did not finish." });
      onFailed?.(error);
    }
  }

  const running = state.phase === "running";
  const spoken = running ? busyLabel || `${label}…` : label;

  return (
    <div className="eb">
      <style>{css}</style>
      <button type="button" onClick={start} disabled={disabled || running} title={title}>
        {spoken}
        {running && state.progress?.total ? <span className="count">{ratio(state.progress)}</span> : null}
      </button>
      {state.phase === "failed" && <p className="fail">{state.message}</p>}
      {state.phase === "done" && state.message && <p className="done">{state.message}</p>}
    </div>
  );
}
