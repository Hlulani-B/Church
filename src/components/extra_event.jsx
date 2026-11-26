import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import PeoplePicker, { mapExtraMembers } from "./people_picker.jsx";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";

/*
  Attendance for the people who never joined, kept in `extra_event`: one gathering, one of these
  members, and whether they came. It sits on the attendance page, beside the gatherings it mirrors,
  because marking an absent friend is a leader's or an admin's act, done by the same hand that reads
  the register — nobody marks this from a phone, and there is no PIN or check-in behind it; the entry
  IS the record.

  `attend` is deliberately three-way — present, absent, or not marked — because a name put down for a
  day is not a claim that they came. When the answer is "absent" a reason is offered, using exactly the
  five words the column allows (Work, Transport, Sick, Family, Other) so nothing is typed that the
  table would refuse.
*/

const REASONS = ["Work", "Transport", "Sick", "Family", "Other"];

const css = `
.xe{margin:48px 0 0}
.xe h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.xe h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xe .lede{font-size:14px;color:#666;margin:0 0 16px;max-width:62ch}
.xe .card{border:1px solid #e3e3e3;border-radius:2px;padding:18px 20px;background:#fafafa}
.xe .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.xe label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.xe label > input,.xe label > select{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;font-weight:400;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.xe label > input:focus,.xe label > select:focus{outline:none;border-color:#111}
.xe .actions{display:flex;gap:10px;margin-top:18px}
.xe .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.xe .go:disabled{opacity:.55;cursor:default}
.xe .fail{color:#a11111;font-size:14px;margin:12px 0 0}
.xe .ok{color:#1c7a34;font-size:14px;margin:12px 0 0}
.xe .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.xe table{width:100%;border-collapse:collapse;font-size:15px}
.xe th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.xe td{padding:12px 14px;border-bottom:1px solid #e3e3e3}
.xe tbody tr:last-child td{border-bottom:0}
.xe .last{width:88px;text-align:right;padding-right:0}
.xe .ghost{background:#fff;color:#a11111;border:1px solid #e3e3e3;border-radius:2px;padding:7px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.xe .ghost:hover{border-color:#a11111}
.xe .tally{font-size:14px;color:#666;margin:14px 0 0}
`;

function today() {
  const now = new Date();
  const pad = (one) => String(one).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function pretty(date) {
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? date
    : read.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The tri-state answer, in words. null is not a missing value to explain — it is "only a name for the day".
function attended(attend) {
  if (attend === true) return "Present";
  if (attend === false) return "Absent";
  return "Not marked";
}

export default function ExtraEvent({ communityId, email }) {
  const [members, setMembers] = useState({ community_id: "", list: [] });
  const [rows, setRows] = useState({ community_id: "", list: [] });
  const [draft, setDraft] = useState({ member_id: "", event_name: "", event_date: today(), attend: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const people = members.community_id === communityId ? mapExtraMembers(members.list) : [];
  const list = rows.community_id === communityId ? rows.list : [];
  // Every day an absent friend was marked for is a row, so this register grows without ever being
  // cleaned; twenty-five of them are printed, and the badge above still counts the whole of it.
  const shown = usePager(list, PER_PAGE, communityId);

  const load = useCallback(() => {
    if (!communityId) return;
    Promise.all([extra.getMembers(communityId), extra.getEvents({ community_id: communityId })])
      .then(([peopleList, events]) => {
        setMembers({ community_id: communityId, list: peopleList || [] });
        setRows({ community_id: communityId, list: events || [] });
      })
      .catch((e) => setError(e.message));
  }, [communityId]);

  useEffect(() => { load(); }, [load]);

  async function record(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      await extra.recordEvent({
        community_id: communityId,
        member_id: draft.member_id,
        event_name: draft.event_name.trim(),
        event_date: draft.event_date,
        attend: draft.attend === "" ? null : draft.attend === "true",
        reason: draft.attend === "false" ? draft.reason : "",
        recorded_by: email,
      });
      setDraft({ member_id: "", event_name: "", event_date: today(), attend: "", reason: "" });
      setOk("Recorded for the day.");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(one) {
    setError("");
    try {
      await extra.removeEvent(one.event_id);
      setRows({ community_id: communityId, list: list.filter((p) => p.event_id !== one.event_id) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="xe">
      <style>{css}</style>

      <h3>
        Attendance for extra members
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">
        Mark which of the members who never joined came to a gathering. An absence can carry a reason;
        a name alone for a day is allowed too, and is not read as present.
      </p>

      <form className="card" onSubmit={record}>
        <div className="grid">
          <label>
            Who
            <PeoplePicker people={people} value={draft.member_id} onChange={(id) => setDraft({ ...draft, member_id: id })} placeholder={people.length ? "Search by name" : "Add extra members first"} />
          </label>
          <label>
            Gathering (optional)
            <input type="text" value={draft.event_name} placeholder="Sunday Fellowship" onChange={(event) => setDraft({ ...draft, event_name: event.target.value })} />
          </label>
          <label>
            Day
            <input type="date" value={draft.event_date} onChange={(event) => setDraft({ ...draft, event_date: event.target.value })} />
          </label>
          <label>
            Came?
            <select value={draft.attend} onChange={(event) => setDraft({ ...draft, attend: event.target.value })}>
              <option value="">Not marked</option>
              <option value="true">Present</option>
              <option value="false">Absent</option>
            </select>
          </label>
          {draft.attend === "false" && (
            <label>
              Reason
              <select value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })}>
                <option value="">No reason given</option>
                {REASONS.map((one) => (
                  <option key={one} value={one}>{one}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="actions">
          <button className="go" type="submit" disabled={saving}>
            {saving ? "Recording…" : "Record attendance"}
          </button>
        </div>
        {error && <p className="fail">{error}</p>}
        {ok && !error && <p className="ok">{ok}</p>}
      </form>

      {list.length ? (
        <div className="tablewrap" id={shown.anchorId}>
          <table>
            <thead>
              <tr>
                <th>Who</th>
                <th>Gathering</th>
                <th>Day</th>
                <th>Came</th>
                <th>Reason</th>
                <th className="last" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.chunk.map((one) => {
                const named = `${one.extra_members?.name ?? ""} ${one.extra_members?.surname ?? ""}`.trim();
                return (
                  <tr key={one.event_id}>
                    <td>{named || "An extra member"}</td>
                    <td>{one.event_name || "—"}</td>
                    <td>{pretty(one.event_date)}</td>
                    <td>{attended(one.attend)}</td>
                    <td>{one.reason || "—"}</td>
                    <td className="last">
                      <button className="ghost" type="button" onClick={() => remove(one)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tally">Nothing has been recorded for the extra members yet.</p>
      )}
      <Pager state={shown} noun={shown.total === 1 ? "record" : "records"} />
    </section>
  );
}
