import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { TestimoniesFetch } from "../page_functions/testimonies.js";
import LeaderMenu from "./menu.jsx";
import BackToCommunities from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();

/*
  The same page the admin dashboard opens, and the same fetch behind it: this list is read
  straight from Supabase with the publishable key and row level security, so nothing here
  asks /api/god about other people. A leader therefore sees exactly what an admin sees —
  the sharing of this community — and the only thing they write is their own testimony,
  against their own address, which is what a member is allowed to do anyway.
*/
let testimonies = null;
let setupError = "";
try {
  testimonies = new TestimoniesFetch();
} catch (e) {
  setupError = e.message;
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.au .bar .logo{font-size:24px;text-decoration:none}

.au .main{padding:64px 56px 96px;max-width:900px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au .tally{font-size:14px;color:var(--muted);margin:36px 0 16px}

/* The search is the loudest thing under the heading, because a testimony is looked up by
   the day it was shared and by the person who shared it, and the export has to answer for the
   same search. The three boxes and the search sit on the first line; the writers sit on a
   second line of their own. */
.au .find{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin:36px 0 0;padding:24px;border:1px solid var(--line);border-radius:2px;background:#fafafa;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.au .find .what{flex:1 1 100%;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;letter-spacing:normal;text-transform:none;color:var(--text);margin:0 0 4px}
.au .find label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .find .by{flex:1 1 220px}
.au .find .by input{width:100%}
.au .find input{font:inherit;font-size:16px;letter-spacing:0;text-transform:none;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.au .find input:focus{outline:none;border-color:#111}
.au .find .go{background:#111;color:#fff;border:0;border-radius:2px;padding:13px 28px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .find .ghost{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:12px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .find .exports{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 0;padding-top:20px;border-top:1px solid var(--line)}
.au .find .exports .ghost:first-child{background:#111;color:#fff}
.au .go:disabled,.au .find .ghost:disabled{opacity:.45;cursor:default}

/* A veil, a card, Escape or a click outside the card to leave it. */
.au .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.au .pop{background:#fff;border-radius:2px;width:100%;max-width:560px;max-height:calc(100vh - 48px);overflow:auto;padding:26px 28px 28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.au .pop h2{font-size:24px;margin:0 0 6px;text-transform:none}
.au .pop .who{color:var(--muted);font-size:14px;margin:0}
.au .pop label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:18px 0 0}
.au .pop input,.au .pop textarea{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;font-weight:400;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.au .pop input:focus,.au .pop textarea:focus{outline:none;border-color:#111}
.au .pop textarea{min-height:160px;resize:vertical;line-height:1.55}
.au .pop .fail{color:#a11111;font-size:14px;margin:16px 0 0}
.au .pop .row{display:flex;justify-content:flex-end;gap:10px;margin:26px 0 0}
.au .pop .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .pop .go:disabled{opacity:.55;cursor:default}

/* each testimony is a card with the first letter of whoever shared it */
.au .item{display:grid;grid-template-columns:44px 1fr;gap:16px;border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:0 0 12px;background:#fff}
.au .item .avatar{width:44px;height:44px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:19px}
.au .item .meta{display:flex;justify-content:space-between;gap:4px 14px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.au .item .meta .who{color:var(--text);font-weight:600;font-size:14px}
.au .item .body{margin:8px 0 0;font-size:16px;line-height:1.7;color:#222}

.au .row{display:flex;gap:10px;margin:28px 0 0}
.au .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:11px 20px;font-size:15px;font-family:inherit;cursor:pointer}
.au .ghost:disabled{opacity:.45;cursor:default}
.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none;cursor:pointer;background:none;border-width:0 0 1px;border-style:solid;padding:0}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au .find{padding:18px}
  .au .item{grid-template-columns:36px 1fr;gap:12px;padding:16px}
  .au .item .avatar{width:36px;height:36px;font-size:16px}
}
`;

function pretty(date) {
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? date
    : read.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Today, in the shape the date box and the date column both want.
function today() {
  const now = new Date();
  const pad = (one) => String(one).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function LeaderTestimonies() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [fetched, setFetched] = useState(null);
  /*
    Which page of which community, on which dates and from whom: all of it belongs to the
    community it was read for, so opening a second one starts again at its newest testimony with
    no filter on it. `wanted` is the search that was run; the inputs hold what has been typed
    since, which may not be searched yet.
  */
  const [wanted, setWanted] = useState({ community_id: "", offset: 0, from: "", to: "", name: "" });
  const [typed, setTyped] = useState({ from: "", to: "", name: "" });
  const [note, setNote] = useState("");
  const [writing, setWriting] = useState("");
  /*
    The popup the add button opens: two boxes, the day and the words. `refresh` is what makes
    the list read itself again once a testimony has been written, so the new row turns up
    under the search that is on screen rather than only after a reload.
  */
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(setupError);

  useEffect(() => {
    return accounts.onChange((user) => {
      /*
        Nobody is thrown out of here. A null means this browser could not read its saved
        session, which is not a sign-out — only Log out in the menu leaves. The page waits,
        then offers the way back in.
      */
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    The community this page reads and the address reading it, the three values every screen
    behind a dashboard carries. The signed-in address wins over the one on the link, the link
    wins over what this browser last opened, so the heading is filled in even when the session
    is still settling or the navigation arrived without its state.
  */
  const leader = adminState({ email: signedIn?.email }, route);
  const communityId = leader.community_id;
  const { name: leaderName, email: leaderEmail } = leader;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: leaderName, email: leaderEmail });
  }, [communityId, leaderName, leaderEmail]);

  // The read waits for a person to be signed in, and for the community they came from. The
  // address is what it waits on, not the session object: Firebase re-reports the same
  // person whenever it reloads their account, and the page would read again on each one.
  const email = signedIn?.email || "";

  /*
    The page of testimonies is tagged with the community it was read from, and only a page
    tagged with the community on screen is shown — otherwise switching community leaves one
    fellowship's sharing on the screen while it is reading another's, which is precisely how
    a member of one group ends up listed in another.
  */
  const page = fetched?.community_id === communityId ? fetched : null;
  const search = wanted.community_id === communityId
    ? wanted
    : { offset: 0, from: "", to: "", name: "" };
  const { offset, from, to, name } = search;

  useEffect(() => {
    if (!email || !communityId || setupError) return;
    testimonies
      .getTestimonies(communityId, offset, { from, to, name })
      .then((result) => {
        setFetched({ ...result, community_id: communityId });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [email, communityId, offset, from, to, name, refresh]);

  /*
    The dates are compared as written, so a first date after the second is a search that can
    only come back empty. It is said here instead of shown as a zero. The name is trimmed here
    so a search for a word that is only spaces is no search at all.
  */
  function runSearch(event) {
    event.preventDefault();
    if (typed.from && typed.to && typed.from > typed.to) {
      setError("The first date is after the second one. Put the earlier day first.");
      return;
    }
    setNote("");
    setError("");
    setWanted({
      community_id: communityId,
      offset: 0,
      from: typed.from,
      to: typed.to,
      name: typed.name.trim(),
    });
  }

  // One click takes every filter off, so the box that clears the dates clears the name with
  // them and cannot leave a search half undone.
  function showAll() {
    setTyped({ from: "", to: "", name: "" });
    setNote("");
    setError("");
    setWanted({ community_id: communityId, offset: 0, from: "", to: "", name: "" });
  }

  function openAdd() {
    setDraft({ date: today(), body: "" });
    setDraftError("");
    setAdding(true);
  }

  function closeAdd() {
    if (saving) return;
    setAdding(false);
  }

  /*
    Only the day and the words are typed. The address the row is written against is the one
    signed in here and the community is the one on screen, both of which the page function
    chooses rather than the form. A testimony that falls outside the dates being shown is said
    out loud, because otherwise saving looks like it did nothing.
  */
  async function saveTestimony(event) {
    event.preventDefault();
    setSaving(true);
    setDraftError("");
    try {
      const one = await testimonies.addTestimony({
        community_id: communityId,
        email,
        date: draft.date,
        body: draft.body,
      });
      setAdding(false);
      /*
        A testimony the search on screen would not list is said out loud, because otherwise
        saving looks like it did nothing: the day can fall outside the two dates, and a search
        on somebody else's name does not necessarily show what was written here.
      */
      const offDay = (from && one.date < from) || (to && one.date > to);
      const offSearch = offDay
        ? ", on a day these dates do not show."
        : name
          ? ", which this search by name may not list."
          : ".";
      setNote(`Your testimony for ${pretty(one.date)} is recorded${offSearch}`);
      setError("");
      setRefresh((count) => count + 1);
    } catch (e) {
      setDraftError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Escape leaves the popup, unless the write is still on its way.
  useEffect(() => {
    if (!adding) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !saving) setAdding(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, saving]);

  /*
    An export writes out the search that is on screen, not whatever has been typed into the
    boxes since, so the file and the list underneath the bar always answer for the same days and
    the same people. Both writers read every page of the search themselves: a file that stopped
    at the hundred on screen would be a different answer from the one this page just gave.
  */
  async function writeOut(kind) {
    setWriting(kind);
    setError("");
    try {
      const filter = { from, to, name };
      const done =
        kind === "excel"
          ? await testimonies.exportExcel(communityId, filter, leader.name || "testimonies")
          : await testimonies.exportPdf(communityId, filter, leader.name || "testimonies");
      setNote(
        `${done.count} ${done.count === 1 ? "testimony" : "testimonies"} written to ${done.name}.`,
      );
    } catch (e) {
      setNote("");
      setError(e.message);
    } finally {
      setWriting("");
    }
  }

  function open(to) {
    navigate(to, { state: leader });
  }

  const first = page && page.shown ? page.from + 1 : 0;
  const last = page ? page.from + page.shown : 0;
  // Spoken once, in the line that says what is on screen, so the filter is not only in the
  // three boxes above it.
  const range =
    from && to
      ? `from ${pretty(from)} to ${pretty(to)}`
      : from
        ? `from ${pretty(from)}`
        : to
          ? `up to ${pretty(to)}`
          : "";
  const filters = [range, name ? `shared by ${name}` : ""].filter(Boolean);
  const spoken = filters.length ? `, ${filters.join(" and ")}` : "";

  if (!signedIn) {
    return (
      <div className="au">
        <style>{css}</style>
        <main className="main">
          {noSession ? (
            <p className="sub">
              This browser holds no saved session, so there is nothing to open.{" "}
              <a href="/login">Log in</a>
            </p>
          ) : (
            <p className="sub">Checking your sign-in…</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <LeaderMenu state={leader} />
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">Leader</p>
        <h1 className="serif">{leader.name || "This community"}</h1>
        <p className="sub">{leader.email}</p>

        {!communityId && !error && (
          <div className="note">
            No community was chosen, so there is nothing to read here. Go back, click a
            community, and its testimonies open on this page.
          </div>
        )}
        {/*
          The one place a date is chosen, so a search and the file written out of it cannot
          disagree about which days were asked for.
        */}
        {communityId && (
          <form className="find" onSubmit={runSearch}>
            <p className="what">Search these testimonies by name and by date</p>
            <label className="by">
              Name
              <input
                type="text"
                value={typed.name}
                placeholder="Who shared it"
                onChange={(event) => setTyped({ ...typed, name: event.target.value })}
              />
            </label>
            <label>
              From
              <input
                type="date"
                value={typed.from}
                max={typed.to || undefined}
                onChange={(event) => setTyped({ ...typed, from: event.target.value })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={typed.to}
                min={typed.from || undefined}
                onChange={(event) => setTyped({ ...typed, to: event.target.value })}
              />
            </label>
            <button className="go" type="submit">
              Search
            </button>
            {from || to || name ? (
              <button className="ghost" type="button" onClick={showAll}>
                Start again
              </button>
            ) : null}
            <span className="exports">
              <button className="ghost" type="button" onClick={openAdd}>
                Add a testimony
              </button>
              <button className="ghost" type="button" disabled={!!writing} onClick={() => writeOut("excel")}>
                {writing === "excel" ? "Writing…" : "Export Excel"}
              </button>
              <button className="ghost" type="button" disabled={!!writing} onClick={() => writeOut("pdf")}>
                {writing === "pdf" ? "Writing…" : "Export PDF"}
              </button>
            </span>
          </form>
        )}
        {error && <div className="note bad">{error}</div>}
        {note && !error && <div className="note">{note}</div>}
        {!error && !page && communityId && <p className="tally">Loading…</p>}

        {page && !error && (
          <>
            <p className="tally">
              {page.total
                ? `Showing ${first}–${last} of ${page.total}, newest first${spoken}.`
                : name && page.matched === 0
                  ? `Nobody in this community answers to ${name}.`
                  : name
                    ? `Nothing was shared by ${name}${range ? ` ${range}` : ""}.`
                    : from || to
                      ? "Nothing was shared on those dates."
                      : "Nothing has been shared in this community yet."}
            </p>

            {page.testimonies.map((one) => {
              /*
                The roster is where the names come from, so somebody who has since left the
                community is not on it — ten sharing rows in this community are not. Their
                address is what the table holds about them, and an address is personal to its
                owner, so the card says only that the person who wrote it is gone from the list.
              */
              const named = `${one.name} ${one.surname}`.trim();
              const who = named || "Someone who has left";
              return (
                <article className="item" key={one.testimony_id}>
                  <span className="avatar" aria-hidden="true">
                    {named ? named.charAt(0).toUpperCase() : ""}
                  </span>
                  <div>
                    <div className="meta">
                      <span className="who">{who}</span>
                      <span>{pretty(one.date)}</span>
                    </div>
                    <p className="body">{one.body}</p>
                  </div>
                </article>
              );
            })}

            {/* Paging stays inside the search: turning to the next hundred has to keep the
                dates and the name that were asked for. */}
            {page.total > page.shown || page.from > 0 ? (
              <div className="row">
                <button
                  className="ghost"
                  type="button"
                  disabled={page.from === 0}
                  onClick={() =>
                    setWanted({
                      community_id: communityId,
                      offset: Math.max(0, page.from - page.shown),
                      from,
                      to,
                      name,
                    })
                  }
                >
                  Newer
                </button>
                <button
                  className="ghost"
                  type="button"
                  disabled={last >= page.total}
                  onClick={() =>
                    setWanted({ community_id: communityId, offset: last, from, to, name })
                  }
                >
                  Older
                </button>
              </div>
            ) : null}
          </>
        )}

        <button className="back" type="button" onClick={() => open("/leader-dashboard")}>
          Back to the dashboard
        </button>
      </main>

      {adding && (
        <div className="veil" role="dialog" aria-modal="true" aria-label="Add a testimony" onClick={closeAdd}>
          <form
            className="pop"
            onSubmit={saveTestimony}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="serif">Add a testimony</h2>
            <p className="who">
              Recorded against {email} in {leader.name || "this community"}.
            </p>

            <label>
              Date
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              />
            </label>

            <label>
              Testimony
              <textarea
                value={draft.body}
                placeholder="What did God do?"
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              />
            </label>

            {draftError && <p className="fail">{draftError}</p>}

            <div className="row">
              <button className="ghost" type="button" onClick={closeAdd} disabled={saving}>
                Cancel
              </button>
              <button className="go" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save testimony"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
