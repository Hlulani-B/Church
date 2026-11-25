import React from "react";

/*
  What a list shows while its first read is still out: pale boxes in the shape of the rows that are
  coming, and one line saying what is being read.

  This exists because a blank space and a sentence about absence used to be the same screen. A page
  that answers with an array starting empty prints "Nobody is listed under servings yet" a second
  before the rows arrive, and the person reading it concludes the fellowship has no servings — the
  same wrong conclusion an empty community genuinely invites. So every list on these pages now holds
  `null` until its read lands, and this box is what stands in the gap: `null` means still reading,
  `[]` means really nothing there.

  It is boxes rather than a spinner for the same reason the register is a table: the shape of the
  thing on the screen tells you what is arriving. Cards are asked for where the page shows cards and
  rows where it shows rows, and the line above them is the words a screen reader gets, because a
  shape carries no meaning to anybody who cannot see it.

  Nothing here decides when a read is finished — that stays in the page holding the state. This only
  draws the gap, and it carries its own css so a page does not have to know what a loading list is
  made of.
*/

const css = `
.lb{margin:14px 0 0}
.lb .say{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;margin:0 0 12px}
.lb .fill{display:grid;gap:10px}
.lb .row{display:flex;align-items:center;gap:12px}
.lb .dot{flex:none;width:34px;height:34px}
.lb .cell{height:38px;flex:1 1 0;min-width:0}
.lb .cell.wide{flex-grow:2}
.lb .cell.mid{flex-grow:1.3}
.lb .card{display:block;height:96px}
.lb .dot,.lb .cell,.lb .card{
  border:1px solid #e8e8e8;
  background:linear-gradient(90deg,#f5f5f5 0%,#eaeaea 42%,#f5f5f5 82%);
  background-size:240% 100%;
  animation:lb-slide 1.25s ease-in-out infinite;
}
/* The radius is said after the shared block rather than inside it: two selectors of the same weight
   on one property and the later one wins, so a round skeleton avatar written first would have been
   squared by the 2px that belongs to the rows beside it. */
.lb .cell,.lb .card{border-radius:2px}
.lb .dot{border-radius:50%}
.lb.cards .fill{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
@keyframes lb-slide{0%{background-position:130% 0}100%{background-position:-30% 0}}
/* The shimmer is the only moving thing on these pages, and a person who would rather nothing moved
   is not a person who needs it to find out that a read is still running — the line above says that. */
@media (prefers-reduced-motion:reduce){
  .lb .dot,.lb .cell,.lb .card{animation:none;background:#f2f2f2}
}
`;

export default function LoadingBoxes({ kind = "rows", count = 3, words = "Loading…" }) {
  // A page asking for 400 skeleton rows has misread what this is for, and one asking for none has
  // asked for a blank, which is the thing this whole component exists to stop.
  const n = Math.max(1, Math.min(Math.round(Number(count)) || 3, 12));
  const cards = kind === "cards";

  return (
    <div className={`lb ${cards ? "cards" : "rows"}`}>
      <style>{css}</style>
      <p className="say" role="status" aria-live="polite">
        {words}
      </p>
      <div className="fill" aria-hidden="true">
        {Array.from({ length: n }, (_, index) =>
          cards ? (
            <span className="card" key={index} />
          ) : (
            <span className="row" key={index}>
              <span className="dot" />
              <span className="cell wide" />
              <span className="cell mid" />
              <span className="cell" />
            </span>
          ),
        )}
      </div>
    </div>
  );
}
