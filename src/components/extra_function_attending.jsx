import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import PeoplePicker, { mapExtraMembers } from "./people_picker.jsx";

/*
  An extra member's answer to one planned function, kept in `extra_function_attending`. It opens at
  the foot of the function's register (individual_function.jsx), where a leader already reads
  everybody else's yes and no — this is the same register's missing half, the people who never joined
  and so can never answer for themselves.

  The row is keyed on the (function, member) pair, so the write is an upsert: picking a different
  answer replaces it rather than adding a second one. There is nothing to timestamp here beyond the
  row itself — it is a leader stating where a friend stands under this plan.
*/

const css = `
.xfa{margin:44px 0 0;padding-top:26px;border-top:1px solid #e3e3e3}
.xfa h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 12px;font-weight:600;display:flex;align-items:center;gap:10px}
.xfa h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xfa .lede{font-size:14px;color:#666;margin:0 0 16px;max-width:62ch}
.xfa .bar{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.xfa label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600;flex:1 1 220px}
.xfa .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.xfa .go:disabled{opacity:.55;cursor:default}
.xfa .fail{color:#a11111;font-size:14px;margin:12px 0 0}
.xfa .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.xfa table{width:100%;border-collapse:collapse;font-size:15px}
.xfa th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.xfa td{padding:12px 14px;border-bottom:1px solid #e3e3e3}
.xfa tbody tr:last-child td{border-bottom:0}
.xfa .last{width:140px;text-align:right;padding-right:0}
.xfa .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:7px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.xfa .ghost:hover{border-color:#111}
.xfa .tally{font-size:14px;color:#666;margin:14px 0 0}
`;

export default function ExtraFunctionAttending({ communityId, functionId }) {
  const [members, setMembers] = useState({ community_id: "", list: [] });
  const [rows, setRows] = useState({ function_id: "", list: [] });
  const [memberId, setMemberId] = useState("");
  const [attending, setAttending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const people = members.community_id === communityId ? mapExtraMembers(members.list) : [];
  const list = rows.function_id === String(functionId) ? rows.list : [];

  const load = useCallback(() => {
    if (!communityId || !functionId) return;
    Promise.all([extra.getMembers(communityId), extra.getFunctionAttending(functionId)])
      .then(([peopleList, answers]) => {
        setMembers({ community_id: communityId, list: peopleList || [] });
        setRows({ function_id: String(functionId), list: answers || [] });
      })
      .catch((e) => setError(e.message));
  }, [communityId, functionId]);

  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await extra.setFunctionAttending({ function_id: functionId, member_id: memberId, attending });
      setMemberId("");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function reanswer(one, value) {
    setError("");
    try {
      await extra.setFunctionAttending({ function_id: functionId, member_id: one.member_id, attending: value });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(one) {
    setError("");
    try {
      await extra.removeFunctionAttending({ function_id: functionId, member_id: one.member_id });
      setRows({ function_id: String(functionId), list: list.filter((p) => p.member_id !== one.member_id) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="xfa">
      <style>{css}</style>

      <h3>
        Extra members attending
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">Say where a member who never joined stands under this plan. They are not on the register above because they cannot answer for themselves — you answer here.</p>

      <form className="bar" onSubmit={save}>
        <label>
          Who
          <PeoplePicker people={people} value={memberId} onChange={setMemberId} placeholder={people.length ? "Search by name" : "Add extra members first"} />
        </label>
        <label>
          Attending?
          <select value={attending ? "yes" : "no"} onChange={(event) => setAttending(event.target.value === "yes")}>
            <option value="yes">Coming</option>
            <option value="no">Not coming</option>
          </select>
        </label>
        <button className="go" type="submit" disabled={saving || !memberId}>
          {saving ? "Saving…" : "Record answer"}
        </button>
      </form>
      {error && <p className="fail">{error}</p>}

      {list.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Who</th>
                <th>Attending</th>
                <th className="last" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((one) => {
                const named = `${one.extra_members?.name ?? ""} ${one.extra_members?.surname ?? ""}`.trim();
                return (
                  <tr key={one.member_id}>
                    <td>{named || "An extra member"}</td>
                    <td>{one.attending ? "Coming" : "Not coming"}</td>
                    <td className="last">
                      <button className="ghost" type="button" onClick={() => reanswer(one, !one.attending)}>
                        Toggle
                      </button>{" "}
                      <button className="ghost" type="button" onClick={() => remove(one)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tally">No extra member has an answer for this function yet.</p>
      )}
    </section>
  );
}
