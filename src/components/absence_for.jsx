import React, { useState } from "react";

/*
  The one For-who box the absence forms share, carried by both attendance pages so the pick
  changes here and nowhere else. It is a dropdown whose id is an email but whose every line is
  a name and a surname — the pages hand it people read from getUsers, with the caller's own
  details at the very top — and a search box for the fellowship too big to scroll. The email
  never shows in the list; it is only what the page keeps and sends.

  Native to the form and nothing else: an <input> would put addresses in front of people, and a
  <select> cannot search. The list closes on a blur, and it holds the input's focus through a
  mousedown on the way to a choice, so the click lands before the closing could swallow it.
*/

const css = `
.kw{position:relative;display:block;min-width:240px}
.kw .pick{width:100%}
.kw .list{position:absolute;z-index:3;top:100%;left:0;right:0;max-height:220px;overflow:auto;margin:2px 0 0;padding:4px 0;list-style:none;border:1px solid #bdbdbd;border-radius:2px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.08);text-transform:none;letter-spacing:normal}
.kw .list button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 14px;font:inherit;font-size:15px;cursor:pointer}
.kw .list button:hover{background:#f4f4f4}
.kw .list button.chosen{font-weight:600}
.kw .list .empty{padding:8px 14px;color:#666;font-size:14px}
`;

// What one person is called on this page: the two names the users row holds, or the address
// when a row is somehow blank, so nobody is ever picked out of a list as an empty line.
export function displayName(one) {
  if (!one) return "";
  return `${one.name ?? ""} ${one.surname ?? ""}`.trim() || one.email || "";
}

export default function AbsenceFor({ people, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = people.find((one) => one.email === value) || null;
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? people.filter((one) => `${displayName(one)} ${one.email}`.toLowerCase().includes(needle))
    : people;

  function pick(one) {
    onChange(one.email);
    setQuery("");
    setOpen(false);
  }

  return (
    <span className="kw">
      <style>{css}</style>
      <input
        className="pick"
        type="text"
        autoComplete="off"
        placeholder={
          people.length ? "Search by name, or pick from the list" : "Loading the people…"
        }
        value={open ? query : chosen ? displayName(chosen) : ""}
        onFocus={() => setOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <ul className="list" onMouseDown={(event) => event.preventDefault()}>
          {matches.length ? (
            matches.map((one) => (
              <li key={one.email}>
                <button
                  type="button"
                  className={one.email === value ? "chosen" : ""}
                  onClick={() => pick(one)}
                >
                  {displayName(one)}
                </button>
              </li>
            ))
          ) : (
            <li className="empty">Nobody here answers to that.</li>
          )}
        </ul>
      )}
    </span>
  );
}
