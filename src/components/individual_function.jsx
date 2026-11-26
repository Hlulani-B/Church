import React, { useEffect, useState } from "react";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";
import { UserFetch } from "../page_functions/user.js";
import AbsenceFor, { displayName, UNNAMED_PERSON } from "./absence_for.jsx";
import ProofViewer from "./proof_viewer.jsx";
import ExtraFunctionAttending from "./extra_function_attending.jsx";
import ExtraFunctionPaid from "./extra_function_paid.jsx";
import LoadingBoxes from "./loading_boxes.jsx";
import DownloadFunctionData from "./download_function_data.jsx";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";
import { named, pretty } from "./view_functions.jsx";

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

  The proof of payment is opened rather than printed. Every receipt gets its own column, in both of
  the sections that hold one, and clicking it draws the file over this screen — so a leader checking a
  name against a bank reference never has to leave the row they are checking, and never has to read a
  storage url to work out what they are allowed to look at.

  Nobody on this page is an email address, and no page anywhere else is either: the fellowship's rule
  is that a person sees only their own address and everybody else by name and surname. So every
  person here is the name the users table holds, through the same one read that names the planner,
  everybody who answered and whoever signed a receipt off, because a bare address answers none of the
  questions a register is read for. Where that read finds no name the page says so in words instead —
  `named` for what the reads hand over, `displayName` for the person the For-who box picked.
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

/* The archive sits under the facts and above the register, which is the order the page is read in:
   what was planned, then save it, then who answered. */
.fn .tools{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;margin:24px 0 0}

.fn .ask p{font-size:14px;color:#666;margin:0 0 10px}
.fn .stand{border-left:3px solid #111;background:#f4f4f4;padding:12px 16px;margin:16px 0 0;font-size:15px}
.fn .stand dl{display:flex;flex-wrap:wrap;gap:6px 28px;margin:8px 0 0}
.fn .stand dt{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600}
.fn .stand dd{margin:2px 0 0}
.fn .stand .wide{flex:1 1 100%}
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
.fn .free{color:#666}
.fn .none{margin:14px 0 0;font-size:15px;color:#666}
.fn .note{background:#f4f4f4;border-left:3px solid #a11111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.fn .aside{background:#f4f4f4;border-left:3px solid #bdbdbd;padding:12px 16px;font-size:14px;margin:18px 0 0}

/* The one button the register offers on a row rather than in its header. Smaller than the page's own
   buttons on purpose: it acts on a single person, and the row it sits in already says who. */
.fn .mini{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:7px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap}
.fn .mini:hover{background:#111;color:#fff}
.fn .mini:disabled{opacity:.45;cursor:default;background:#fff;color:#111}

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

/*
  A person on this page in words, never as an address, which is what `named` is for. The wording for a
  person the users table has no name for is the For-who box's own, imported rather than repeated here;
  only the leader's version is settled on this page, because a confirmer and an answerer are not the
  same kind of person to a leader reading a register. The Money sentence uses the leader's version
  lower-cased, because it sits mid-sentence.
*/
const UNNAMED_LEADER = "A leader this fellowship has not named";

export default function IndividualFunction({ community_id, function_id, onBack, email }) {
  const [detail, setDetail] = useState(null);
  const [peopleList, setPeopleList] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(null);
  const [chosenEmail, setChosenEmail] = useState("");
  /*
    The one write this page makes, and the two things it has to say while that write is on its way:
    whose row is being saved, and where the last attempt failed. `refresh` reads the function again
    afterwards rather than recolouring the button, because a confirmation moves a person from one
    section to the other and both lists are cut out of the same read — leaving them in two places at
    once would be a register nobody could trust.
  */
  const [refresh, setRefresh] = useState(0);
  const [busyEmail, setBusyEmail] = useState("");
  const [actionError, setActionError] = useState("");

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
    return () => {
      live = false;
    };
  }, [community_id, function_id, refresh]);

  /*
    The roster is read beside the register, not folded into it: the lookup has to be able to name
    somebody who has not answered yet, and a list built only from answers could not. It is a separate
    effect because it answers a different question — who is in this fellowship — and a confirmation
    below changes nothing about that, so the register re-reads on its own rather than pulling every
    address in the community again for each receipt a leader checks off.
  */
  useEffect(() => {
    let live = true;
    directory
      .getUsers(community_id)
      .then((list) => live && setPeopleList(list || []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [community_id]);

  /*
    Signing a receipt off, and taking the signature back. The page names which person and which way it
    is going; the server answers who signed it, off this caller's own token, so a leader's name on a
    row means they were the one sitting here. A failure is said above the table rather than in the
    row, because a row that refuses to move is otherwise indistinguishable from a click that never
    landed.
  */
  async function check(person, answer) {
    setBusyEmail(person.email);
    setActionError("");
    try {
      await functions.confirmPayment({
        community_id,
        function_id,
        user_email: person.email,
        confirm: answer,
      });
      setRefresh((count) => count + 1);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusyEmail("");
    }
  }

  // One column of buttons, built for whichever way it goes. `true` is the receipt on the leader's desk
  // being checked off; `false` is the same button under a name already signed, for the mistake.
  const actionCell = (answer) => (person) => (
    <button
      className="mini"
      type="button"
      disabled={busyEmail === person.email}
      onClick={() => check(person, answer)}
    >
      {busyEmail === person.email ? "Saving…" : answer ? "Confirm" : "Unconfirm"}
    </button>
  );

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
            {
              head: "Confirmed by",
              cell: (p) => show(named(p.confirmed_by_label, p.confirmed_by, UNNAMED_LEADER)),
            },
            { head: "Confirmed on", cell: (p) => show(stamp(p.confirmed_at)) },
            { head: "Proof", cell: proofCell },
            { head: "Actions", cell: actionCell(false) },
          ],
        },
        {
          key: "waiting",
          label: "Receipts to check",
          picks: (person) => person.paid && !isConfirmed(person),
          columns: [
            { head: "Person", cell: personCell },
            { head: "Receipt up", cell: (p) => show(stamp(p.proof_submitted_at)) },
            { head: "Proof", cell: proofCell },
            { head: "Actions", cell: actionCell(true) },
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

  // Money rows under a function that asks for nothing are not anybody's business to invent, so they
  // are counted once here and said about once below, rather than filtered three times on the way to
  // one sentence.
  const unexpected = answers.filter((person) => person.paid || person.expected_pay_date);

  /*
    The register under a section is cut into chunks. A function that a whole fellowship has answered
    used to run thirty rows down before the extra members below it, the payment proof column long
    since out of sight; ten of them are listed, and the line beneath says how many the
    section holds altogether.
  */
  const register = usePager(members, PER_PAGE, `${function_id}|${tab}`);

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
        <LoadingBoxes count={4} words="Reading this function…" />
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
          {/* Named by the read the answers are named by, because `created_by` holds an address and a
              leader reading this wants the person. */}
          <dt>Created by</dt>
          <dd>{show(named(detail.planned_by, one.created_by, UNNAMED_PERSON))}</dd>
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

      {/* The page as a file: the plan, every answer, and the receipts pasted in with the path they
          came from written under them — what an admin needs before clearing old functions. */}
      <div className="tools">
        <DownloadFunctionData
          community_id={community_id}
          function_id={function_id}
          name={one.name}
          detail={detail}
        />
      </div>

      <div className="ask">
        <h3>Where somebody stands</h3>
        <p>Type a name and surname, or pick from the list. The address is what this looks the function up with; it stays out of the list.</p>
        <AbsenceFor people={peopleList} value={chosenEmail} onChange={setChosenEmail} />
        {chosenEmail && (
          <div className="stand">
            <strong>{displayName(lookedName) || UNNAMED_PERSON}</strong>
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
              {paidFunction && looked?.paid && (
                <div className="wide">
                  <dt>Proof</dt>
                  <dd>{proofCell(looked)}</dd>
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

      {actionError && <div className="note">{actionError}</div>}

      {members.length ? (
        <div className="tablewrap" id={register.anchorId}>
          <table>
            <thead>
              <tr>
                {shown.columns.map((column) => (
                  <th key={column.head}>{column.head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {register.chunk.map((person) => (
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
      <Pager state={register} noun={register.total === 1 ? "person" : "people"} />

      {!paidFunction && unexpected.length > 0 && (
        <p className="aside">
          This function asks nobody for money, yet {unexpected.length}{" "}
          {unexpected.length === 1 ? "person has" : "people have"} a payment row under it. Those rows
          are listed under the two sections above only by their attendance, so somebody should check
          where they came from.
        </p>
      )}

      {/* The people who never joined cannot answer for themselves on the register above, so their
          standing under this plan is stated here: whether they are coming, and — when the function
          costs something — what they owe, paid and proved. */}
      <ExtraFunctionAttending communityId={community_id} functionId={function_id} email={email} />
      {paidFunction && (
        <ExtraFunctionPaid communityId={community_id} functionId={function_id} email={email} />
      )}
    </div>
  );
}

// A person, by name. The address they are keyed on is not shown anywhere on this page: it is what the
// two child tables are joined with, not a thing a leader reads.
function personCell(person) {
  return <span className="who">{named(person.label, person.email, UNNAMED_PERSON)}</span>;
}

/*
  Whose receipt it is, said in the viewer's own caption. An unknown name leaves the caption out rather
  than filling it with an address — the button still says what it is a picture of.
*/
function proofCell(person) {
  return <ProofViewer url={person.proof_path} label={named(person.label, person.email, "")} />;
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
    return `Paid ${amountOf(one)}, confirmed by ${named(
      person.confirmed_by_label,
      person.confirmed_by,
      UNNAMED_LEADER.toLowerCase(),
    )} on ${stamp(person.confirmed_at)}`;
  }
  if (person.paid) return "Paid, waiting for somebody to check the receipt";
  if (person.expected_pay_date) return `Promised by ${pretty(person.expected_pay_date)}`;
  return <span className="free">Nothing recorded yet</span>;
}
