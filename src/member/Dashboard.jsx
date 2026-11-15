import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AttendanceFetch, REASONS } from "../page_functions/attendance.js";
import Menu from "../components/menu.jsx";
import BackToCommunities from "../components/back.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const attendance = new AttendanceFetch();

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
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}

.au .links{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0 0}
.au .links button{background:#fff;color:#111;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .links button:hover{background:#111;color:#fff}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

/* The one write a member has: a day, a gathering, a reason. It is kept grey against the
   white page because it is a notice, not a record of anything that already happened. */
.au .absent{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:34px 0 0;background:#fafafa}
.au .absent .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.au .absent .why{color:var(--muted);font-size:14px;margin:8px 0 0}
.au .absent .fields{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin:18px 0 0}
.au .absent label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .absent input{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.au .absent input:focus{outline:none;border-color:#111}
.au .absent .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 24px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .absent .go:disabled{opacity:.5;cursor:default}
.au .absent .against{color:var(--muted);font-size:13px;margin:16px 0 0}
.au .absent .note{margin:16px 0 0}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
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

export default function MemberDashboard() {
  const navigate = useNavigate();
  /*
    Which community this member is standing in. The card on /community hands it over and
    src/admin/state.js fills in whatever the link did not carry, so a reload or the back
    button lands here on the same community rather than on an empty page.
  */
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  /*
    The notice: a day, a gathering, a reason. Whether the person came is not one of the boxes —
    a member cannot mark anybody present, including themselves, and /api/god writes the answer
    as not attending whoever the form says.
  */
  const [absence, setAbsence] = useState({ date: today(), name: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  // The notice keeps its own refusal, so a failed write does not hide the box that made it.
  const [noticeError, setNoticeError] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  const { name: memberName, email: memberEmail } = admin;
  const heading = { ...admin, name: memberName };

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: memberName, email: memberEmail });
  }, [communityId, memberName, memberEmail]);

  useEffect(() => {
    return accounts.onChange((user) => {
      /*
        Nobody is thrown out of here. A null means this browser could not read its saved
        session, which is not a sign-out — only Log out in the menu leaves.
      */
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    Three boxes are typed and none of them is whether anybody came. The address written against
    the notice is the one on the caller's own id token, forced by /api/god, and the role of the
    person typing is not checked at all: a notice is a member's own business. Writing the same
    notice twice only replaces the reason, because there is one row per person per gathering,
    and a gathering the member is already recorded as being at refuses the write outright.
  */
  async function recordAbsence(event) {
    event.preventDefault();
    const name = absence.name.trim();
    if (!absence.date || !name) {
      setNote("");
      setNoticeError("A day and a gathering: both are needed to record an absence.");
      return;
    }
    setSaving(true);
    setNoticeError("");
    try {
      await attendance.markNotAttending({
        community_id: communityId,
        event_date: absence.date,
        event_name: name,
        reason: absence.reason,
      });
      setNote(
        absence.reason.trim()
          ? `You are recorded as not attending ${name} on ${pretty(absence.date)} — ${absence.reason.trim()}.`
          : `You are recorded as not attending ${name} on ${pretty(absence.date)}.`,
      );
      setAbsence({ date: today(), name: "", reason: "" });
    } catch (e) {
      setNote("");
      setNoticeError(e.message);
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

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap">
          <Menu />
        </div>
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">Member</p>
        <h1 className="serif">{heading.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {communityId && (
          <div className="links">
            <button
              type="button"
              onClick={() => navigate("/member-testimonies", { state: heading })}
            >
              View testimonies
            </button>
          </div>
        )}

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to open here. Go back, click a
            community, and its notice box and its testimonies open on these pages.
          </div>
        ) : (
          <form className="absent" onSubmit={recordAbsence}>
            <p className="what">Not attending</p>
            <p className="why">
              Record that you will not be at a gathering, including one whose day has not come
              yet. A reason is optional, and when you give one it is in your own words — the box
              offers the usual five, and takes anything you type. This is your own notice: a
              member marks nothing present, and a gathering you are recorded as being at keeps
              that record.
            </p>
            <div className="fields">
              <label>
                Date
                <input
                  type="date"
                  value={absence.date}
                  onChange={(event) => setAbsence({ ...absence, date: event.target.value })}
                />
              </label>
              <label>
                Gathering
                <input
                  type="text"
                  value={absence.name}
                  placeholder="Sunday Fellowship"
                  onChange={(event) => setAbsence({ ...absence, name: event.target.value })}
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
              Recorded against {admin.email} in {admin.name || "this community"}.
            </p>
            {noticeError && <div className="note bad">{noticeError}</div>}
            {note && !noticeError && <div className="note">{note}</div>}
          </form>
        )}
      </main>
    </div>
  );
}
