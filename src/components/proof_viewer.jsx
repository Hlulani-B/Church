import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
  A proof of payment that can actually be looked at, on the screen that names it.

  An attached receipt used to be only ever *shown*: the leader's opened-out function printed the storage
  url as plain text in its File column, and the member's RSVP page had a link that left the app in a new
  tab. Neither answers the question the screen is really asking — is this the right amount, from the
  right person, on the right day — because the answer was on a page you had to leave to reach.

  So the file is drawn here, and everything you can want to do with it happens without leaving: it is
  looked at, it is filled to the whole screen, and it is saved to your own machine. There is no link in
  this dialog on purpose. A link hands the person to another tab, and a leader who has been taken to
  another tab has lost the row they were checking; the same url that a link opens is what the save
  reads, so nothing is harder to reach for the absence of one.

  What the file is comes off the stored url rather than off a column, because `function_paid` keeps
  only the path, and the extension the browser's uploader chose is the one honest signal left. HEIC
  from a phone camera is deliberately not counted as a picture: no browser draws it, and an image that
  renders as a broken icon is worse than an honest save button.

  Saving is done by fetching the bytes and handing the browser a blob of its own, not by a `download`
  attribute on the stored url. That attribute is ignored for a file on another host — every browser
  opens a tab instead of a dialog — so a link named as a download would still be a link. The bucket
  answers `access-control-allow-origin: *`, which is what makes reading the bytes here possible at all.

  One dialog, closed by Escape, by the backdrop or by its own button, and the control that opened it
  takes the focus back on the way out — a leader working down the register by keyboard does not lose
  their place. It is rendered into the document body, so a table cell that scrolls cannot clip it, and
  the page behind it is held still so a phone does not scroll away underneath and land somewhere else.
*/

const css = `
.pv{display:inline-flex;align-items:center;gap:10px;min-width:0}
body.pv_open{overflow:hidden}
.pv .free{color:#666;font-size:14px}
.pv .thumb{width:52px;height:52px;padding:0;overflow:hidden;line-height:0;background:#fff;border:1px solid #e3e3e3;border-radius:2px;cursor:pointer;flex:none}
.pv .thumb:hover,.pv .thumb:focus-visible{border-color:#111}
.pv .thumb img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}
.pv .file{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:7px 12px;font-family:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer}
.pv .file:hover{background:#111;color:#fff}
.pv .file .who{font-weight:400;font-size:12px;opacity:.75;max-width:28ch;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}

.pv .sheet{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(17,17,17,.86);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.pv .box{--bar:49px;display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#111;border-radius:2px;max-width:min(1040px,96vw);max-height:94vh}
.pv .head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #e3e3e3;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;color:#666}
.pv .head .t{min-width:0;overflow-wrap:anywhere}
.pv .head .spacer{flex:1 1 auto;min-width:8px}
.pv .head button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:6px 12px;font:inherit;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.pv .head button:hover{background:#111;color:#fff}
.pv .head button[aria-pressed="true"]{background:#111;color:#fff}
.pv .head button:disabled{border-color:#bdbdbd;color:#bdbdbd;cursor:progress}
.pv .warn{margin:0;padding:10px 14px;background:#fdecea;color:#a11111;border-bottom:1px solid #e3e3e3;font-size:13px;letter-spacing:0;text-transform:none;font-weight:400}

.pv .body{display:flex;align-items:center;justify-content:center;min-height:0;padding:14px;background:#111}
.pv .plate{border:0;background:none;padding:0;line-height:0;cursor:zoom-in;display:flex}
.pv .plate img{display:block;max-width:100%;max-height:calc(94vh - var(--bar) - 28px);object-fit:contain}
.pv .plate:where(:focus-visible){outline:2px solid #fff;outline-offset:3px}
.pv .body iframe{display:block;width:min(880px,92vw);height:calc(94vh - var(--bar) - 28px);border:0;background:#fff}
.pv .body .other{margin:0;padding:24px 0;max-width:60ch;color:#fff;font-size:15px;text-align:center;letter-spacing:0;text-transform:none;font-weight:400}

/* Maximised: the whole screen, no frame around the file, and the same controls still on top of it. */
.pv .sheet.max{padding:0}
.pv .sheet.max .box{max-width:none;max-height:none;width:100vw;height:100vh;border-radius:0}
.pv .sheet.max .body{padding:0}
.pv .sheet.max .plate{cursor:zoom-out}
.pv .sheet.max .plate img{max-width:100vw;max-height:calc(100vh - var(--bar))}
.pv .sheet.max .body iframe{width:100%;height:calc(100vh - var(--bar))}

@media (max-width:640px){
  .pv .sheet{padding:0}
  .pv .box{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}
  .pv .head{flex-wrap:wrap;gap:8px}
  .pv .head .spacer{flex-basis:100%;min-width:0;height:0}
  .pv .plate img{max-height:calc(100vh - var(--bar) - 24px)}
  .pv .body iframe{width:100%;height:calc(100vh - var(--bar) - 24px)}
}
`;

const IMAGES = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

// Which of the three things this url points at. Taken off the extension the uploader wrote into the
// path, because nothing else about a `function_paid` row says what its proof is.
function kindOf(url) {
  const ext = String(url).split("?")[0].split(".").pop().toLowerCase();
  if (IMAGES.includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

// The name the uploader gave the file, which is the last part of the path. A saved file that arrives as
// "download" is no use beside four of them in a folder, so the name is taken off the url.
function nameOf(url) {
  const last = String(url).split("?")[0].split("/").pop();
  return last ? decodeURIComponent(last) : "receipt";
}

export default function ProofViewer({ url, label = "" }) {
  const [open, setOpen] = useState(false);
  const [max, setMax] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const key = (event) => {
      if (event.key === "Escape") close();
    };
    // The page behind is held still while the file is up, then handed back exactly what it was. The
    // hold rides on a class rather than on a written style, so a page that set its own overflow is
    // never given something else by accident.
    document.body.classList.add("pv_open");
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.classList.remove("pv_open");
    };
    // Only whether the file is up matters to this effect. `close` is re-made on every render like
    // everything else in the component, and by the time a key is ever pressed the listener is holding
    // the current one.
  }, [open]);

  if (!url) return <span className="pv free">No proof attached</span>;

  const kind = kindOf(url);
  const words = { image: "Receipt image", pdf: "Receipt (PDF)", other: "Attached file" }[kind];
  const who = label && label !== url ? label : "";
  const caption = `${words}${who ? ` — ${who}` : ""}`;

  // Closing always returns the focus to the control that opened the file, whatever closed it, and
  // always leaves the file as small as it was found: a maximised receipt that stays maximised between
  // two rows of the register is a thing nobody asked for.
  function close() {
    setOpen(false);
    setMax(false);
    setNote("");
    trigger.current?.focus();
  }

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const answer = await fetch(url);
      if (!answer.ok) throw new Error(`the file answered HTTP ${answer.status}`);
      const href = URL.createObjectURL(await answer.blob());
      const one = document.createElement("a");
      one.href = href;
      one.download = nameOf(url);
      document.body.appendChild(one);
      one.click();
      one.remove();
      // The blob is the browser's own copy of the bytes. It is given back after a moment rather than
      // straight away because a revocation that lands before the save has started takes the file with it.
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch (e) {
      // Said in words and left at that. A file that cannot be read here would not be readable in a new
      // tab either, so the dialog does not go back to handing out a url to try.
      setNote(`The file could not be fetched to be saved: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="pv">
      <style>{css}</style>

      {kind === "image" ? (
        <button
          ref={trigger}
          type="button"
          className="thumb"
          onClick={() => setOpen(true)}
          aria-label={`View the ${words.toLowerCase()}${who ? ` from ${who}` : ""}`}
        >
          <img src={url} alt="" loading="lazy" />
        </button>
      ) : (
        <button ref={trigger} type="button" className="file" onClick={() => setOpen(true)}>
          {words}
          {who && <span className="who">{who}</span>}
        </button>
      )}

      {open &&
        createPortal(
          <div
            className={`pv sheet${max ? " max" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={caption}
            onClick={close}
          >
            <div className="box" onClick={(event) => event.stopPropagation()}>
              <div className="head">
                <span className="t">{caption}</span>
                <span className="spacer" />
                {/* A PDF is drawn by the browser's own reader, which lives in another document: a click
                    on it never reaches this page, so only the button can change its size. */}
                {kind !== "other" && (
                  <button type="button" aria-pressed={max} onClick={() => setMax((now) => !now)}>
                    {max ? "Reduce" : "Maximise"}
                  </button>
                )}
                <button type="button" onClick={save} disabled={busy}>
                  {busy ? "Saving…" : "Save the file"}
                </button>
                <button type="button" autoFocus onClick={close}>
                  Close
                </button>
              </div>

              {note && <p className="warn">{note}</p>}

              <div className="body">
                {kind === "image" && (
                  <button
                    type="button"
                    className="plate"
                    aria-pressed={max}
                    aria-label={max ? "Show it at the size of the screen it came in" : "Fill the screen"}
                    onClick={() => setMax((now) => !now)}
                  >
                    <img src={url} alt={caption} />
                  </button>
                )}
                {kind === "pdf" && <iframe src={url} title={caption} />}
                {kind === "other" && (
                  <p className="other">
                    This proof is neither a picture nor a PDF, so the browser will not draw it here.
                    Save the file with the button above and open it in whatever program reads this kind.
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
