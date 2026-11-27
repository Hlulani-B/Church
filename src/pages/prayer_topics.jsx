import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import prayer from "../page_functions/prayer_topics.js";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();

/*
  What the fellowship is being asked to pray for, in the words of the person who asked.

  The table has lived on the server for a while — four endpoints, a seeded list, the whole thing
  checked end to end — and this is the page that reads it. It is deliberately plain: a request is a
  sentence and a day, so the page is a box to write one in and a list of the ones already there,
  newest day first. There is no approval step and no reply, the same way a testimony is posted once
  and read as it stands.

  One rule is worth stating because the row makes it easy to break: the address a request was made
  from is stored and never printed. The fellowship's rule everywhere else is that a person is a name,
  and this pile is the one place where even a name is more than the list needs — what matters is the
  asking, and who did it is between that person and whoever they told. So the rows say whose they are
  only to their own author, by marking them as yours, and that mark is what unlocks the two things an
  author can still do: reword a request and take it back.
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
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E") no-repeat}
.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:48px 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.au h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}
.au .hint{font-size:13px;color:var(--muted);margin:14px 0 0}

/* The ask: one box of words and one day, on the same grey a notice wears. It is the only write a
   member makes on this page, so it sits above the list it adds to rather than under it. */
.au .ask{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:34px 0 0;background:#fafafa}
.au .ask .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.au .ask .why{color:var(--muted);font-size:14px;margin:8px 0 0}
.au .ask textarea{width:100%;font:inherit;font-size:16px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:11px 12px;resize:vertical;min-height:96px;margin:16px 0 0}
.au .ask textarea:focus{outline:none;border-color:#111}
.au .ask .fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin:14px 0 0}
.au .ask label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .ask input{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:9px 12px}
.au .ask input:focus{outline:none;border-color:#111}
.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .go:disabled{opacity:.55;cursor:default}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:8px 16px;font-size:13px;font-family:inherit;cursor:pointer}

/* Which of the pile is on the screen. Three words, and they filter what was already read. */
.au .filter{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0}
.au .filter button{background:#fff;color:#666;border:1px solid var(--line);border-radius:999px;padding:6px 16px;font-size:13px;font-family:inherit;cursor:pointer}
.au .filter button.on{border-color:#111;color:#111;font-weight:600}

.au .list{display:flex;flex-direction:column;gap:12px;margin-top:14px}
.au .topic{border:1px solid var(--line);border-left:4px solid #111;border-radius:2px;padding:16px 18px;background:#fafafa}
.au .topic.mine{border-left-color:#1f7a3f}
.au .topic .day{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0}
.au .topic .words{font-size:17px;margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.au .topic .foot{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:12px 0 0;font-size:13px;color:var(--muted)}
.au .topic .foot .who{margin-right:auto}
.au .edit{display:flex;flex-direction:column;gap:10px;margin:12px 0 0}
.au .edit textarea{width:100%;font:inherit;font-size:16px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:11px 12px;resize:vertical;min-height:84px}
.au .edit textarea:focus{outline:none;border-color:#111}
.au .edit .fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.au .edit label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .edit input{font:inherit;font-size:16px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:9px 12px}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
}
`;

// A day as the list heads a group of rows with it: "27 Nov", not a string nobody has to parse.
function pretty(value) {
  const read = new Date(`${value}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? value || "no day"
    : read.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// Today, in the shape the date box and the rows both want.
function today() {
  const now = new Date();
  const pad = (one) => String(one).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/*
  One request. Only its author gets the two controls — the server would let anybody with the id
  change a row, which is what an unauthenticated endpoint on a service key costs, so the page is the
  gate that says a request is edited by the person who made it and by nobody else.
*/
function TopicCard({ one, mine, onRevise, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [words, setWords] = useState(one.topic || "");
  const [day, setDay] = useState(one.date || today());
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [says, setSays] = useState("");

  async function save() {
    if (!words.trim()) {
      setSays("A request needs its words.");
      return;
    }
    setBusy(true);
    setSays("");
    const ok = await onRevise(one.topic_id, { topic: words.trim(), date: day });
    setBusy(false);
    if (ok) setEditing(false);
  }

  async function takeOut() {
    setBusy(true);
    setSays("");
    const ok = await onRemove(one.topic_id);
    setBusy(false);
    if (!ok) setAsked(false);
  }

  if (editing) {
    return (
      <div className="topic mine">
        <p className="day">{pretty(day)}</p>
        <div className="edit">
          <textarea
            value={words}
            maxLength={2000}
            autoFocus
            onChange={(event) => setWords(event.target.value)}
          />
          <div className="fields">
            <label>
              Day
              <input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
            </label>
            <button className="go" type="button" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              className="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setWords(one.topic || "");
                setDay(one.date || today());
                setSays("");
              }}
            >
              Cancel
            </button>
          </div>
          {says && <p className="note bad">{says}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`topic${mine ? " mine" : ""}`}>
      <p className="day">{pretty(one.date)}</p>
      <p className="words">{one.topic}</p>
      {mine && (
        <div className="foot">
          <span className="who">Yours</span>
          {asked ? (
            <>
              <span>Take this back?</span>
              <button className="ghost" type="button" disabled={busy} onClick={takeOut}>
                {busy ? "Taking out…" : "Yes, take it out"}
              </button>
              <button className="ghost" type="button" disabled={busy} onClick={() => setAsked(false)}>
                Keep it
              </button>
            </>
          ) : (
            <>
              <button className="ghost" type="button" onClick={() => setEditing(true)}>
                Change
              </button>
              <button className="ghost" type="button" onClick={() => setAsked(true)}>
                Take out
              </button>
            </>
          )}
        </div>
      )}
      {says && <p className="note bad">{says}</p>}
    </div>
  );
}

export default function PrayerTopicsPage() {
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  // null until the read lands, so a list still on its way is not drawn as a fellowship that has
  // asked for nothing. A refresh keeps the rows already on the screen rather than flashing.
  const [rows, setRows] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState({ topic: "", date: today() });
  const [saving, setSaving] = useState(false);
  const [askError, setAskError] = useState("");
  // Which of the pile is on the screen: everything, today's, or only the reader's own.
  const [filter, setFilter] = useState("all");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  const email = signedIn?.email || "";

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: admin.name, email: admin.email });
  }, [communityId, admin.name, admin.email]);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  function load() {
    if (!communityId) {
      setRows([]);
      return;
    }
    prayer
      .list({ community_id: communityId })
      .then((list) => {
        setRows(list || []);
        setError("");
      })
      // The read is over, and the failure is said by the note above the list rather than by a
      // sentence about who is missing from it.
      .catch((e) => {
        setRows([]);
        setError(e.message);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  /*
    The whole pile is read once and filtered here, because it is a community's list of sentences and
    not a register of thousands. Newest day first is what the server already answers with, so the
    filter keeps that order and only takes rows out of it.
  */
  const listed = (rows ?? []).filter((one) => {
    if (filter === "today") return one.date === today();
    if (filter === "mine") return isMine(one);
    return true;
  });
  /*
    Which rows are the reader's. Both halves of the comparison have to be there: an address that is
    simply unknown (a browser still resolving its sign-in) must not match the rows that have no
    address either, which would hand the edit controls of a stranger's request to nobody in
    particular.
  */
  function isMine(one) {
    return Boolean(email) && (one.user_email || "").toLowerCase() === email.toLowerCase();
  }
  const paged = usePager(listed, PER_PAGE, `${communityId}|${filter}`);

  /*
    Asking for a prayer. Two boxes, one of them optional, and neither of them says who is asking —
    the address goes with the row from the sign-in on this browser, the same way a check-in does, so
    a request cannot be made in somebody else's name from a shared phone.
  */
  async function ask(event) {
    event.preventDefault();
    if (!asking.topic.trim()) {
      setAskError("Say what to pray for, even if it is one line.");
      return;
    }
    setSaving(true);
    setAskError("");
    try {
      const saved = await prayer.ask({
        community_id: communityId,
        user_email: email,
        topic: asking.topic.trim(),
        date: asking.date || null,
      });
      setRows((before) => [saved, ...(before || [])].sort((a, b) => (a.date < b.date ? 1 : -1)));
      setAsking({ topic: "", date: today() });
      setNote(`Your request is on ${admin.name || "the community"}’s list.`);
    } catch (e) {
      setAskError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function revise(topic_id, changes) {
    setError("");
    try {
      const saved = await prayer.revise({ topic_id, ...changes });
      setRows((before) =>
        (before || []).map((one) =>
          one.topic_id === topic_id ? { ...one, ...saved } : one,
        ),
      );
      setNote("Your request is updated.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function remove(topic_id) {
    setError("");
    try {
      await prayer.remove({ topic_id });
      setRows((before) => (before || []).filter((one) => one.topic_id !== topic_id));
      setNote("Your request is taken back out of the list.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
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
        <p className="eyebrow">Prayer topics</p>
        <h1 className="serif">{admin.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {error && <div className="note bad">{error}</div>}
        {note && !error && <div className="note">{note}</div>}

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to ask of here. Go back, click a
            community, and open its prayer topics from the dashboard.
          </div>
        ) : (
          <>
            <form className="ask" onSubmit={ask}>
              <p className="what">Ask the fellowship to pray</p>
              <p className="why">
                One or two lines, in your own words, and the day it belongs to. It goes on the list
                below straight away — there is nobody to approve it first — and it is signed with
                the address you are signed in as, so you can change it or take it back. Nobody else
                sees that address.
              </p>
              <textarea
                value={asking.topic}
                maxLength={2000}
                placeholder="What should this fellowship be praying for?"
                aria-label="What to pray for"
                onChange={(event) => setAsking({ ...asking, topic: event.target.value })}
              />
              <div className="fields">
                <label>
                  Day
                  <input
                    type="date"
                    value={asking.date}
                    onChange={(event) => setAsking({ ...asking, date: event.target.value })}
                  />
                </label>
                <button className="go" type="submit" disabled={saving}>
                  {saving ? "Asking…" : "Ask"}
                </button>
              </div>
              <p className="hint">Written under your own sign-in, in {admin.name || "this community"}.</p>
              {askError && <div className="note bad">{askError}</div>}
            </form>

            <section>
              <h3>
                Requests
                {rows?.length ? <span className="count">{rows.length}</span> : null}
              </h3>

              <div className="filter">
                {[
                  { key: "all", label: "Everything" },
                  { key: "today", label: "Today" },
                  { key: "mine", label: "Yours" },
                ].map((one) => (
                  <button
                    key={one.key}
                    type="button"
                    className={filter === one.key ? "on" : undefined}
                    onClick={() => setFilter(one.key)}
                  >
                    {one.label}
                  </button>
                ))}
              </div>

              {rows === null ? (
                <LoadingBoxes words="Reading what this fellowship is praying for…" />
              ) : listed.length ? (
                <div className="list" id={paged.anchorId}>
                  {paged.chunk.map((one) => (
                    <TopicCard
                      key={one.topic_id}
                      one={one}
                      mine={isMine(one)}
                      onRevise={revise}
                      onRemove={remove}
                    />
                  ))}
                </div>
              ) : (
                !error && (
                  <p className="sub">
                    {rows.length
                      ? "Nothing on the list matches that filter."
                      : "Nobody has asked for prayer here yet. The first one is the box above."}
                  </p>
                )
              )}
              <Pager state={paged} noun={listed.length === 1 ? "request" : "requests"} />

              <p className="hint">
                A request says what to pray for and the day it was asked. The person who asked is not
                named on the list — only your own requests are marked, and only they can be changed or
                taken back.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
