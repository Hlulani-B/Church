import React, { useEffect, useState } from "react";
import { Auth } from "../functions/auth.js";
import { CommunityFetch } from "../page_functions/community.js";
import { TestimoniesFetch } from "../page_functions/testimonies.js";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import BackToCommunities from "../components/back.jsx";
import { adminState, forgetAdmin } from "../admin/state.js";

const accounts = new Auth();
const groups = new CommunityFetch();
const testimonies = new TestimoniesFetch();

/*
  Walking out of a fellowship, which the app had no door for: an admin could take somebody out through
  the roster, and a person could log out of their account, but nobody could leave. This page is that
  door, and it is deliberately small about what it does — one row of `community_members` goes, and
  almost everything else stays.

  What leaving means, said the way the tables say it: the gatherings this person was counted at, the
  servings they took, the functions they answered, the prayers they asked for and their own account are
  all still there afterwards. A fellowship's register is a record of who came, and a departure today
  does not change what happened on that Sunday. The one thing a person can reasonably ask to take with
  them is what they witnessed themselves, so that is the choice offered here, and it is the only part
  that is irreversible.

  The testimonies have to be deleted from this browser rather than asked of a server. Their rows carry
  the author's address as ciphertext written with a key that never leaves the page, so nothing on the
  other side of a fetch can tell whose rows any of them are; `TestimoniesFetch.deleteMine` reads, opens
  and matches them here, and sends on the ones that answer to this address.

  The order is not arbitrary. The membership goes first because it is the only half the server can
  refuse — the only admin of a community cannot leave it, so somebody else has to be made an admin
  first — and it would be a bad day that took a person's testimonies down and then told them they were
  still in the fellowship. Deleting after leaving is still this address's own doing, so a half-finished
  clear-out can simply be tried again from here.
*/

const STAYS = [
  "Every gathering you were counted at, and the reasons you gave for the ones you missed",
  "Your servings, your answers to the functions still to come, and the prayers you asked for",
  "Your own account, and your place in every other community you belong to",
];

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.lv{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.lv *{box-sizing:border-box}
.lv a{color:inherit}
.lv .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.lv .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.lv .bar .logo{font-size:24px;text-decoration:none}
.lv .menuwrap{display:flex;align-items:center;position:relative}

.lv .main{padding:56px 56px 96px;max-width:860px;width:100%;margin:0 auto}
.lv .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.lv h1{font-size:40px;line-height:1.12;margin:0 0 8px;text-transform:uppercase}
.lv .sub{color:var(--muted);margin:0;font-size:16px;max-width:640px}

.lv h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:40px 0 12px}
.lv .list{display:flex;flex-direction:column;gap:10px}
.lv .one{border:1px solid var(--line);border-radius:2px;padding:16px 18px;display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap}
.lv .one.chosen{border-color:#111}
.lv .one .n{font-weight:600;font-size:16px}
.lv .one .r{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 10px;white-space:nowrap}
.lv .empty{border:1px dashed var(--line);border-radius:2px;padding:16px 18px;font-size:14px;color:var(--muted)}

.lv .btn{padding:11px 20px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:#111;color:#fff;border:1px solid #111}
.lv .btn.outline{background:#fff;color:#111}
.lv .btn.red{background:#8b1a1a;color:#fff;border-color:#8b1a1a}
.lv .btn:disabled{opacity:.55;cursor:not-allowed}
.lv .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:16px}

/* the panel a chosen community opens, sitting under its own card rather than somewhere down the page */
.lv .panel{border:1px solid #111;border-radius:2px;padding:20px 18px;margin:2px 0 4px;background:#faf9f7}
.lv ul{margin:0 0 14px;padding-left:20px;font-size:14px;color:var(--muted)}
.lv ul.goes{color:var(--text)}
.lv ul li{margin-bottom:5px}
.lv .pick{display:flex;gap:10px;align-items:flex-start;font-size:15px;margin:18px 0 0;max-width:640px}
.lv .pick input{margin-top:4px;width:16px;height:16px}
.lv .pick .why{display:block;font-size:13px;color:var(--muted);margin-top:4px}
.lv .count{font-size:13px;color:var(--muted);margin:8px 0 0}
.lv label{display:block;font-size:13px;font-weight:600;margin:20px 0 6px}
.lv .typed{font-size:13px;color:#111;background:#f4f4f4;border:1px dashed var(--line);padding:6px 10px;display:inline-block;margin-bottom:10px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.lv input[type="text"]{width:100%;max-width:420px;padding:12px 14px;border:1px solid #111;border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.lv input[type="text"]:focus{outline:none;border-color:#111}

.lv .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.lv .note.bad{border-left-color:#a11111}
.lv .warn{font-size:13px;color:var(--muted);margin:10px 0 0;max-width:640px}
.lv .hint{font-size:13px;color:var(--muted);margin:8px 0 0;max-width:640px}

@media (max-width:640px){
  .lv .main{padding:32px 20px 72px}
  .lv h1{font-size:28px}
}
`;

export default function LeaveCommunityPage() {
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [rows, setRows] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState("");
  const [wipe, setWipe] = useState(false);
  const [mine, setMine] = useState(null);
  const [counting, setCounting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  // The fellowships this address belongs to, with the role it holds in each.
  useEffect(() => {
    if (!signedIn?.email) return;
    groups
      .getCommunities()
      .then((list) => setRows(Array.isArray(list) ? [...list].sort(byName) : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [signedIn?.email]);

  function byName(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""));
  }

  function close() {
    setPicked("");
    setWipe(false);
    setMine(null);
    setTyped("");
    setError("");
  }

  /*
    How many of this community's testimonies are the caller's, asked the moment the box is ticked and
    never before. It is not a cheap read — every row of the community's testimonies is opened with this
    browser's key to see whose address is under the ciphertext — so it is not something to do for ten
    communities when the person is leaving one.
  */
  async function askCount(one) {
    setWipe(true);
    setMine(null);
    setCounting(true);
    try {
      const found = await testimonies.myTestimonies(one.community_id, signedIn.email);
      setMine(found.length);
    } catch (e) {
      setWipe(false);
      setError(e.message || "The testimonies of this community could not be read.");
    } finally {
      setCounting(false);
    }
  }

  function choose(one) {
    setPicked((current) => (current === one.community_id ? "" : one.community_id));
    setWipe(false);
    setMine(null);
    setTyped("");
    setError("");
    setReport(null);
  }

  // Unticking asks nothing of the table again; ticking is what costs a read, so it happens here only.
  function take(with_them, one) {
    if (!with_them) {
      setWipe(false);
      setMine(null);
      return;
    }
    askCount(one);
  }

  /*
    Both halves, in the order that can be refused first. `leaveCommunity` answers 403 for the only
    admin of a fellowship, and nothing else has happened when it does; the clear-out of testimonies is
    then this browser's own work, row by row, and whatever it cannot finish is counted and offered
    again rather than pretended away.
  */
  async function leave(one) {
    setBusy(true);
    setError("");
    try {
      await groups.leaveCommunity(one.community_id);
      let took = null;
      let tookError = "";
      if (wipe) {
        try {
          took = await testimonies.deleteMine({ community_id: one.community_id, email: signedIn.email });
        } catch (e) {
          tookError = e.message || "Your testimonies could not be read, so none of them were deleted.";
        }
      }
      /*
        An admin screen remembered on this browser must not go on opening a community the address has
        just walked out of — the dashboard would answer with a refusal it cannot explain.
      */
      if (adminState(null, null).community_id === one.community_id) forgetAdmin();
      const list = await groups.getCommunities().catch(() => rows);
      setRows(Array.isArray(list) ? [...list].sort(byName) : []);
      setReport({
        community_id: one.community_id,
        name: one.name || "that community",
        role: one.role || "member",
        took,
        tookError,
      });
      close();
      setLoaded(true);
      return true;
    } catch (e) {
      setError(e.message || "Nothing was changed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The retry, for a clear-out that half finished: the same call, which only ever finds what is left.
  async function finishWipe() {
    if (!report?.community_id) return;
    setBusy(true);
    setError("");
    try {
      const took = await testimonies.deleteMine({
        community_id: report.community_id,
        email: signedIn.email,
      });
      setReport({ ...report, took, tookError: "" });
    } catch (e) {
      setError(e.message || "Your testimonies could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const listed = usePager(rows ?? [], PER_PAGE, picked);
  const chosen = (rows ?? []).find((one) => one.community_id === picked) || null;
  /*
    A plain leave needs no typed name: it is one row, and an admin can put the person back afterwards.
    Taking the testimonies down does not come back, so the community's own name has to be written out
    before that button answers — the same rule the delete-everything screen holds itself to.
  */
  const needsName = wipe;
  const matching =
    !needsName ||
    typed.trim().toLowerCase() === String(chosen?.name || "").trim().toLowerCase();
  const canLeave = Boolean(chosen) && !busy && matching && (!needsName || !counting);

  if (!signedIn) {
    return (
      <div className="lv">
        <style>{css}</style>
        <div className="main">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing here to leave.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lv">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">Membership</p>
        <h1 className="serif">Leave a community</h1>
        <p className="sub">
          Taking yourself out of the roster of one fellowship. What you recorded there stays recorded —
          this is a leaving, not a rewriting.
        </p>

        {report && (
          <div className="note">
            You are out of <strong>{report.name}</strong>
            {report.role === "admin" || report.role === "leader"
              ? `, where you were ${report.role}`
              : ""}
            . {report.took
              ? `${report.took.testimonies} testimon${report.took.testimonies === 1 ? "y" : "ies"} of yours ${
                  report.took.testimonies === 1 ? "was" : "were"
                } taken down${
                  report.took.files ? `, with ${report.took.files} attached file${report.took.files === 1 ? "" : "s"}` : ""
                }.`
              : "Your testimonies are still there, as they are in every community you have left."}
            {report.took && report.took.filesLeft
              ? ` ${report.took.filesLeft} file${report.took.filesLeft === 1 ? "" : "s"} could not be removed from storage.`
              : ""}
            {report.took && report.took.failed
              ? ` ${report.took.failed} could not be deleted.`
              : ""}
            {report.tookError ? ` ${report.tookError}` : ""}
            {(report.took?.failed || report.tookError) && (
              <div className="row">
                <button className="btn outline" type="button" onClick={finishWipe} disabled={busy}>
                  {busy ? "Trying…" : "Try the rest again"}
                </button>
              </div>
            )}
          </div>
        )}

        {!loaded && !rows && <LoadingBoxes count={2} words="Reading the communities you belong to…" />}

        {loaded && rows === null && (
          <div className="empty">The list did not come back. Try this page again in a moment.</div>
        )}

        {loaded && Array.isArray(rows) && rows.length === 0 && !report && (
          <div className="empty">
            You are not in a community, so there is nothing to leave.{" "}
            <a href="/community">Join by code or start one</a>.
          </div>
        )}

        {error && <div className="note bad">{error}</div>}

        {Array.isArray(rows) && rows.length > 0 && (
          <>
            <h2>Where you belong</h2>
            <div className="list" id={listed.anchorId}>
              {listed.chunk.map((one) => (
                <React.Fragment key={one.community_id}>
                  <div className={`one${picked === one.community_id ? " chosen" : ""}`}>
                    <span className="n">{one.name || "This community"}</span>
                    <span className="r">{one.role || "member"}</span>
                    <button
                      className="btn outline"
                      type="button"
                      onClick={() => choose(one)}
                      disabled={busy}
                    >
                      {picked === one.community_id ? "Not yet" : "Leave"}
                    </button>
                  </div>

                  {picked === one.community_id && (
                    <div className="panel">
                      <ul className="goes">
                        <li>
                          Your place in {one.name || "this community"}: its dashboard, its roster and
                          its attendance are no longer yours to open.
                        </li>
                      </ul>
                      <h2>What stays there</h2>
                      <ul>
                        {STAYS.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>

                      {one.role === "admin" && (
                        <p className="warn">
                          You are an admin of this one. While you are its only admin it will refuse to
                          let you go — somebody has to be left who can change its join code and clear
                          its records — so make one other person an admin on the dashboard first.
                        </p>
                      )}

                      <label className="pick">
                        <input
                          type="checkbox"
                          checked={wipe}
                          onChange={(event) => take(event.target.checked, one)}
                        />
                        <span>
                          Take my testimonies down with me
                          <span className="why">
                            Your own sharings, and any picture or document that was one of them. Nothing
                            else you recorded goes — an attendance row is a fact about a day, not a
                            secret of yours.
                          </span>
                        </span>
                      </label>

                      {counting && <p className="count">Counting what you shared here…</p>}
                      {!counting && mine !== null && (
                        <p className="count">
                          {mine === 0
                            ? "You have not shared anything here, so there is nothing to take down."
                            : `${mine} of ${one.name || "this community"}'s testimonies ${
                                mine === 1 ? "is" : "are"
                              } yours.`}
                        </p>
                      )}

                      {wipe && (
                        <>
                          <label htmlFor={`confirm-${one.community_id}`}>
                            Type the community name to confirm
                          </label>
                          <div className="typed">{one.name || "This community"}</div>
                          <input
                            id={`confirm-${one.community_id}`}
                            type="text"
                            autoComplete="off"
                            spellCheck="false"
                            placeholder={one.name || "This community"}
                            value={typed}
                            onChange={(event) => setTyped(event.target.value)}
                          />
                        </>
                      )}

                      <div className="row">
                        <button
                          className="btn red"
                          type="button"
                          onClick={() => leave(one)}
                          disabled={!canLeave}
                        >
                          {busy
                            ? "Leaving…"
                            : wipe
                              ? `Leave and take my ${mine === 1 ? "testimony" : "testimonies"}`
                              : `Yes, leave ${one.name || "this community"}`}
                        </button>
                        <button className="btn outline" type="button" onClick={close} disabled={busy}>
                          Keep my place
                        </button>
                      </div>
                      {wipe && !matching && (
                        <p className="hint">
                          The name above has to be written out exactly, because the testimonies cannot be
                          brought back.
                        </p>
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <Pager state={listed} noun={listed.total === 1 ? "community" : "communities"} />
          </>
        )}
      </main>
    </div>
  );
}
