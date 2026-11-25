import React, { useEffect, useState } from "react";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";

const functions = new ChurchFunctionsFetch();

/*
  The register of everything this community has planned, read by the functions page and shown on it,
  carried in its own file so the list changes here and nowhere else. Newest day first — the same
  order the read itself asks the table for, so the page and the query agree about what "recent" means
  and a phone scrolling the cards gets the same sequence as a desktop table.

  Each row ends in a button that opens that one function, and the page keeps the answer rather than the
  url: which function is open is its state, so Back returns to the same register instead of a route.
  The page only mounts this with a community chosen — nothing is read for a blank one. Nothing here
  decides whether a function may be opened: /api/leader has already refused a caller who does not lead
  or admin the community_id the rows were read for, and the read underneath compares every function
  with that same community, so a list built from a fellowship this caller has no part in cannot be
  assembled in the first place.

  The columns are the ones a leader scans for a decision — what, when, where, what it costs, and how
  many have answered. The three counts are made by the database on the same read that lists the
  functions, so the register costs one request whatever the fellowship has planned, and the answer
  rows themselves never cross the wire to be counted here.
*/

const css = `
.vf{margin:0}
.vf .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.vf table{width:100%;border-collapse:collapse;font-size:15px}
.vf th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.vf td{padding:12px 14px;border-bottom:1px solid #e3e3e3;vertical-align:middle}
.vf tbody tr:last-child td{border-bottom:0}
.vf tbody tr:hover td{background:#fafafa}
.vf .free{color:#666}
.vf .tally{text-align:right;font-variant-numeric:tabular-nums}
.vf th.tally{text-align:right}
.vf .hint{font-size:13px;color:#666;margin:14px 0 0}
.vf .note{background:#f4f4f4;border-left:3px solid #a11111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.vf .open{width:1%;white-space:nowrap}
.vf .open button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:7px 14px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
.vf .open button:hover{background:#111;color:#fff}

/*
  Eight columns will not sit side by side on a phone, so below 640px the register stops being a table
  and becomes one card per function, each cell reading its own data-label — the same move the servings
  and attendance registers make. Adding a ninth column later means writing its label on the new cell
  and touching nothing else here.
*/
@media (max-width:640px){
  .vf .tablewrap{border:0;overflow-x:visible}
  .vf table,.vf tbody{display:block}
  .vf thead{display:none}
  .vf tr{display:block;border:1px solid #e3e3e3;border-radius:2px;margin:0 0 10px}
  .vf tr:last-child{margin-bottom:0}
  .vf td{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f0f0f0}
  .vf td:last-child{border-bottom:0}
  .vf tbody tr:last-child td{border-bottom:1px solid #f0f0f0}
  .vf tr:last-child td:last-child{border-bottom:0}
  .vf td::before{content:attr(data-label);flex:none;width:72px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600}
  .vf td>*,.vf td{min-width:0;overflow-wrap:anywhere}
  .vf td.tally{justify-content:space-between}
  /*
    The desktop table holds this last column at 1% wide, which is a trick for a real table column and
    a literal handful of pixels in a card: the button was squeezed into that sliver and its own words
    ran out over the cell, which is why it read as tiny and cut off. The width is dropped with the
    table it belonged to, so the cell takes the row's whole width and the button keeps its own size on
    one line, with enough padding to be a comfortable thumb target.
  */
  .vf td.open{width:auto}
  .vf td.open button{flex:none;width:auto;min-width:0;white-space:nowrap;overflow-wrap:normal;padding:12px 18px;font-size:15px}
}
`;

// The day as the community says it, not the UTC day the column's midnight falls on. A `date` column
// has no time in it, so the T00:00:00 is what keeps a 31 December from printing as 30 December in a
// browser standing west of Greenwich.
export function pretty(date) {
  if (!date) return "—";
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? date
    : read.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/*
  A person in words, or the asking page's own words for there being no name. Every label the reads hand
  out falls back to the email when the `users` table holds nobody by that address, which is sound
  advice for a row that has to be keyed on something and the one thing a screen must not print: an
  address is how somebody signs in, not who they are. So a page asks this with the label, the address
  behind it, and what to say where the two are the same thing.
*/
export function named(label, email, missing) {
  return label && label !== email ? label : missing;
}

// A price, or the plain word for there not being one — a blank reads as a number nobody typed. The
// table's own check guarantees a paid function has an amount above zero, so the second branch is only
// reached by a row written outside the page. Kept to this file: the opened-out function says its price
// in a sentence instead, and a sentence wants the number rather than the element.
function price(one) {
  if (!one.requires_payment) return <span className="free">Free</span>;
  const amount = Number(one.amount);
  return Number.isFinite(amount) ? `R ${amount.toFixed(2)}` : <span className="free">—</span>;
}

export default function ViewFunctions({ community_id, reload, onOpen }) {
  // `null` until the first read lands, so an empty community and a read still in flight are not the
  // same screen: one says nothing has been planned, the other has nothing to say yet.
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    functions
      .getFunctions(community_id)
      .then((list) => {
        if (!live) return;
        setRows(list || []);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        setError(e.message);
      });
    return () => {
      live = false;
    };
    // `reload` is what the page bumps after a function is planned, so the new row arrives with the
    // write that created it rather than with whatever the next click happens to be.
  }, [community_id, reload]);

  const listed = rows || [];
  const paid = listed.filter((one) => one.requires_payment).length;

  return (
    <section className="vf">
      <style>{css}</style>
      <h3>
        Planned functions
        {listed.length ? <span className="count">{listed.length}</span> : null}
      </h3>

      {error && <div className="note">{error}</div>}

      {listed.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>Date</th>
                <th>Location</th>
                <th>Cost</th>
                <th className="tally">Going</th>
                <th className="tally">Paid</th>
                <th className="tally">Promised</th>
                <th className="open">Open</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((one) => (
                <tr key={one.id}>
                  <td data-label="Function">{one.name}</td>
                  <td data-label="Date">{pretty(one.function_date)}</td>
                  <td data-label="Location">
                    {one.location || <span className="free">—</span>}
                  </td>
                  <td data-label="Cost">{price(one)}</td>
                  <td className="tally" data-label="Going">
                    {one.going}
                  </td>
                  <td className="tally" data-label="Paid">
                    {one.paid}
                  </td>
                  <td className="tally" data-label="Promised">
                    {one.promised}
                  </td>
                  <td className="open" data-label="Open">
                    <button type="button" onClick={() => onOpen(one)}>
                      View function
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error &&
        rows !== null && (
          <p className="sub">Nothing has been planned for this community yet.</p>
        )
      )}

      <p className="hint">
        {listed.length
          ? `${listed.length} ${
              listed.length === 1 ? "function" : "functions"
            } planned, ${paid} of them ${
              paid === 1 ? "asks" : "ask"
            } for money, newest day first. Going counts the people who said they will be there, Paid counts the receipts that have gone up and Promised the ones that gave a date instead — a function planned a minute ago is listed with noughts beside it because nobody has answered either yet.`
          : "A function carries its own attendance and its own money, kept one row per person under it."}
      </p>
    </section>
  );
}
