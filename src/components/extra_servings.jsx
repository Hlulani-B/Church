import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import PeoplePicker, { mapExtraMembers } from "./people_picker.jsx";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";

/*
  A serving — a role a person holds — kept for one of the people who never open the app, shown on the
  servings page beside the register it mirrors.

  The fellowship already records what a member does against their address in the real servings table;
  this is the same idea for an extra member, whose only handle is the uuid the dashboard gave them. A
  serving is a free word (worship, ushering, teaching), because that is exactly how the real servings
  page leaves it. A member may hold more than one, since each row is keyed by its own id rather than
  by the member, and the who-box is the same shared people picker the rest of the extra feature uses.

  Nothing here prints an address, and none exists to print: an extra member has no address at all, so
  every line is their name and surname, read off the joined extra_members the server returns.
*/

const css = `
.xs{margin:44px 0 0;padding-top:26px;border-top:1px solid #e3e3e3}
.xs h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 12px;font-weight:600;display:flex;align-items:center;gap:10px}
.xs h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xs .lede{font-size:14px;color:#666;margin:0 0 16px;max-width:62ch}
.xs .card{border:1px solid #e3e3e3;border-radius:2px;padding:18px 20px;background:#fafafa}
.xs .fields{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.xs .field{display:flex;flex-direction:column;gap:6px;flex:1 1 200px}
.xs .field > span{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.xs .field input{font:inherit;font-size:16px;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px}
.xs .field input:focus{outline:none;border-color:#111}
.xs .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.xs .go:disabled{opacity:.55;cursor:default}
.xs .fail{color:#a11111;font-size:14px;margin:12px 0 0}
.xs .ok{color:#1c7a34;font-size:14px;margin:12px 0 0}
.xs .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.xs table{width:100%;border-collapse:collapse;font-size:15px}
.xs th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.xs td{padding:12px 16px;border-bottom:1px solid #e3e3e3;vertical-align:middle}
.xs tbody tr:last-child td{border-bottom:0}
.xs .role{display:inline-block;border:1px solid #e3e3e3;padding:2px 10px;font-size:12px;font-weight:600;text-transform:capitalize;background:#fff}
.xs .edit{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.xs .edit input{font:inherit;font-size:14px;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:7px 10px;min-width:0}
.xs .edit input:focus{outline:none;border-color:#111}
.xs .go.small{padding:7px 14px;font-size:13px}
.xs .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:7px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.xs .ghost:hover{border-color:#111}
.xs .ghost:disabled{opacity:.5;cursor:default}
.xs .ghost.danger{color:#a11111}
.xs .ghost.danger:hover{border-color:#a11111}
.xs .last{width:88px;text-align:right;padding-right:0}
.xs .tally{font-size:14px;color:#666;margin:14px 0 0}
`;

// Whose serving this is — the joined extra member's two names, or a plain word when it is gone.
function nameOf(one) {
  return `${one.extra_members?.name ?? ""} ${one.extra_members?.surname ?? ""}`.trim();
}

export default function ExtraServings({ communityId }) {
  const [members, setMembers] = useState({ community_id: "", list: [] });
  const [rows, setRows] = useState({ community_id: "", list: [] });
  const [draft, setDraft] = useState({ member_id: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editValue, setEditValue] = useState("");
  const [busyId, setBusyId] = useState("");

  const people = members.community_id === communityId ? mapExtraMembers(members.list) : [];
  const list = rows.community_id === communityId ? rows.list : [];
  // A chunk of the servings on the screen; saving one still rewrites the whole list, so only the
  // printing is cut and the badge above still counts every serving this community has.
  const shown = usePager(list, PER_PAGE, communityId);

  const load = useCallback(() => {
    if (!communityId) return;
    Promise.all([extra.getMembers(communityId), extra.getServings(communityId)])
      .then(([peopleList, servings]) => {
        setMembers({ community_id: communityId, list: peopleList || [] });
        setRows({ community_id: communityId, list: servings || [] });
      })
      .catch((e) => setError(e.message));
  }, [communityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addServing(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      await extra.addServing({ member_id: draft.member_id, community_id: communityId, role: draft.role.trim() });
      setDraft({ member_id: "", role: "" });
      setOk("That serving is recorded.");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(one) {
    setBusyId(one.id);
    setError("");
    setOk("");
    try {
      const role = editValue.trim();
      await extra.updateServing(one.id, { role });
      setRows({ community_id: communityId, list: list.map((p) => (p.id === one.id ? { ...p, role } : p)) });
      setEditingId("");
      setEditValue("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function remove(one) {
    setBusyId(one.id);
    setError("");
    setOk("");
    try {
      await extra.removeServing(one.id);
      setRows({ community_id: communityId, list: list.filter((p) => p.id !== one.id) });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="xs">
      <style>{css}</style>

      <h3>
        Extra servings
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">
        What the members who never use the app do for this fellowship — the same role a serving is
        given on the real servings page, kept here against the extra member who holds it.
      </p>

      <form className="card" onSubmit={addServing}>
        <div className="fields">
          <label className="field">
            <span>Who</span>
            <PeoplePicker
              people={people}
              value={draft.member_id}
              onChange={(id) => setDraft({ ...draft, member_id: id })}
              placeholder={people.length ? "Search by name" : "Add extra members first"}
            />
          </label>
          <label className="field">
            <span>Serving / role</span>
            <input
              type="text"
              value={draft.role}
              autoComplete="off"
              placeholder="worship, ushering, teaching…"
              onChange={(event) => setDraft({ ...draft, role: event.target.value })}
            />
          </label>
          <button className="go" type="submit" disabled={saving || !draft.member_id}>
            {saving ? "Adding…" : "Add serving"}
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
                <th>Serving</th>
                <th className="last" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.chunk.map((one) => (
                <tr key={one.id}>
                  <td>{nameOf(one) || "An extra member"}</td>
                  <td>
                    {editingId === one.id ? (
                      <div className="edit">
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          placeholder="role"
                          onChange={(event) => setEditValue(event.target.value)}
                        />
                        <button
                          className="go small"
                          type="button"
                          disabled={busyId === one.id}
                          onClick={() => saveRole(one)}
                        >
                          {busyId === one.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          className="ghost"
                          type="button"
                          disabled={busyId === one.id}
                          onClick={() => {
                            setEditingId("");
                            setEditValue("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="edit">
                        <span className="role">{one.role || "—"}</span>
                        <button
                          className="ghost"
                          type="button"
                          onClick={() => {
                            setEditingId(one.id);
                            setEditValue(one.role || "");
                          }}
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="last">
                    <button
                      className="ghost danger"
                      type="button"
                      disabled={busyId === one.id}
                      onClick={() => remove(one)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tally">No serving has been recorded for an extra member yet.</p>
      )}
      <Pager state={shown} noun={shown.total === 1 ? "serving" : "servings"} />
    </section>
  );
}
