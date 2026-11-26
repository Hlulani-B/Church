import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AttendanceFetch, REASONS } from "../page_functions/attendance.js";
import { UserFetch } from "../page_functions/user.js";
import AbsenceFor, { displayName } from "../components/absence_for.jsx";
import ExtraEvent from "../components/extra_event.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import LeaderMenu from "./menu.jsx";
import BackToCommunities from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const attendance = new AttendanceFetch();
const directory = new UserFetch();

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

.au .main{padding:56px 56px 96px;max-width:900px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:40px;line-height:1.15;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

/* The one write on this page, and it writes only not attending: a day, a gathering, a reason.
   A date that has not come is allowed, because the notice is sent ahead of the gathering. */
.au .absent{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:34px 0 0;background:#fafafa}
.au .absent .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.au .absent .why{color:var(--muted);font-size:14px;margin:8px 0 0}
.au .absent .fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin:18px 0 0}
.au .absent label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .absent input,.au .absent select{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.au .absent input:focus,.au .absent select:focus{outline:none;border-color:#111}
.au .absent .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 24px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .absent .go:disabled{opacity:.5;cursor:default}
.au .absent .against{color:var(--muted);font-size:13px;margin:16px 0 0}
.au .absent .note{margin:16px 0 0}
.au .tally{font-size:14px;color:var(--muted);margin:32px 0 0}

.au table{width:100%;border-collapse:collapse;margin-top:8px;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0 12px 8px 0;border-bottom:1px solid var(--line)}
.au td{padding:11px 12px 11px 0;border-bottom:1px solid var(--line);vertical-align:top}
.au td.num{text-align:right;padding-right:0;font-variant-numeric:tabular-nums}
.au th.num{text-align:right;padding-right:0}
.au .who{font-weight:500}
.au .out{color:var(--muted)}

.au th.last,.au td.last{width:78px;text-align:right;padding-right:0}
/* Every row is read-only, so the one control on it is the button that opens it. */
.au .open{background:#fff;border:1px solid var(--line);border-radius:2px;padding:6px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.au .open:hover{border-color:#111}
.au .reason{color:var(--muted);font-size:14px}

.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none;cursor:pointer;background:none;border-width:0 0 1px;border-style:solid;padding:0}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au td,.au th{font-size:14px}
}
`;

function pretty(date) {
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? date
    : read.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Today, in the shape the date box and the date column both want.
function today() {
  const now = new Date();
  const pad = (one) => String(one).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/*
  What the Attended column says. A null is not the same answer as a no: it is a gathering whose
  day has not come, whose register has not been taken, and the server reads it as nothing
  rather than letting a filled-in yes say otherwise.
*/
function attended(one) {
  if (one.attend === null) return "Not yet";
  return one.attend ? "Yes" : "No";
}

export default function LeaderAttendance() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [listed, setListed] = useState(null);
  const [picked, setPicked] = useState(null);
  const [found, setFound] = useState(null);
  /*
    The notice the top of this page writes: who, a day, a reason. Whether the person came is not
    one of the boxes — this page cannot record attendance, only the lack of it — and the who is
    now a box: the For-who dropdown, whose first entry is the leader's own address and whose rest
    are the community's people. `refresh` is what makes the list read itself again once a notice
    is written, so the new row turns up in its gathering without a reload.
  */
  const [absence, setAbsence] = useState({ date: today(), reason: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  // The people the For-who box offers, and the failure that leaves it offering only the caller.
  const [peopleList, setPeopleList] = useState(null);
  const [peopleError, setPeopleError] = useState("");
  /*
    The notice keeps its own refusal. `error` means a read failed, and every list on this page
    hides itself while it is set — so when a notice was the thing that failed, writing it took
    the gatherings and the people of the open one off the screen with it, and nothing brought
    them back until a reload. A typed-in reason says so beside the box and leaves the page up.
  */
  const [noticeError, setNoticeError] = useState("");

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
    The community this page reads and the address reading it, the same three values every
    screen about one community carries. The signed-in address wins over the one on the link,
    the link wins over what this browser last opened, so the heading is filled in even when the
    session is still settling or the navigation arrived without its state.
  */
  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  const { name: leaderName, email: leaderEmail } = admin;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: leaderName, email: leaderEmail });
  }, [communityId, leaderName, leaderEmail]);

  // The address, not the session object: Firebase re-reports the same person whenever it
  // reloads their account, and a page that reads on that would read again every time.
  const email = signedIn?.email || "";

  /*
    Every answer here is tagged with the community that was asked, and only the answer
    tagged with the community on screen is shown. Coming back to an earlier entry in the
    history, or a response that lands after the community changed, would otherwise leave one
    gathering's people listed under another community's name.
  */
  const list = listed?.community_id === communityId ? listed : null;
  const chosen = picked?.community_id === communityId ? picked : null;
  const gathering = found?.community_id === communityId ? found : null;
  const roster = peopleList?.community_id === communityId ? peopleList.rows : null;

  // The apologies already on file for whichever gathering is on screen.
  const notices = gathering ? gathering.rows.filter((one) => one.attend === false).length : 0;

  /*
    Both lists on this page are cut into chunks. The gatherings grow one every Sunday and never
    come back, and the register of a single gathering is as long as the fellowship — read whole, the
    second of them pushed the reason column, the way back and the extra register off the screen
    entirely. Neither count changes what is read: the whole list is still fetched and still counted,
    and only the printing stops at twenty-five.
  */
  const services = usePager(list?.services ?? [], PER_PAGE, communityId);
  const attendees = usePager(gathering?.rows ?? [], PER_PAGE, `${chosen?.event_date}|${chosen?.event_name}`);

  /*
    What the For-who box offers: the caller's own details at the very top — the row this page
    wrote for itself before the box existed — and then this community's people, the roster
    minus the double entry for whoever the caller is. While the read is still in flight the
    box is empty and says so; when it failed, the box keeps the one notice this page has
    always been able to make: the leader's own, and the failure is shown rather than hidden.
  */
  const selfRow =
    (roster || []).find((one) => one.email === email) ||
    { email, name: leaderName || "", surname: "" };
  const people = peopleError
    ? [selfRow]
    : roster
      ? [selfRow, ...roster.filter((one) => one.email !== email)]
      : [];
  const chosenEmail = absence.email || email;
  const chosenPerson = people.find((one) => one.email === chosenEmail) || selfRow;
  const forYourself = chosenEmail === email;

  useEffect(() => {
    if (!email || !communityId) return;
    attendance
      .getServices(communityId)
      .then((result) => {
        setListed({ ...result, community_id: communityId });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [email, communityId, refresh]);

  /*
    The people of this community, for the For-who box: getUsers takes the community_id, reads
    the addresses off community_members and the names off users, and the page only puts the
    caller's own details at the very top of what comes back.
  */
  useEffect(() => {
    if (!email || !communityId) return;
    directory
      .getUsers(communityId)
      .then((result) => {
        setPeopleList({ community_id: communityId, rows: result || [] });
        setPeopleError("");
      })
      .catch((e) => setPeopleError(e.message));
  }, [email, communityId]);

  // One gathering's rows are read only once it has been chosen from this community's list.
  useEffect(() => {
    if (!email || !chosen) return;
    attendance
      .getService(communityId, chosen.event_date, chosen.event_name)
      .then((result) => {
        setFound({ ...result, community_id: communityId });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [email, communityId, chosen]);

  /*
    Three boxes are typed — who, a day, a reason — and none of them is whether somebody came, nor
    which gathering: the name is read back off the session opened for that day. The answer is
    always not attending, and it travels to /api/leader, which settles that the caller leads this
    community, forces the chosen address into the row it speaks about (user_email), the caller's
    own into recorded_by, and the no into attend — none of them trusted from this form, which is
    why there is no Attending box to click. Picking yourself is the leader's notice as a member,
    and lands the same row /api/self would. A day that has not come is the expected case, and
    writing the same notice twice only replaces the reason, because there is one row per person
    per gathering. A gathering that person is already recorded as being at refuses the write
    outright, so a yes cannot be talked back into a no, by anybody, for anybody.
  */
  async function recordAbsence(event) {
    event.preventDefault();
    if (!absence.date) {
      setNote("");
      setNoticeError("A day is needed to record an absence.");
      return;
    }
    setSaving(true);
    setNoticeError("");
    try {
      const saved = await attendance.recordAbsenceFor({
        community_id: communityId,
        event_date: absence.date,
        reason: absence.reason,
        user_email: chosenEmail,
      });
      const derived = saved?.event_name || "the gathering";
      const subject = forYourself ? "You are" : `${displayName(chosenPerson)} is`;
      const tail = absence.reason.trim() ? ` — ${absence.reason.trim()}` : "";
      setNote(`${subject} recorded as not attending ${derived} on ${pretty(absence.date)}${tail}.`);
      setAbsence({ date: today(), reason: "", email: "" });
      setRefresh((count) => count + 1);
    } catch (e) {
      setNote("");
      setNoticeError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function open(to) {
    navigate(to, { state: admin });
  }

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
        <LeaderMenu state={admin} />
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">Leader</p>
        <h1 className="serif">{admin.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {/* A way out at the top as well as the bottom. Once a gathering is picked, the list
            above the fold is dozens of rows tall, and scrolling to the footer to leave feels
            like the page owns you. */}
        <button className="back" type="button" onClick={() => open("/leader-dashboard")}>
          Back to the dashboard
        </button>

        {!communityId && !error && (
          <div className="note">
            No community was chosen, so there is nothing to read here. Go back, click a
            community, and its attendance opens on this page.
          </div>
        )}
        {communityId && (
          <form className="absent" onSubmit={recordAbsence}>
            <p className="what">Not attending</p>
            <p className="why">
              Record that somebody — you, or anyone in this community — will not be at a
              gathering, including one whose day has not come yet. The For-who box starts at your
              own name and searches the community's people by name and surname; the gathering
              itself is the one the leader has opened a session for on that day, so you only
              choose the who and the day. A reason is optional, and when you give one it is in
              the person's own words or the leader's — the box offers the usual five, and takes
              anything you type. This writes not attending only. Nothing here marks anybody
              present, and a gathering that person is recorded as being at keeps that record.
            </p>
            <div className="fields">
              <label>
                For who
                <AbsenceFor
                  people={people}
                  value={chosenEmail}
                  onChange={(mail) => setAbsence({ ...absence, email: mail })}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={absence.date}
                  onChange={(event) => setAbsence({ ...absence, date: event.target.value })}
                />
              </label>
              <label>
                Reason
                <input
                  type="text"
                  list="absence-reasons"
                  value={absence.reason}
                  placeholder="In your own words, or leave it blank"
                  onChange={(event) => setAbsence({ ...absence, reason: event.target.value })}
                />
                {/* The five the fellowship usually hears, offered as you type — they are
                    suggestions now, not a list the box will accept. */}
                <datalist id="absence-reasons">
                  {REASONS.map((one) => (
                    <option key={one} value={one} />
                  ))}
                </datalist>
              </label>
              <button className="go" type="submit" disabled={saving}>
                {saving ? "Recording…" : "Record absence"}
              </button>
            </div>
            <p className="against">
              {forYourself
                ? `Recorded against ${admin.email} in ${admin.name || "this community"}.`
                : `Recorded for ${displayName(chosenPerson)} in ${admin.name || "this community"}, by ${admin.email}.`}
            </p>
            {peopleError && <div className="note bad">{peopleError}</div>}
            {noticeError && <div className="note bad">{noticeError}</div>}
            {note && !noticeError && <div className="note">{note}</div>}
          </form>
        )}
        {error && <div className="note bad">{error}</div>}
        {!error && !list && communityId && <LoadingBoxes count={4} words="Reading the gatherings on record…" />}

        {list && !chosen && !error && (
          <>
            <p className="tally" id={services.anchorId}>
              {list.services.length
                ? `Open a gathering to see who was recorded at it.${
                    list.sampled
                      ? ` These are the newest of ${list.recorded} attendance rows, so the gathering before this list may be left out rather than counted short.`
                      : ""
                  }`
                : "Nothing has been recorded for this community yet."}
            </p>

            {list.services.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Gathering</th>
                    <th className="num">Present</th>
                    <th className="num">Recorded</th>
                    <th className="last" aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {services.chunk.map((one) => (
                    <tr key={`${one.event_date}|${one.event_name}`}>
                      <td>{pretty(one.event_date)}</td>
                      <td className="who">{one.event_name}</td>
                      <td className="num">{one.upcoming ? "—" : one.present}</td>
                      <td className="num">{one.total}</td>
                      <td className="last">
                        <button
                          className="open"
                          type="button"
                          onClick={() => {
                            // The previous gathering is dropped here rather than in the
                            // effect, so the screen never shows one gathering's rows under
                            // another's name.
                            setFound(null);
                            setPicked({ ...one, community_id: communityId });
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <Pager state={services} noun={services.total === 1 ? "gathering" : "gatherings"} />
          </>
        )}

        {!error && chosen && !gathering && <LoadingBoxes count={4} words="Reading who was recorded at that gathering…" />}

        {chosen && gathering && !error && (
          <>
            <p className="tally" id={attendees.anchorId}>
              {gathering.upcoming
                ? `${gathering.event_name} on ${pretty(gathering.event_date)} — that day has not come, so nobody is counted present at it. ${notices} ${notices === 1 ? "notice has" : "notices have"} been sent ahead of it.`
                : `${gathering.event_name} on ${pretty(gathering.event_date)} — ${gathering.present} of ${gathering.total} recorded as present.`}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Attended</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {attendees.chunk.map((one) => (
                  <tr key={one.event_id}>
                    <td className="who">
                      {`${one.name} ${one.surname}`.trim() || "Someone who has left"}
                    </td>
                    <td className={one.attend === true ? "" : "out"}>{attended(one)}</td>
                    <td className="reason">{one.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager state={attendees} noun={attendees.total === 1 ? "person" : "people"} />
            <button className="back" type="button" onClick={() => setPicked(null)}>
              All gatherings
            </button>
          </>
        )}

        {/* Attendance for the members who never joined the app: their own register, kept here on
            the attendance page beside the gatherings it mirrors, not out on the dashboard. */}
        {communityId && <ExtraEvent communityId={communityId} email={email} />}

        {!chosen && list && list.services.length ? (
          <button className="back" type="button" onClick={() => open("/leader-dashboard")}>
            Back to the dashboard
          </button>
        ) : null}
      </main>
    </div>
  );
}
