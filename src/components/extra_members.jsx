import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";

/*
  The two things a leader or an admin does about the people who will not use the app, shown under the
  real roster on each dashboard: a box to add somebody by name and surname, and the list of everyone
  already added to this community.

  Nobody here joins, scans a code or signs in. These rows exist so a fellowship can still keep an
  attendance record, a testimony or a payment for a person who never opens the app — so the add box
  takes only the two names, and the one who added them is recorded silently as `created_by` (the
  signed-in address, which this component is handed but never prints for anybody else).

  The same rows are the source every "for whom?" picker reads from, which is why removal is offered
  here and nothing else: adding and listing is the whole of what this screen was asked to be. Writing
  about a member — an attendance record, a testimony — happens on the pages that already hold those,
  not here.
*/

const css = `
.xm{margin:48px 0 0}
.xm h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.xm h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xm .lede{font-size:14px;color:#666;margin:0 0 16px;max-width:60ch}
.xm .card{border:1px solid #e3e3e3;border-radius:2px;padding:18px 20px;background:#fafafa}
.xm .fields{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.xm .field{display:flex;flex-direction:column;gap:6px;flex:1 1 180px}
.xm .field span{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.xm .field input{font:inherit;font-size:16px;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px}
.xm .field input:focus{outline:none;border-color:#111}
.xm .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.xm .go:disabled{opacity:.55;cursor:default}
.xm .fail{color:#a11111;font-size:14px;margin:12px 0 0}
.xm .ok{color:#1c7a34;font-size:14px;margin:12px 0 0}
.xm .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.xm table{width:100%;border-collapse:collapse;font-size:15px}
.xm th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.xm td{padding:12px 16px;border-bottom:1px solid #e3e3e3;vertical-align:middle}
.xm tbody tr:last-child td{border-bottom:0}
.xm td .who{display:flex;align-items:center;gap:12px;font-weight:500}
.xm .avatar{flex:none;width:34px;height:34px;border-radius:50%;background:#666;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,serif;font-size:15px}
.xm .last{width:88px;text-align:right;padding-right:0}
.xm .ghost{background:#fff;color:#a11111;border:1px solid #e3e3e3;border-radius:2px;padding:7px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.xm .ghost:hover{border-color:#a11111}
.xm .ghost:disabled{opacity:.5;cursor:default}
.xm .tally{font-size:14px;color:#666;margin:14px 0 0}
`;

export default function ExtraMembers({ communityId, email }) {
  const [rows, setRows] = useState({ community_id: "", list: [] });
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [removingId, setRemovingId] = useState("");

  const list = rows.community_id === communityId ? rows.list : [];
  // Twenty-five of the added people on the screen; the badge above still counts every one of them.
  const shown = usePager(list, PER_PAGE, communityId);

  const load = useCallback(() => {
    if (!communityId) return;
    extra
      .getMembers(communityId)
      .then((people) => setRows({ community_id: communityId, list: people || [] }))
      .catch((e) => setError(e.message));
  }, [communityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      await extra.addMember({ community_id: communityId, name, surname, created_by: email });
      setName("");
      setSurname("");
      setOk("They are on the list now.");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(one) {
    setRemovingId(one.member_id);
    setError("");
    setOk("");
    try {
      await extra.removeMember(one.member_id);
      setRows({ community_id: communityId, list: list.filter((p) => p.member_id !== one.member_id) });
    } catch (e) {
      setError(e.message);
    } finally {
      setRemovingId("");
    }
  }

  return (
    <section className="xm">
      <style>{css}</style>

      <h3>
        Add members
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">
        For the people in this fellowship who will not use the app. They never join and never sign
        in; you are only writing their name so an attendance record, a testimony or a payment can be
        kept for them.
      </p>

      <form className="card" onSubmit={addMember}>
        <div className="fields">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              autoComplete="off"
              placeholder="Their name"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Surname</span>
            <input
              type="text"
              value={surname}
              autoComplete="off"
              placeholder="Their surname"
              onChange={(event) => setSurname(event.target.value)}
            />
          </label>
          <button className="go" type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add member"}
          </button>
        </div>
        {error && <p className="fail">{error}</p>}
        {ok && !error && <p className="ok">{ok}</p>}
      </form>

      <h3>Extra members</h3>
      {list.length ? (
        <div className="tablewrap" id={shown.anchorId}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Surname</th>
                <th className="last" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.chunk.map((one) => (
                // The uuid is the row's identity, and the id every "for whom?" picker will carry.
                <tr key={one.member_id}>
                  <td className="name">
                    <div className="who">
                      <span className="avatar" aria-hidden="true">
                        {(one.name || "?").charAt(0).toUpperCase()}
                      </span>
                      {one.name}
                    </div>
                  </td>
                  <td>{one.surname}</td>
                  <td className="last">
                    <button
                      className="ghost"
                      type="button"
                      disabled={removingId === one.member_id}
                      onClick={() => removeMember(one)}
                    >
                      {removingId === one.member_id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tally">Nobody has been added for this community yet.</p>
      )}
      <Pager state={shown} noun={shown.total === 1 ? "member" : "members"} />
    </section>
  );
}
