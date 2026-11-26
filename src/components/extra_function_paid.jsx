import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import PeoplePicker, { mapExtraMembers } from "./people_picker.jsx";
import ProofViewer from "./proof_viewer.jsx";
import Pager, { usePager, PER_PAGE } from "./pager.jsx";

/*
  Money for one planned function from an extra member, kept in `extra_function_paid`, shown beside
  the attendance half at the foot of the function's register. It only appears under a function that
  asks for money, because a free plan has no reason to hold a payment row.

  The row is keyed on the (function, member) pair, so it is revised in place. A leader gives three
  things here: whether it is paid, a date promised when it is not paid yet, and a receipt. A receipt
  is a real file — an image or a pdf — and, exactly like a testimony attachment, it is compressed
  best-effort and pushed to the public bucket in the browser before the row is written; only the URL
  and the moment it went up are stored. Confirming a receipt records who checked it (the signed-in
  leader, by name) and the server stamps the time — a browser never sets its own confirmation.
*/

const css = `
.xfp{margin:44px 0 0;padding-top:26px;border-top:1px solid #e3e3e3}
.xfp h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 12px;font-weight:600;display:flex;align-items:center;gap:10px}
.xfp h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xfp .lede{font-size:14px;color:#666;margin:0 0 16px;max-width:62ch}
.xfp .card{border:1px solid #e3e3e3;border-radius:2px;padding:18px 20px;background:#fafafa}
.xfp .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.xfp label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.xfp label > input,.xfp label > select{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;font-weight:400;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.xfp label > input:focus,.xfp label > select:focus{outline:none;border-color:#111}
.xfp .actions{display:flex;gap:10px;margin-top:18px}
.xfp .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.xfp .go:disabled{opacity:.55;cursor:default}
.xfp .fail{color:#a11111;font-size:14px;margin:12px 0 0}
.xfp .tablewrap{border:1px solid #e3e3e3;border-radius:2px;overflow-x:auto;margin-top:14px}
.xfp table{width:100%;border-collapse:collapse;font-size:15px}
.xfp th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;padding:12px 14px;background:#fafafa;border-bottom:1px solid #e3e3e3}
.xfp td{padding:12px 14px;border-bottom:1px solid #e3e3e3;vertical-align:top}
.xfp tbody tr:last-child td{border-bottom:0}
.xfp .last{width:150px;text-align:right;padding-right:0}
.xfp .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:7px 14px;font-size:14px;font-family:inherit;cursor:pointer}
.xfp .ghost:hover{border-color:#111}
.xfp .ghost:disabled{opacity:.5;cursor:default}
.xfp .free{color:#666}
.xfp .tally{font-size:14px;color:#666;margin:14px 0 0}
`;

function pretty(date) {
  if (!date) return null;
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime()) ? date : read.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ExtraFunctionPaid({ communityId, functionId, email }) {
  const [members, setMembers] = useState({ community_id: "", list: [] });
  const [rows, setRows] = useState({ function_id: "", list: [] });
  const [draft, setDraft] = useState({ member_id: "", paid: true, expected_pay_date: "", file: null });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const people = members.community_id === communityId ? mapExtraMembers(members.list) : [];
  const list = rows.function_id === String(functionId) ? rows.list : [];
  // A chunk of the payment rows, every one of them still counted by the badge above.
  const shown = usePager(list, PER_PAGE, `${communityId}|${functionId}`);

  const load = useCallback(() => {
    if (!communityId || !functionId) return;
    Promise.all([extra.getMembers(communityId), extra.getFunctionPaid(functionId)])
      .then(([peopleList, payments]) => {
        setMembers({ community_id: communityId, list: peopleList || [] });
        setRows({ function_id: String(functionId), list: payments || [] });
      })
      .catch((e) => setError(e.message));
  }, [communityId, functionId]);

  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let proof_path = null;
      let proof_submitted_at = null;
      if (draft.file) {
        proof_path = await extra.uploadProof({ file: draft.file, uploaded_by: email });
        proof_submitted_at = new Date().toISOString();
      }
      await extra.setFunctionPaid({
        function_id: functionId,
        member_id: draft.member_id,
        paid: draft.paid,
        expected_pay_date: draft.expected_pay_date || null,
        proof_path,
        proof_submitted_at,
      });
      setDraft({ member_id: "", paid: true, expected_pay_date: "", file: null });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirm(one) {
    setBusyId(one.member_id);
    setError("");
    try {
      await extra.updateFunctionPaid({ function_id: functionId, member_id: one.member_id, confirmed_by: email });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  async function remove(one) {
    setError("");
    try {
      await extra.removeFunctionPaid({ function_id: functionId, member_id: one.member_id });
      setRows({ function_id: String(functionId), list: list.filter((p) => p.member_id !== one.member_id) });
    } catch (e) {
      setError(e.message);
    }
  }

  const showDate = !draft.paid;

  return (
    <section className="xfp">
      <style>{css}</style>

      <h3>
        Payments from extra members
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">What the members who never joined owe for this function, whether they have paid, and the receipt when they have.</p>

      <form className="card" onSubmit={save}>
        <div className="grid">
          <label>
            Who
            <PeoplePicker people={people} value={draft.member_id} onChange={(id) => setDraft({ ...draft, member_id: id })} placeholder={people.length ? "Search by name" : "Add extra members first"} />
          </label>
          <label>
            Paid?
            <select value={draft.paid ? "yes" : "no"} onChange={(event) => setDraft({ ...draft, paid: event.target.value === "yes" })}>
              <option value="yes">Paid</option>
              <option value="no">Not yet</option>
            </select>
          </label>
          {showDate && (
            <label>
              Promised by
              <input type="date" value={draft.expected_pay_date} onChange={(event) => setDraft({ ...draft, expected_pay_date: event.target.value })} />
            </label>
          )}
          <label>
            Receipt (optional)
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] || null })}
            />
          </label>
        </div>
        <div className="actions">
          <button className="go" type="submit" disabled={saving || !draft.member_id}>
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
        {error && <p className="fail">{error}</p>}
      </form>

      {list.length ? (
        <div className="tablewrap" id={shown.anchorId}>
          <table>
            <thead>
              <tr>
                <th>Who</th>
                <th>Paid</th>
                <th>Promised by</th>
                <th>Receipt</th>
                <th>Confirmed by</th>
                <th className="last" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.chunk.map((one) => {
                const named = `${one.extra_members?.name ?? ""} ${one.extra_members?.surname ?? ""}`.trim();
                const conf = `${one.confirmed?.name ?? ""} ${one.confirmed?.surname ?? ""}`.trim();
                return (
                  <tr key={one.member_id}>
                    <td>{named || "An extra member"}</td>
                    <td>{one.paid ? "Paid" : "Not yet"}</td>
                    <td>{one.expected_pay_date ? pretty(one.expected_pay_date) : <span className="free">—</span>}</td>
                    <td>
                      {one.proof_path
                        ? <ProofViewer url={one.proof_path} label={named} />
                        : <span className="free">No receipt</span>}
                    </td>
                    <td>{conf || <span className="free">Not checked</span>}</td>
                    <td className="last">
                      {one.paid && !one.confirmed_by && (
                        <button className="ghost" type="button" disabled={busyId === one.member_id} onClick={() => confirm(one)}>
                          {busyId === one.member_id ? "Saving…" : "Confirm"}
                        </button>
                      )}{" "}
                      <button className="ghost" type="button" onClick={() => remove(one)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tally">No payment is recorded for an extra member under this function yet.</p>
      )}
      <Pager state={shown} noun={shown.total === 1 ? "payment" : "payments"} />
    </section>
  );
}
