import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { ChurchFunctionsFetch } from "../page_functions/church_functions.js";
import { uploadProof } from "../page_functions/function_files.js";
import ProofViewer from "../components/proof_viewer.jsx";
import { named, pretty } from "../components/view_functions.jsx";
import Menu from "../components/menu.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const functions = new ChurchFunctionsFetch();

/*
  One function, answered. This is the page an invitation opens: what was planned and by whom at the
  top, then what this address has already said, then the form that says it — the same form whether it
  is the first answer or the fourth edit, because an answer here is one row per person and saving
  again changes it rather than adding to it.

  Two questions are asked, and the second only exists on some functions. Coming or not coming is
  asked of everybody, always. The money is only asked when `requires_payment` says so, and then it is
  asked as a choice between the two things a person can actually have: a receipt they can attach, or
  a day they mean to pay by. Neither of those is compulsory — a person who has nothing to show and no
  day to give records only their attendance, and the panel above the form says so in the same words it
  uses for everything else, because "nothing about the money yet" is a state the table can genuinely
  be in.

  What the person cannot do from here is accept their own payment. `confirmed_by` and `confirmed_at`
  belong to a leader's signature, and no field for them exists on this page or in the request the
  server is willing to take — so attaching a proof moves a row from "nothing" to "waiting", and no
  further.
*/

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au.loading{display:block}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line);position:relative;z-index:10}
.au .bar .logo{font-size:24px;text-decoration:none}
.au .menuwrap{display:flex;align-items:center;position:relative}

.au .main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.rs{margin:0}
.rs .back{display:inline-block;background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:8px 16px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;margin:0 0 22px}
.rs .back:hover{background:#111;color:#fff}

/* What was planned, in the same two-column list the leader's opened-out function uses, so the same
   facts read the same from either side of the invitation. */
.rs .facts{border:1px solid var(--line);border-radius:2px;padding:4px 18px;margin:22px 0 0}
.rs .facts div{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f0f0f0}
.rs .facts div:last-child{border-bottom:0}
.rs .facts dt{flex:none;width:130px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding-top:3px}
.rs .facts dd{margin:0;font-size:15px;min-width:0;overflow-wrap:anywhere}
.rs .free{color:var(--muted)}

/* Where this address stands, kept dark-edged because it is a record of something that has been
   written, against the grey form under it which is only the intention to write it. */
.rs .stand{border-left:3px solid #111;background:#f4f4f4;padding:16px 18px;margin:34px 0 0}
.rs .stand h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;font-weight:600}
.rs .stand p{margin:0;font-size:15px}
.rs .stand p + p{margin-top:10px}
.rs .stand .yes{font-weight:600}
.rs .stand a{font-weight:600}
.rs .stand .proof{display:flex;align-items:center;flex-wrap:wrap;gap:12px}

.rs form{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:22px 0 0;background:#fafafa}
.rs form .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.rs form .why{color:var(--muted);font-size:14px;margin:8px 0 0}
.rs fieldset{border:0;padding:0;margin:20px 0 0}
.rs legend{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0}
.rs .choice{display:flex;align-items:flex-start;gap:10px;margin:10px 0 0}
.rs .choice input{margin:4px 0 0}
.rs .choice span{font-size:15px}
.rs .detail{margin:8px 0 0 26px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.rs label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.rs input[type=text],.rs input[type=date],.rs input[type=file]{font:inherit;font-size:15px;letter-spacing:normal;text-transform:none;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:9px 12px;min-width:0;max-width:100%}
.rs input:focus{outline:none;border-color:#111}
.rs .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 24px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin:24px 0 0}
.rs .go:disabled{opacity:.5;cursor:default}
.rs .against{color:var(--muted);font-size:13px;margin:16px 0 0}
.rs .saving{color:var(--muted);font-size:14px;margin:16px 0 0}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .rs .facts div{flex-direction:column;gap:2px}
  .rs .facts dt{width:auto;padding-top:0}
}
`;

/*
  A moment from a `timestamptz`, in the browser's own zone, or nothing at all when the column is
  empty. Written here rather than shared with the leader's screen because the two pages say the same
  column in different sentences, and neither has reason to import the other.
*/
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

function cost(one) {
  const amount = Number(one?.amount);
  return Number.isFinite(amount) ? `R ${amount.toFixed(2)}` : null;
}

/*
  The words for a person these two labels cannot name. Both the planner and whoever signed a receipt
  off come back as the address when the `users` table holds nobody by it, and this page is a member's
  own — their sign-in is the only address it has any business saying out loud. So another person's
  email is said around rather than shown, the same way the leader's register says it.
*/
const UNNAMED = "somebody this community has not named";

/*
  The recorded answer, in words. One function, used both for the panel above the form and for the
  line left under the Save button after a write — so what a person is told they just saved is built
  from the row that came back rather than from what they typed, and the two cannot drift apart.

  A receipt only reads as confirmed when a name and a moment both went with it. The check on the
  table lets `confirmed_at` follow `confirmed_by` but not the other way round, so a half-written
  confirmation reads as still waiting rather than as done.
*/
function standing(you, one, asks) {
  const lines = [];
  if (you.attending === null) {
    lines.push(<p key="none">Nothing is recorded for you yet, so nobody knows whether you are coming.</p>);
  } else {
    lines.push(
      <p key="coming">
        <span className="yes">{you.attending ? "You are coming." : "You are not coming."}</span>
      </p>,
    );
  }

  if (!asks) return lines;

  const hasReceipt = Boolean(you.proof_path);
  const confirmed = Boolean(you.confirmed_by && you.confirmed_at);
  if (you.paid && confirmed) {
    lines.push(
      <p key="confirmed">
        Your payment of {cost(one) || "the amount asked"} was confirmed by{" "}
        {named(you.confirmed_by_label, you.confirmed_by, UNNAMED)} on{" "}
        {stamp(you.confirmed_at) || "a day the record does not name"}.
      </p>,
    );
  } else if (you.paid) {
    lines.push(
      <p key="waiting">
        Your receipt went up {stamp(you.proof_submitted_at) || "and is on file"}, and a leader has not
        confirmed it yet.
      </p>,
    );
  } else if (you.expected_pay_date) {
    lines.push(
      <p key="promised">
        You said you will pay by {pretty(you.expected_pay_date)}. Nothing is attached yet — put the
        proof of payment below and save it when you have it.
      </p>,
    );
  } else {
    lines.push(
      <p key="nothing">
        Nothing is recorded about the money. Attach the proof of payment below if you have paid, or
        say when you mean to.
      </p>,
    );
  }
  if (hasReceipt) {
    // The person's own receipt, opened here rather than handed to a new tab: this is the screen that
    // says what they attached, so it is the screen that should be able to show it.
    lines.push(
      <p key="file" className="proof">
        <span>The receipt on file</span>
        <ProofViewer url={you.proof_path} label={you.email} />
      </p>,
    );
  }
  return lines;
}

export default function RsvpPage() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fail, setFail] = useState("");
  const [note, setNote] = useState("");
  /*
    The three boxes, each of which starts out meaning "whatever the table already says" rather than a
    value of its own. `coming` and `way` are only switched once the person touches them, so an
    unanswered function opens on nothing chosen and an answered one opens on the truth — and a save
    that re-reads the row does not have to reach in here and reset anything.
  */
  const [comingPick, setComingPick] = useState(null);
  const [wayPick, setWayPick] = useState(null);
  const [date, setDate] = useState(null);
  const [file, setFile] = useState(null);

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  const functionId = route?.function_id;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: admin.name, email: admin.email });
  }, [communityId, admin.name, admin.email]);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  useEffect(() => {
    if (!communityId || !functionId) return;
    let live = true;
    functions
      .getRsvp({ community_id: communityId, function_id: functionId })
      .then((result) => {
        if (!live) return;
        setDetail(result);
        setError("");
      })
      .catch((e) => {
        if (!live) return;
        setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [communityId, functionId]);

  const one = detail?.function;
  const you = detail?.you;
  const asks = Boolean(one?.requires_payment);
  const coming = comingPick ?? you?.attending ?? null;
  // The receipt branch is the one offered first, because the state that needs it is the one a person
  // arrives in most often: they have paid, and nothing is attached yet.
  const way = wayPick ?? "proof";
  const promised = date ?? you?.expected_pay_date ?? "";

  async function save(event) {
    event.preventDefault();
    if (coming === null) {
      setNote("");
      setFail("Say whether you are coming, or whether you are not.");
      return;
    }
    setSaving(true);
    setFail("");
    setNote("");
    try {
      /*
        Only one of the two money answers can be sent, and a receipt that was chosen but never picked
        sends neither — which is how a person who only came here to change their attendance gets to
        do it without being made to re-attach a file they already put up.
      */
      let proof_path = null;
      let expected_pay_date = null;
      if (asks && coming) {
        if (way === "proof" && file) {
          proof_path = await uploadProof(file, { email: admin.email, function_id: functionId });
        } else if (way === "later") {
          expected_pay_date = promised || null;
        }
      }
      const fresh = await functions.saveRsvp({
        community_id: communityId,
        function_id: functionId,
        attending: coming,
        proof_path,
        expected_pay_date,
      });
      setDetail(fresh);
      setComingPick(null);
      setWayPick(null);
      setDate(null);
      setFile(null);
      setNote(
        proof_path
          ? "Saved, and your receipt is attached. Only a leader can confirm a payment."
          : "Saved.",
      );
    } catch (e) {
      setFail(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="au loading">
        <style>{css}</style>
        <div className="main">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing to open.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
        </div>
      </div>
    );
  }

  /*
    The list this page was opened from keeps its own way back, so the role travels on both legs of the
    trip rather than being learned again by a page that cannot ask for it.
  */
  const back = (
    <button
      className="back"
      type="button"
      onClick={() => navigate("/available-functions", { state: { ...admin, role: route?.role } })}
    >
      Back to available functions
    </button>
  );

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
        {route?.role ? (
          <BackToDashboard role={route.role} state={admin} />
        ) : (
          <BackToCommunities />
        )}
      </div>

      <main className="main">
        {!communityId || !functionId ? (
          <>
            {back}
            <div className="note">
              This page opens from a function you chose on the available list, and no function came
              with the link. Go back and open one.
            </div>
          </>
        ) : error ? (
          <>
            {back}
            <div className="note bad">{error}</div>
          </>
        ) : !one ? (
          <p className="sub">Loading…</p>
        ) : (
          <section className="rs">
            {back}

            <p className="eyebrow">Function</p>
            <h1 className="serif">{one.name}</h1>
            <p className="sub">{admin.name || "This community"}</p>

            <dl className="facts">
              <div>
                <dt>Planned by</dt>
                <dd>
                  {detail.planned_by
                    ? named(detail.planned_by, one.created_by, UNNAMED)
                    : <span className="free">not recorded</span>}
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{pretty(one.function_date)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{one.location || <span className="free">no place written down</span>}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>
                  {asks ? cost(one) || <span className="free">an amount nobody typed</span> : "Free"}
                </dd>
              </div>
            </dl>

            <div className="stand">
              <h2>Where you stand</h2>
              {you ? standing(you, one, asks) : <p>Loading…</p>}
            </div>

            <form onSubmit={save}>
              <p className="what">{you?.recorded ? "Change your answer" : "Your answer"}</p>
              <p className="why">
                Saving again changes this answer rather than adding a second one, so you can say the
                other thing later.
              </p>

              <fieldset>
                <legend>Are you coming?</legend>
                <label className="choice">
                  <input
                    type="radio"
                    name="coming"
                    value="yes"
                    checked={coming === true}
                    onChange={() => setComingPick(true)}
                  />
                  <span>Yes, I am coming</span>
                </label>
                <label className="choice">
                  <input
                    type="radio"
                    name="coming"
                    value="no"
                    checked={coming === false}
                    onChange={() => setComingPick(false)}
                  />
                  <span>No, I am not coming</span>
                </label>
              </fieldset>

              {asks && coming === true && (
                <fieldset>
                  <legend>The money</legend>
                  <label className="choice">
                    <input
                      type="radio"
                      name="way"
                      value="proof"
                      checked={way === "proof"}
                      onChange={() => setWayPick("proof")}
                    />
                    <span>I have the proof of payment</span>
                  </label>
                  {way === "proof" && (
                    <div className="detail">
                      <label>
                        Receipt
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(event) => setFile(event.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                  )}

                  <label className="choice">
                    <input
                      type="radio"
                      name="way"
                      value="later"
                      checked={way === "later"}
                      onChange={() => setWayPick("later")}
                    />
                    <span>I don&apos;t have proof of payment yet</span>
                  </label>
                  {way === "later" && (
                    <div className="detail">
                      <label>
                        I will pay by
                        <input
                          type="date"
                          value={promised}
                          onChange={(event) => setDate(event.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  {way === "later" && !promised && (
                    <p className="why">
                      Leave the day out and nothing is written about the money — your answer will be
                      that you are coming, and nothing more.
                    </p>
                  )}
                </fieldset>
              )}

              <button className="go" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save my answer"}
              </button>

              {saving && (
                <p className="saving">
                  {way === "proof" && file
                    ? "Uploading your receipt first, then writing the answer."
                    : "Writing your answer."}
                </p>
              )}
              {fail && <div className="note bad">{fail}</div>}
              {note && !fail && <div className="note">{note}</div>}
              <p className="against">
                Recorded against {admin.email} in {admin.name || "this community"}.
              </p>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
