import React, { useCallback, useEffect, useState } from "react";
import extra from "../page_functions/extra.js";
import { UserFetch } from "../page_functions/user.js";
import { decryptText } from "../page_functions/crypto.js";
import PeoplePicker, { mapUsers, mapExtraMembers } from "./people_picker.jsx";
import Pager, { usePager } from "./pager.jsx";

/*
  The testimonies kept for the people who never join the app, shown under the real testimony list on
  every testimonies page.

  Two halves, and who is looking decides which they see:

    - Reading. Everybody — member, leader, admin — reads this community's extra testimonies, but only
      the ones they are allowed to. The server settles that: a row opened to all (allow_all) is shown
      to anyone, a row narrowed to a list is shown only to the addresses on it. A member's screen sends
      just their own address; a leader's or an admin's register sends `for_all`, which shows the whole
      community's sharing so the ones that write it can also manage who reads them.

    - Writing on somebody's behalf, which only a leader or an admin (`privileged`) is given. It is the
      same testimony an author would record for themselves — the day, text or a file, and who may read
      it — but written against an extra member instead of a signed-in address. The file half runs
      through the same best-effort lossless compression and public upload the real add uses, and the
      words half is encrypted in the browser first; `extra.addTestimony` does both before it calls the
      server, exactly as `TestimoniesFetch.addTestimony` does for a member's own row.

  Who may read is chosen with the shared people box, not a comma-separated list of addresses: the
  community's own people are listed by name and surname and picked by name, while the email that is
  stored stays out of sight. The "for whom?" box is the same component over the community's extra
  members, keyed by their uuid.

  An author recorded against an extra member cannot be trusted to leave their own email out of a body
  they typed, so the words a reader sees run through the same decrypt the real pages use.
*/

const directory = new UserFetch();

const css = `
.xt{margin:56px 0 0;padding-top:28px;border-top:1px solid #e3e3e3}
.xt h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 12px;font-weight:600;display:flex;align-items:center;gap:10px}
.xt h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.xt .lede{font-size:14px;color:#666;margin:0 0 18px;max-width:62ch}
.xt .card{border:1px solid #e3e3e3;border-radius:2px;padding:20px 22px;background:#fafafa;margin:0 0 26px}
.xt .grid{display:grid;gap:16px}
.xt .two{display:grid;gap:16px;grid-template-columns:1fr 1fr}
.xt .xt label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#666;font-weight:600}
.xt .xt label > input,.xt .xt label > textarea,.xt .xt label > select{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;font-weight:400;color:#111;background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.xt .xt label > textarea{min-height:120px;resize:vertical;line-height:1.55}
.xt .xt label > input:focus,.xt .xt label > textarea:focus{outline:none;border-color:#111}
.xt .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;justify-self:start}
.xt .go:disabled{opacity:.55;cursor:default}
.xt .fail{color:#a11111;font-size:14px;margin:14px 0 0}
.xt .ok{color:#1c7a34;font-size:14px;margin:14px 0 0}
.xt .tally{font-size:14px;color:#666;margin:0 0 16px}

.xt .item{display:grid;grid-template-columns:44px 1fr;gap:16px;border:1px solid #e3e3e3;border-radius:2px;padding:18px 20px;margin:0 0 12px;background:#fff}
.xt .item .avatar{width:44px;height:44px;border-radius:50%;background:#666;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,serif;font-size:19px}
.xt .item .meta{display:flex;justify-content:space-between;gap:4px 14px;flex-wrap:wrap;font-size:13px;color:#666}
.xt .item .meta .who{color:#111;font-weight:600;font-size:14px}
.xt .item .body{margin:8px 0 0;font-size:16px;line-height:1.7;color:#222}
.xt .row{display:flex;gap:10px;margin:14px 0 0}
.xt .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:9px 16px;font-size:14px;font-family:inherit;cursor:pointer}
.xt .ghost:disabled{opacity:.45;cursor:default}

.xt .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.xt .pop{background:#fff;border-radius:2px;width:100%;max-width:560px;max-height:calc(100vh - 48px);overflow:auto;padding:26px 28px 28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.xt .pop h2{font-size:22px;margin:0 0 6px}
.xt .pop .sub{color:#666;font-size:14px;margin:0}
.xt .pop .actions{display:flex;justify-content:flex-end;gap:10px;margin:24px 0 0}
`;

function pretty(date) {
  const read = new Date(`${date}T00:00:00`);
  return Number.isNaN(read.getTime())
    ? date
    : read.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function today() {
  const now = new Date();
  const pad = (one) => String(one).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const EMPTY_DRAFT = { member_id: "", date: "", body: "", type: "text", file: null, allow_all: true, authorise: [] };

/* The stored body is encrypted words, an uploaded file's URL, or an old plain row — read the same way
   the real testimony pages read it. */
function Body({ value }) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState("");
  const encrypted = typeof value === "string" && value.startsWith("enc:v1:");
  const isUrl = typeof value === "string" && /^https?:\/\//i.test(value);
  const ext = isUrl ? value.split("?")[0].split(".").pop().toLowerCase() : "";

  useEffect(() => {
    if (!encrypted) return undefined;
    let live = true;
    decryptText(value)
      .then((plain) => live && setText(plain))
      .catch((e) => live && setFailed(e.message || "This testimony could not be opened."));
    return () => { live = false; };
  }, [value, encrypted]);

  if (isUrl) {
    if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) {
      return <img src={value} alt="Testimony image" style={{ maxWidth: "100%", height: "auto" }} />;
    }
    const label = ext === "pdf" ? "Open the PDF testimony" : ext === "docx" ? "Download the document" : "Open the attached file";
    return <a href={value} target="_blank" rel="noreferrer">{label}</a>;
  }
  if (encrypted) {
    if (failed) return <span>{failed}</span>;
    if (text === null) return <span>Opening…</span>;
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }
  return <span style={{ whiteSpace: "pre-wrap" }}>{value}</span>;
}

export default function ExtraTestimonies({ communityId, email, privileged = false }) {
  const [rows, setRows] = useState({ community_id: "", list: [] });
  const [members, setMembers] = useState({ community_id: "", list: [] });
  const [users, setUsers] = useState({ community_id: "", list: [] });

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState({ allow_all: true, authorise: [] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const list = rows.community_id === communityId ? rows.list : [];
  // A testimony is a card with the whole of somebody's sharing on it, so ten of them is already a
  // long scroll; the rest are a click away and still counted by the line underneath.
  const shown = usePager(list, 10, communityId);
  const memberPeople = members.community_id === communityId ? mapExtraMembers(members.list) : [];
  const userPeople = users.community_id === communityId ? mapUsers(users.list) : [];

  // Read the extra testimonies this viewer is allowed to see.
  const load = useCallback(() => {
    if (!communityId || !email) return;
    extra
      .getTestimonies({ community_id: communityId, viewer_email: email, for_all: privileged })
      .then((result) => setRows({ community_id: communityId, list: result || [] }))
      .catch((e) => setError(e.message));
  }, [communityId, email, privileged]);

  useEffect(() => { load(); }, [load, refresh]);

  // A privileged screen also needs the two pickers' sources: the extra members and the community's people.
  useEffect(() => {
    if (!privileged || !communityId) return;
    extra.getMembers(communityId).then((people) => setMembers({ community_id: communityId, list: people || [] })).catch(() => {});
    directory.getUsers(communityId).then((result) => setUsers({ community_id: communityId, list: result || [] })).catch(() => {});
  }, [privileged, communityId]);

  // Escape leaves the "who can read" popup unless the write is on its way.
  useEffect(() => {
    if (!editing) return undefined;
    function onKey(event) { if (event.key === "Escape" && !editSaving) setEditing(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, editSaving]);

  function openAdd() {
    setDraft({ ...EMPTY_DRAFT, date: today() });
    setFormError("");
    setOk("");
    setAdding(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await extra.addTestimony({
        community_id: communityId,
        member_id: draft.member_id,
        date: draft.date,
        type: draft.type,
        body: draft.body,
        file: draft.file,
        allow_all: draft.allow_all,
        authorise: draft.allow_all ? [] : draft.authorise,
        recorded_by: email,
      });
      setAdding(false);
      setOk("Their testimony is recorded.");
      setError("");
      setRefresh((count) => count + 1);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(one) {
    setEditDraft({
      allow_all: one.allow_all !== false,
      authorise: Array.isArray(one.authorise) ? one.authorise : [],
    });
    setEditError("");
    setEditing(one);
  }

  async function saveEdit(event) {
    event.preventDefault();
    setEditSaving(true);
    setEditError("");
    try {
      await extra.updateAuthorise({
        testimony_id: editing.testimony_id,
        allow_all: editDraft.allow_all,
        authorise: editDraft.allow_all ? [] : editDraft.authorise,
      });
      setEditing(null);
      setRefresh((count) => count + 1);
    } catch (e) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(one) {
    setFormError("");
    try {
      await extra.removeTestimony(one.testimony_id);
      setRows({ community_id: communityId, list: list.filter((p) => p.testimony_id !== one.testimony_id) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="xt">
      <style>{css}</style>

      <h3>
        Testimonies for extra members
        {list.length ? <span className="count">{list.length}</span> : null}
      </h3>
      <p className="lede">
        {privileged
          ? "A sharing recorded for one of the members who never joined. Choose them, add the day and the words or a file, and decide who may read it."
          : "The sharing the fellowship has recorded for its members who never joined, shown here wherever you were allowed to read it."}
      </p>

      {privileged && (
        <>
          {!adding ? (
            <button className="go" type="button" onClick={openAdd}>
              Add a testimony for an extra member
            </button>
          ) : (
            <form className="card" style={{ marginTop: 18 }} onSubmit={save}>
              <div className="grid">
                <label>
                  For whom
                  <PeoplePicker people={memberPeople} value={draft.member_id} onChange={(id) => setDraft({ ...draft, member_id: id })} placeholder={members.list.length ? "Search by name" : "No extra members yet"} />
                </label>
                <label>
                  Date
                  <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
                </label>
                <label>
                  Type
                  <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">Docx</option>
                  </select>
                </label>
                {draft.type === "text" ? (
                  <label>
                    Testimony
                    <textarea value={draft.body} placeholder="What did God do?" onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
                  </label>
                ) : (
                  <label>
                    {draft.type === "image" ? "Image" : draft.type === "pdf" ? "PDF" : "Document"}
                    <input
                      type="file"
                      accept={draft.type === "image" ? "image/*" : draft.type === "pdf" ? "application/pdf" : ".docx"}
                      onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] || null })}
                    />
                  </label>
                )}
                <label>
                  Allow everybody to read this?
                  <select value={draft.allow_all ? "yes" : "no"} onChange={(event) => setDraft({ ...draft, allow_all: event.target.value === "yes" })}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                {!draft.allow_all && (
                  <label>
                    Authorise
                    <PeoplePicker multiple people={userPeople} value={draft.authorise} onChange={(ids) => setDraft({ ...draft, authorise: ids })} placeholder="Search by name to authorise" />
                  </label>
                )}
              </div>
              {formError && <p className="fail">{formError}</p>}
              <div className="row">
                <button className="go" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save testimony"}
                </button>
                <button className="ghost" type="button" disabled={saving} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {ok && !error && !adding && <p className="ok">{ok}</p>}
        </>
      )}

      <div style={{ marginTop: 22 }} id={shown.anchorId}>
        {error && <p className="fail">{error}</p>}
        {list.length ? (
          shown.chunk.map((one) => {
            const named = `${one.extra_members?.name ?? ""} ${one.extra_members?.surname ?? ""}`.trim();
            return (
              <article className="item" key={one.testimony_id}>
                <span className="avatar" aria-hidden="true">{named ? named.charAt(0).toUpperCase() : ""}</span>
                <div>
                  <div className="meta">
                    <span className="who">{named || "An extra member"}</span>
                    <span>{pretty(one.date)}</span>
                  </div>
                  <p className="body"><Body value={one.body} /></p>
                  {privileged && (
                    <div className="row">
                      <button className="ghost" type="button" onClick={() => openEdit(one)}>Update who can see</button>
                      <button className="ghost" type="button" onClick={() => remove(one)}>Remove</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          !error && <p className="tally">{privileged ? "Nothing has been recorded for the extra members yet." : "Nothing here has been shared with you yet."}</p>
        )}
        <Pager state={shown} noun={shown.total === 1 ? "testimony" : "testimonies"} />
      </div>

      {editing && (
        <div className="veil" role="dialog" aria-modal="true" aria-label="Update who can read" onClick={() => !editSaving && setEditing(null)}>
          <form className="pop" onSubmit={saveEdit} onClick={(event) => event.stopPropagation()}>
            <h2>Update who can read</h2>
            <p className="sub">The testimony from {pretty(editing.date)}.</p>
            <div className="grid" style={{ marginTop: 18 }}>
              <label>
                Allow everybody to read this?
                <select value={editDraft.allow_all ? "yes" : "no"} onChange={(event) => setEditDraft({ ...editDraft, allow_all: event.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              {!editDraft.allow_all && (
                <label>
                  Authorise
                  <PeoplePicker multiple people={userPeople} value={editDraft.authorise} onChange={(ids) => setEditDraft({ ...editDraft, authorise: ids })} placeholder="Search by name to authorise" />
                </label>
              )}
            </div>
            {editError && <p className="fail">{editError}</p>}
            <div className="actions">
              <button className="ghost" type="button" disabled={editSaving} onClick={() => setEditing(null)}>Cancel</button>
              <button className="go" type="submit" disabled={editSaving} style={{ marginTop: 0 }}>{editSaving ? "Saving…" : "Save readers"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
