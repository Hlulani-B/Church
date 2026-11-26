import { useId, useState } from "react";

/*
  A fellowship's lists only ever grow: the members, the gatherings, the servings, the people who
  answered a function. Read in one go, a hundred and forty names push everything below them off the
  screen, and the way out of a page becomes an argument with the scroll bar — the dashboard under a
  pile of rows, the menu nowhere, the next thing to look for still further down.

  So a list is shown a chunk at a time. `usePager` cuts the array it is handed and keeps track of
  which chunk is on the screen; `Pager` says which chunk that is — the 25 rows of 140 that are
  printed here, and which page of how many — and offers the two moves that fit the hand. Nothing is
  fetched differently and nothing is counted differently: the whole list is still read, so the total
  is the real total and a search still answers for every row it matched, not just the ones shown.

  Because it is a hook rather than a wrapper element, it costs one line where a list already is and
  never re-styles the page it lands on. The control carries its own css, scoped under `kp-pg`, the
  same way the loading boxes and the back link do, so it looks the same at the bottom of a table, a
  column of cards and a popup, none of which share a stylesheet.

  Turning a chunk moves the screen back to where the list begins. A reader who asked for the next
  twenty-five names wants to read them from the first, not to find themselves at the foot of a
  page that has just changed underneath them. The host marks that place by giving the element its
  rows start at the hook's `anchorId`; a list that does not is simply left where it is. An id
  rather than a ref, because a page reads the chunk it is printing and a ref must not be read
  while a render is happening — an id is only a name, and it travels in the same harmless bag.

    const people = usePager(listed, PER_PAGE, find);
    ...
    <div className="tablewrap" id={people.anchorId}>
      {people.chunk.map((one) => ...)}
    </div>
    <Pager state={people} noun="people" />
*/

// How many rows a list shows before it is cut. Long enough that a small fellowship never sees a
// second page at all, short enough that the heading of a page stays on the screen with it.
export const PER_PAGE = 25;

const css = `
.kp-pg{margin:18px 0 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.kp-pg .say{font-size:14px;color:#666;margin:0}
.kp-pg .go{display:flex;align-items:center;gap:10px}
.kp-pg .step{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:9px 18px;font:inherit;font-size:14px;font-family:inherit;cursor:pointer}
.kp-pg .step:hover:not(:disabled){border-color:#111}
.kp-pg .step:disabled{opacity:.45;cursor:default}
.kp-pg .which{font-size:14px;color:#666;min-width:104px;text-align:center}
`;

/*
  `items` is the finished list, in the order the page wants it: paging happens after the search and
  the sorting, never before them, so a filtered list and a sorted one keep meaning what they say.
  `reset` is whatever makes the list a different list — a search box, a chosen community, an open
  tab; when it changes, the first chunk is what comes back.
*/
export function usePager(items, size = PER_PAGE, reset = null) {
  const rows = Array.isArray(items) ? items : [];
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));

  const [page, setPage] = useState(0);
  /*
    The name of the element a list starts at, so that a turned chunk can be read from its first row
    rather than from wherever the previous twenty-five left the eye. `useId` keeps it unique when a
    page carries several lists and steady while it renders them.
  */
  const anchorId = useId();
  /*
    Which list these pages belong to, said plainly: a chosen community, a word typed into a search
    box, an opened tab. A different one of those is a different list, and page four of the list
    before has no meaning in this one, so the reading starts again at the first chunk. The change is
    noticed while rendering rather than in an effect afterwards, because an effect would print a
    page of the old list for a frame before correcting itself.
  */
  const [marked, setMarked] = useState("");
  const signal = String(reset ?? "");

  if (marked !== signal) {
    setMarked(signal);
    setPage(0);
  }

  /*
    Rows leave a list — somebody is removed, a filter tightens — and a page past the end of what is
    left would print nothing at all, so the last chunk there is gets shown instead. Mended on the
    way out rather than stored away, since nothing about the page needs to know the difference.
  */
  const shown = Math.min(page, pages - 1);
  const start = shown * size;
  const end = Math.min(start + size, total);

  /*
    The scroll waits for the frame after the click. The new rows are only on the screen once React
    has committed and painted them; asking sooner scrolls to where the old ones still are.
  */
  function turn(where) {
    if (where < 0 || where > pages - 1) return;
    setPage(where);
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return {
    chunk: rows.slice(start, end),
    from: start + 1,
    to: end,
    total,
    page: shown,
    pages,
    paging: total > size,
    anchorId,
    previous: () => turn(shown - 1),
    next: () => turn(shown + 1),
  };
}

/*
  Which chunk is on the screen, and the two moves between chunks. It says the number of rows rather
  than only the page, because "1–25 of 140" answers the question a person scrolling a roster is
  actually asking: how much of this fellowship is still down there.
*/
export default function Pager({ state, noun = "" }) {
  const { from, to, total, page, pages, paging, previous, next } = state;
  if (!total) return null;

  return (
    <div className="kp-pg">
      <style>{css}</style>
      <p className="say">
        Showing {from}–{to} of {total}
        {noun ? ` ${noun}` : ""}.
      </p>
      {paging ? (
        <span className="go">
          <button type="button" className="step" disabled={page === 0} onClick={previous}>
            &larr; Previous
          </button>
          <span className="which">
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            className="step"
            disabled={page >= pages - 1}
            onClick={next}
          >
            Next &rarr;
          </button>
        </span>
      ) : null}
    </div>
  );
}
