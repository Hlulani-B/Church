import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/*
  One scannable code for one open check-in.

  This is the leader's side of the /qr landing page: it encodes the exact three things that page
  reads off the URL — the community, the session, and the four-digit PIN — into a single link, so a
  phone pointed at the screen arrives already knowing what to mark and never has to type the digits.
  The link is built from the page's own origin, so the same code works on whatever domain this is
  served from; nothing here is hard-coded to a deployment.

  It offers three ways to get the code in front of a room:
    · Maximise — fills the whole screen, big and centred, so it can be scanned off a projector or a
      phone held a few metres away. The PIN is shown under it as the fallback for anyone whose camera
      will not cooperate.
    · Print — opens the browser's own print dialog with nothing but this code on the page, sized to
      a sheet. That is also how you get a PDF: choose "Save as PDF" in the same dialog.
    · PNG — downloads the code as an image, for a slide or a noticeboard.

  Like the rest of this app it decides nothing about whether a check-in is true; it only hands the
  room the four digits and the two ids that /api/self will later verify against its own clock.
*/
const css = `
.qrx{display:flex;flex-direction:column;align-items:center;gap:12px;margin:18px 0 0}
.qrx .code{background:#fff;padding:14px;border:1px solid #e3e3e3;border-radius:6px;line-height:0}
.qrx .code svg{display:block}
.qrx .link{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#666;word-break:break-all;text-align:center;max-width:340px}
.qrx .btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.qrx .btns button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:9px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer}
.qrx .btns button:hover{background:#111;color:#fff}
.qrx .btns button.solid{background:#111;color:#fff}
.qrx .btns button.solid:hover{background:#333}

/* The maximised overlay: a dark wall, the code as large as the screen allows, the PIN beneath it. */
.qrx-full{position:fixed;inset:0;z-index:9999;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5vmin;padding:6vmin;box-sizing:border-box}
.qrx-full .box{background:#fff;padding:4vmin;border-radius:8px;line-height:0}
.qrx-full .box svg{display:block;width:70vmin;height:70vmin}
.qrx-full .title{font-family:"Playfair Display",Georgia,serif;font-size:clamp(24px,6vmin,54px);margin:0;text-align:center}
.qrx-full .pinline{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(28px,8vmin,72px);letter-spacing:.3em;color:#fff}
.qrx-full .hint{font-size:clamp(13px,2.4vmin,18px);color:#a8a8a8;text-align:center;max-width:80vw}
.qrx-full .close{position:absolute;top:18px;right:22px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:2px;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.qrx-full .close:hover{border-color:#fff}
`;

// The link the code carries: this deployment's origin + /qr + the three ids the landing page reads.
function buildLink(community_id, session_id, pin) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const q = new URLSearchParams({
    pin: String(pin ?? ""),
    session_id: String(session_id ?? ""),
    community_id: String(community_id ?? ""),
  });
  return `${origin}/qr?${q.toString()}`;
}

// An SVG element rendered to a high-resolution PNG data URL, on a white ground so it always scans.
async function svgToPng(svgEl, px) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width", String(px));
  clone.setAttribute("height", String(px));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("the code could not be drawn"));
    img.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  return canvas.toDataURL("image/png");
}

export default function QrCard({ community_id, session_id, pin, size = 180 }) {
  const [maximised, setMaximised] = useState(false);
  const smallRef = useRef(null);
  const bigRef = useRef(null);
  const link = buildLink(community_id, session_id, pin);

  // Escape drops the maximised view, the way any full-screen thing is expected to leave.
  useEffect(() => {
    if (!maximised) return undefined;
    const onKey = (event) => event.key === "Escape" && setMaximised(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximised]);

  // Whichever code is on screen right now is the one that gets exported — big when maximised.
  async function downloadPng() {
    const svg = (bigRef.current || smallRef.current);
    if (!svg) return;
    try {
      const url = await svgToPng(svg, 1024);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kopano-checkin-${pin || "code"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* A browser that refuses the canvas read simply does not download; the code stays on screen. */
    }
  }

  // Print through a throwaway iframe: the sheet holds only the code and the PIN, nothing of the app.
  function printCode() {
    const svg = smallRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", "120mm");
    clone.setAttribute("height", "120mm");
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>Kopano check-in ${pin || ""}</title>` +
        `<style>body{margin:0;font-family:system-ui,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:96vh;gap:18px;text-align:center}` +
        `h1{font-size:34px;margin:0}.c{padding:16px}small{color:#555;font-size:12px;word-break:break-all;max-width:80%}</style></head>` +
        `<body><h1>Scan to mark yourself present</h1>` +
        `<div class="c">${new XMLSerializer().serializeToString(clone)}</div>` +
        `<div style="font-family:monospace;font-size:44px;letter-spacing:.3em">PIN ${pin || ""}</div>` +
        `<small>${link}</small></body></html>`,
    );
    doc.close();
    const go = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      // The iframe is only ever for printing; it is taken back out shortly after.
      setTimeout(() => frame.remove(), 1500);
    };
    // Give the drawn SVG a beat to lay out before the dialog opens.
    setTimeout(go, 120);
  }

  return (
    <>
      <style>{css}</style>
      <div className="qrx">
        <div className="code">
          <QRCodeSVG
            ref={smallRef}
            value={link}
            size={size}
            level="M"
            bgColor="#ffffff"
            fgColor="#111111"
          />
        </div>
        <p className="link">{link}</p>
        <div className="btns">
          <button className="solid" type="button" onClick={() => setMaximised(true)}>
            Maximise
          </button>
          <button type="button" onClick={printCode}>
            Print / PDF
          </button>
          <button type="button" onClick={downloadPng}>
            Download PNG
          </button>
        </div>
      </div>

      {maximised && (
        <div
          className="qrx-full"
          role="dialog"
          aria-modal="true"
          onClick={() => setMaximised(false)}
        >
          <button className="close" type="button" onClick={() => setMaximised(false)}>
            Close ✕
          </button>
          <p className="title">Scan to mark yourself present</p>
          <div className="box">
            <QRCodeSVG
              ref={bigRef}
              value={link}
              size={512}
              level="M"
              bgColor="#ffffff"
              fgColor="#111111"
            />
          </div>
          <p className="pinline">PIN {pin || "····"}</p>
          <p className="hint">
            Hold your phone camera up to this screen. No scanner? Open the link below in the Kopano
            app and type these four digits.
          </p>
        </div>
      )}
    </>
  );
}
