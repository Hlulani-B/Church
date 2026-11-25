import React, { useState } from "react";

/*
  The one searchable people box the whole app shares, so a pick is made the same way everywhere.

  It was asked for because the same choice keeps coming up: who to authorise on a testimony, which
  extra member an attendance record or a payment belongs to, who an absence is being filed for. Each
  of those is "pick a person out of a list", and each of those wants the same rules:

    - the value is an id the page keeps (a real user's email, an extra member's uuid), never shown;
    - every line a person sees is a name and a surname, because the fellowship's rule is that nobody
      is shown anybody else's address — only their own, which no box like this ever prints;
    - a box that searches, because a fellowship is bigger than a scroll and people are found by the
      name they answer to; and
    - it may pick one person or several, so `multiple` turns the box from a single choice into chips
      you add and remove.

  It is presentational on purpose: it is handed its `people`, not a community_id, so it can list a
  community's users one moment and its extra members the next. The two `map…` helpers below turn the
  shapes the page functions already return into the {id, name, surname} this box reads, so a call site
  is one line. Like AbsenceFor, it is native to the form — an <input> would leak addresses and a
  <select> cannot search — and it keeps the input's focus through a mousedown on the way to a click.
*/

const css = `
.pw{position:relative;display:block;min-width:240px}
.pw .pick{width:100%;font:inherit;font-size:16px;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.pw .pick:focus{outline:none;border-color:#111}
.pw .pick:disabled{background:#f4f4f4;color:#888;cursor:default}
.pw .chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.pw .chip{display:inline-flex;align-items:center;gap:7px;background:#f1f1f1;border:1px solid #e0e0e0;border-radius:14px;padding:3px 8px 3px 11px;font-size:14px;text-transform:none;letter-spacing:normal}
.pw .chip button{border:0;background:#d7d7d7;color:#333;border-radius:50%;width:18px;height:18px;line-height:18px;font-size:13px;cursor:pointer;padding:0}
.pw .chip button:hover{background:#c3c3c3}
.pw .list{position:absolute;z-index:4;top:100%;left:0;right:0;max-height:220px;overflow:auto;margin:2px 0 0;padding:4px 0;list-style:none;border:1px solid #bdbdbd;border-radius:2px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.08);text-transform:none;letter-spacing:normal}
.pw .list button{display:block;width:100%;text-align:left;border:0;background:#fff;padding:8px 14px;font:inherit;font-size:15px;cursor:pointer}
.pw .list button:hover{background:#f4f4f4}
.pw .list button.chosen{font-weight:600}
.pw .list .empty,.pw .list .done{padding:8px 14px;color:#666;font-size:14px}
`;

/*
  What one person is called: the two names a row holds, or these words when it holds none. An address
  never stands in for a name, and an empty line is no answer either — the same rule AbsenceFor keeps.
*/
export const UNNAMED_PERSON = "Somebody this fellowship has not named";

export function personName(one) {
  if (!one) return "";
  return `${one.name ?? ""} ${one.surname ?? ""}`.trim() || UNNAMED_PERSON;
}

// The community's people (email, name, surname) → the shape this box reads, with email as the id.
export function mapUsers(users) {
  return (users || []).map((one) => ({ id: one.email, name: one.name, surname: one.surname }));
}

// Extra members (member_id, name, surname) → the shape this box reads, with the uuid as the id.
export function mapExtraMembers(members) {
  return (members || []).map((one) => ({ id: one.member_id, name: one.name, surname: one.surname }));
}

/*
  `value` is one id when single and a list of ids when `multiple`. `onChange` is handed back the same
  shape it was given: the picked id for a single box, the new whole list for a multi one.
*/
export default function PeoplePicker({
  people = [],
  value,
  onChange,
  multiple = false,
  placeholder = "Search by name, or pick from the list",
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const chosenIds = multiple
    ? Array.isArray(value) ? value : []
    : value ? [value] : [];

  const isChosen = (id) => chosenIds.includes(id);

  const needle = query.trim().toLowerCase();
  const matches = people.filter((one) => {
    if (multiple && isChosen(one.id)) return false;
    return needle ? personName(one).toLowerCase().includes(needle) : true;
  });

  function pick(one) {
    if (multiple) {
      onChange([...chosenIds, one.id]);
      setQuery("");
      // Stay open so several people can be added in a row.
    } else {
      onChange(one.id);
      setQuery("");
      setOpen(false);
    }
  }

  function drop(id) {
    onChange(chosenIds.filter((one) => one !== id));
  }

  // When closed, a single box wears the chosen name in the field; a multi box keeps its field clear
  // because the chips above already show who is chosen.
  const fieldValue = !open && !multiple && value
    ? personName(people.find((one) => one.id === value) || { id: value })
    : query;

  return (
    <span className="pw">
      <style>{css}</style>

      {multiple && chosenIds.length > 0 && (
        <div className="chips">
          {chosenIds.map((id) => (
            <span className="chip" key={id}>
              {personName(people.find((one) => one.id === id) || { id })}
              <button type="button" aria-label="Remove" disabled={disabled} onClick={() => drop(id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className="pick"
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={people.length ? placeholder : "Loading the people…"}
        value={fieldValue}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => setOpen(false)}
      />

      {open && !disabled && (
        <ul className="list" onMouseDown={(event) => event.preventDefault()}>
          {matches.length ? (
            matches.map((one) => (
              <li key={one.id}>
                <button
                  type="button"
                  className={!multiple && one.id === value ? "chosen" : ""}
                  onClick={() => pick(one)}
                >
                  {personName(one)}
                </button>
              </li>
            ))
          ) : (
            <li className={needle || !people.length ? "empty" : "done"}>
              {needle
                ? "Nobody here answers to that."
                : multiple
                  ? "Everyone on the list is already chosen."
                  : "Nobody here yet."}
            </li>
          )}
        </ul>
      )}
    </span>
  );
}
