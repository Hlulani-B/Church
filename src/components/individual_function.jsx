import React, { useEffect, useState } from "react";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";
import { UserFetch } from "../page_functions/user.js";
import AbsenceFor, { displayName } from "./absence_for.jsx";
import { pretty } from "./view_functions.jsx";

const functions = new ChurchFunctionsFetch();
const directory = new UserFetch();

/*
  One function opened out: what was planned at the top, and underneath it the people whose answers
  sit under that function, split into the states a leader actually acts on.

  Which states exist is decided by the function itself, off `requires_payment` — the same column the
  table's `amount_matches_payment` check ties the price to. A paid function has four: receipts that
  somebody has confirmed, receipts waiting for a leader, promises that gave a date instead of money,
  and the people who said they are not coming. A free one has two: coming, and not. Nothing is
  invented for the free case, because `paid_fields_match` only lets a money row be a receipt or a
  promise and a free function has no reason to hold either.

  The sections are filters over one list, not six reads. The buttons sit above and only the chosen
  one's rows are drawn, so a leader checking up on money is looking at exactly the people they are
  checking up on. A person can appear in two of them at once — somebody who promised a date and then
  said they were not coming is in both, which is the truth of those two rows rather than a mistake in
  the folding.

  The box above the sections answers "where does this one person stand". It is the same For-who box
  the absence forms use: it searches by name and surname and shows nothing but names, while the
  address it keeps is the key — `user_email` is what both child tables are keyed on besides the
  function, so the lookup is a single map read off what has already been fetched. A person on the
  roster with no row under the function is not missing from the answer: "nothing recorded yet" is
  itself the answer, and the honest one.
*/

const css = `
.fn{margin:0}
.fn .back{display:inline-block;background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:8px 16px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;margin:0 0 22px}
.fn .back:hover{background:#111;color:#fff}
.fn .facts{border:1px solid #e3e3e3;border-radius:2px;padding:4px 18px;margin:22px 0 0}
.fn .facts div{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}
.fn .facts div:last-child{border-bottom:0}
.fn .facts dt{flex:none;width:130px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding-top:3px}
.fn .facts dd{margin:0;font-size:15px;min-width:0;overflow-wrap:anywhere}
.fn .facts .free{color:#666}

.fn .ask{margin:34px 0 0}
.fn .ask p{font-size:14px;color:#666;margin:0 0 10px}
.fn .stand{border-left:3px solid #111;background:#f4f4f4;padding:12px 16px;margin:16px 0 0;font-size:15px}
.fn .stand dl{display:flex;flex-wrap:wrap;gap:6px 28px;margin:8px 0 0}
.fn .stand dt{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600}
.fn .stand dd{margin:2px 0 0}
.fn .stand .free{color:#666}

.fn .tabs{display:flex;flex-wrap:wrap;gap:8px;margin:38px 0 0}
.fn .tabs button{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:999px;padding:8px 16px;font-size:14px;font-family:inherit;cursor:pointer}
.fn .tabs button:hover{border-color:#111}
.fn .tabs button.now{background:#111;color:#fff;border-color:#111;font-weight:600}
.fn .tabs .count{font-variant-numeric:tabular-nums;opacity:.7}

.fn .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.fn table{width:100%;border-collapse:collapse;font-size:15px}
.fn th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.fn td{padding:12px 14px;border-bottom:1px solid #e3e3e3;vertical-align:top}
.fn tbody tr:last-child td{border-bottom:0}
.fn .who{font-weight:600}
.fn .mail{display:block;font-size:13px;font-weight:400;color:#666;margin-top:2px}
.fn .free{color:#666}
.fn .none{margin:14px 0 0;font-size:15px;color:#666}
.fn .note{background:#f4f4f4;border-left:3px solid #a11111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.fn .aside{background:#f4f4f4;border-left:3px solid #bdbdbd;padding:12px 16px;font-size:14px;margin:18px 0 0}

@media (max-width:860px){
  .fn .facts div{flex-direction:column;gap:2px}
  .fn .facts dt{width:auto;padding-top:0}
}

/* The same move as the register above: below 640px each person becomes a card and every cell reads
   its own column heading. */
@media (max-width:640px){
  .fn .tablewrap{border:0;overflow-x:visible}
  .fn table,.fn tbody{display:block}
  .fn thead{display:none}
  .fn tr{display:block;border:1px solid #e3e3e3;border-radius:2px;margin:0 0 10px}
  .fn tr:last-child{margin-bottom:0}
  .fn td{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid #f0f0f0}
  .fn td:last-child{border-bottom:0}
  .fn td::before{content:attr(data-label);flex:none;width:96px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding-top:3px}
  .fn td>*,.fn td{min-width:0;overflow-wrap:anywhere}
}
`;

// A moment from a `timestamptz`, in the browser's own zone. No T00:00:00 here, because the column
// already carries an instant — adding one would be reading it as a wall-clock day instead.
function stamp(value) {
  if (!value) return null;
  const read = new Date(value);
  return Number.isNaN(read.getTime())
    ? String(value)
    : read.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// A receipt is only a confirmed receipt when a name and a moment both went with it. The check on the
// table makes `confirmed_at` follow `confirmed_by`, but never the other way round, so both are asked
// for and an half-written confirmation reads as still waiting rather than as done.
const isConfirmed = (one) => Boolean(one.confirmed_by && one.confirmed_at);

// The price in words. Spelled out here rather than reused from the register's `price` because these
// lines are built as sentences, and a sentence cannot hold a React element — the register's version
// returns one for a free function, which would print as [object Object]. A paid row with no number in
// it is impossible through the page and only arrives from a hand-written insert, so it is said around.
const amountOf = (one) =>
  Number.isFinite(Number(one?.amount)) ? `R ${Number(one.amount).toFixed(2)}` : "an amount nobody typed";

const dash = <span className="free">—</span>;

export default function IndividualFunction({ community_id, function_id, onBack }) {
  const [detail, setDetail] = useState(null);
  const [peopleList, setPeopleList] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(null);
  const [chosenEmail, setChosenEmail] = useState("");

  useEffect(() => {
    let live = true;
    functions
      .getFunctionDetails({ community_id, function_id })
      .then((result) => {
        if (!live) return;
        setDetail(result);
      })
      .catch((e) => {
        if (!live) return;
        setError(e.message);
      });
    // The roster is read alongside, not folded into the details: the lookup has to be able to name
    // somebody who has not answered yet, and a list built only from answers could not.
    directory
      .getUsers(community_id)
      .then((list) => live && setPeopleList(list || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [community_id, function_id]);

  const one = detail?.function;
  const answers = detail?.people || [];
  const paidFunction = Boolean(one?.requires_payment);

  const sections = paidFunction
    ? [
        {
          key: "confirmed",
          label: "Paid and confirmed",
          picks: (person) => person.paid && isConfirmed(person),
          columns: [
            { head: "Person", cell: personCell },
            { head: "Receipt up", cell: (p) => show(stamp(p.proof_submitted_at)) },
            { head: "Confirmed by", cell: (p) => <span className="mail">{p.confirmed_by}</span> },
            { head: "Confirmed on", cell: (p) => show(stamp(p.confirmed_at)) },
          ],
        },
        {
          key: "waiting",
          label: "Receipts to check",
          picks: (person) => person.paid && !isConfirmed(person),
          columns: [
            { head: "Person", cell: personCell },
            { head: "Receipt up", cell: (p) => show(stamp(p.proof_submitted_at)) },
            { head: "File", cell: (p) => <span className="mail">{p.proof_path || dash}</span> },
          ],
        },
        {
          key: "promised",
          label: "Promised a date",
          picks: (person) => !person.paid && person.expected_pay_date,
          columns: [
            { head: "Person", cell: personCell },
            { head: "Promised by", cell: (p) => show(pretty(p.expected_pay_date)) },
            { head: "Coming", cell: (p) => coming(p) },
          ],
        },
        {
          key: "away",
          label: "Not attending",
          picks: (person) => person.attending === false,
          columns: [
            { head: "Person", cell: personCell },
            { head: "Money", cell: (p) => money(p, one) },
          ],
        },
      ]
    : [
        {
          key: "coming",
          label: "Attending",
          picks: (person) => person.attending === true,
          columns: [{ head: "Person", cell: personCell }],
        },
        {
          key: "away",
          label: "Not attending",
          picks: (person) => person.attending === false,
          columns: [{ head: "Person", cell: personCell }],
        },
      ];

  const shown = sections.find((section) => section.key === tab) || sections[0];
  const members = shown ? answers.filter(shown.picks) : [];

  /*
    Where one person stands, read off the same folded rows the sections use. An address on the roster
    that is not among them has said nothing about this function — which is what `answers` says, not
    something the page fills in.
  */
  const looked = chosenEmail ? answers.find((person) => person.email === chosenEmail) : null;
  const lookedName = peopleList.find((person) => person.email === chosenEmail);

  if (error) {
    return (
      <div className="fn">
        <style>{css}</style>
        <button className="back" type="button" onClick={onBack}>
          ‹ All functions
        </button>
        <div className="note">{error}</div>
      </div>
    );
  }

  if (!one) {
    return (
      <div className="fn">
        <style>{css}</style>
        <p className="sub">Reading this function…</p>
      </div>
    );
  }

  return (
    <div className="fn">
      <style>{css}</style>

      <button className="back" type="button" onClick={onBack}>
        ‹ All functions
      </button>

      <p className="eyebrow">Function</p>
      <h1 className="serif">{one.name}</h1>
      <p className="sub">
        {pretty(one.function_date)}
        {one.location ? ` · ${one.location}` : ""}
      </p>

      <dl className="facts">
        <div>
          <dt>Held on</dt>
          <dd>{pretty(one.function_date)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{one.location || <span className="free">No location was written down</span>}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>
            {paidFunction
              ? `${amountOf(one)} per head`
              : <span className="free">Free — nobody pays</span>}
          </dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{one.created_by}</dd>
        </div>
        <div>
          <dt>Planned on</dt>
          <dd>{show(stamp(one.created_at))}</dd>
        </div>
        <div>
          <dt>Answers so far</dt>
          <dd>{`${answers.length} ${answers.length === 1 ? "person has" : "people have"} said something about this function`}</dd>
        </div>
      </dl>

      <div className="ask">
        <h3>Where somebody stands</h3>
        <p>Type a name and surname, or pick from the list. The address is what this looks the function up with; it stays out of the list.</p>
        <AbsenceFor people={peopleList} value={chosenEmail} onChange={setChosenEmail} />
        {chosenEmail && (
          <div className="stand">
            <strong>{displayName(lookedName) || chosenEmail}</strong>
            <div className="mail">{chosenEmail}</div>
            <dl>
              <div>
                <dt>Coming</dt>
                <dd>{looked ? coming(looked) : <span className="free">Nothing recorded yet</span>}</dd>
              </div>
              {paidFunction && (
                <div>
                  <dt>Money</dt>
                  <dd>{looked ? money(looked, one) : <span className="free">Nothing recorded yet</span>}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      <div className="tabs" role="group" aria-label="Which answers to show">
        {sections.map((section) => {
          const count = answers.filter(section.picks).length;
          return (
            <button
              key={section.key}
              type="button"
              className={shown?.key === section.key ? "now" : ""}
              aria-pressed={shown?.key === section.key}
              onClick={() => setTab(section.key)}
            >
              {section.label} <span className="count">({count})</span>
            </button>
          );
        })}
      </div>

      {members.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                {shown.columns.map((column) => (
                  <th key={column.head}>{column.head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((person) => (
                <tr key={person.email}>
                  {shown.columns.map((column) => (
                    <td key={column.head} data-label={column.head}>
                      {column.cell(person)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="none">
          Nobody in <em>{shown.label}</em> yet.
        </p>
      )}

      {!paidFunction && answers.some((person) => person.paid || person.expected_pay_date) && (
        <p className="aside">
          This function asks nobody for money, yet {answers.filter((person) => person.paid || person.expected_pay_date).length}{" "}
          {answers.filter((person) => person.paid || person.expected_pay_date).length === 1
            ? "person has" : "people have"} a payment row under it. Those rows are listed under the two
          sections above only by their attendance, so somebody should check where they came from.
        </p>
      )}
    </div>
  );
}

function personCell(person) {
  return (
    <span className="who">
      {person.label}
      {person.label !== person.email && <span className="mail">{person.email}</span>}
    </span>
  );
}

function show(value) {
  return value ? value : dash;
}

function coming(person) {
  if (person.attending === true) return "Said they will be there";
  if (person.attending === false) return "Said they will not be there";
  return <span className="free">Has not said either way</span>;
}

// The four states a `function_paid` row can be in, in the words the two columns actually allow: a
// confirmed receipt, a receipt on a leader's desk, a date given instead of money, or no row at all.
function money(person, one) {
  if (person.paid && isConfirmed(person)) {
    return `Paid ${amountOf(one)}, confirmed by ${person.confirmed_by} on ${stamp(person.confirmed_at)}`;
  }
  if (person.paid) return "Paid, waiting for somebody to check the receipt";
  if (person.expected_pay_date) return `Promised by ${pretty(person.expected_pay_date)}`;
  return <span className="free">Nothing recorded yet</span>;
}
