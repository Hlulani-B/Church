import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { TestimoniesFetch } from "../page_functions/testimonies.js";
import { decryptText } from "../page_functions/crypto.js";
import Menu from "../components/menu.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import BackToCommunities from "../components/back.jsx";
import ExtraTestimonies from "../components/extra_testimonies.jsx";
import { adminState, rememberAdmin } from "../admin/state.js";

const accounts = new Auth();
const testimonies = new TestimoniesFetch();

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

.au .main{padding:64px 56px 96px;max-width:900px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}

.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}

.au .tally{font-size:14px;color:var(--muted);margin:36px 0 16px}

/* What a member is given: the day and the words. There is no author on a card here, because
   a name is read out of the roster and a member is not handed the roster. */
.au .item{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:0 0 12px;background:#fff}
.au .item .when{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.au .item .body{margin:8px 0 0;font-size:16px;line-height:1.7;color:#222}

.au .row{display:flex;gap:10px;margin:28px 0 0}
.au .ghost{background:#fff;color:#111;border:1px solid #bdbdbd;border-radius:2px;padding:11px 20px;font-size:15px;font-family:inherit;cursor:pointer}
.au .ghost:disabled{opacity:.45;cursor:default}
.au .back{display:inline-block;margin:36px 0 0;font-size:15px;font-weight:600;border-bottom:1px solid #111;text-decoration:none;cursor:pointer;background:none;border-width:0 0 1px;border-style:solid;padding:0}

/* The same popup the leader and admin open to record a testimony: a veil, a card, Escape or a
   click outside the card to leave it. */
.au .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.au .pop{background:#fff;border-radius:2px;width:100%;max-width:560px;max-height:calc(100vh - 48px);overflow:auto;padding:26px 28px 28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.au .pop h2{font-size:24px;margin:0 0 6px;text-transform:none}
.au .pop .who{color:var(--muted);font-size:14px;margin:0}
.au .pop label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:18px 0 0}
.au .pop input,.au .pop textarea,.au .pop select{font:inherit;font-size:16px;letter-spacing:normal;text-transform:none;font-weight:400;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:10px 12px;min-width:0}
.au .pop input:focus,.au .pop textarea:focus{outline:none;border-color:#111}
.au .pop textarea{min-height:160px;resize:vertical;line-height:1.55}
.au .pop .fail{color:#a11111;font-size:14px;margin:16px 0 0}
.au .pop .row{display:flex;justify-content:flex-end;gap:10px;margin:26px 0 0}
.au .pop .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .pop .go:disabled{opacity:.55;cursor:default}

/* A member gets one write: their own testimony, so the button that opens it stands out. */
.au .add{background:#111;color:#fff;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au .item{padding:16px 18px}
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
  How one testimony's body is shown, whatever the author attached. The stored body is now one of
  three things: encrypted words (an `enc:v1:` string we decrypt here), an uploaded file's public
  URL (image / pdf / docx), or an old plain-text row. The type is read back off the value itself,
  so this page does not need the fetch to carry a separate column.
*/
function TestimonyBody({ value }) {
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
    return () => {
      live = false;
    };
  }, [value, encrypted]);

  if (isUrl) {
    if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) {
      return <img src={value} alt="Testimony image" style={{ maxWidth: "100%", height: "auto" }} />;
    }
    const label =
      ext === "pdf"
        ? "Open the PDF testimony"
        : ext === "docx"
          ? "Download the document"
          : "Open the attached file";
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  if (encrypted) {
    if (failed) return <span>{failed}</span>;
    if (text === null) return <span>Opening…</span>;
    return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;
  }

  return <span style={{ whiteSpace: "pre-wrap" }}>{value}</span>;
}

export default function MemberTestimonies() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [fetched, setFetched] = useState(null);
  const [error, setError] = useState("");
  // The hundred on screen, tagged with the community it was read for.
  const [offset, setOffset] = useState(0);
  /*
    The popup the add button opens: the day, the type and the words or file. `refresh` is what
    makes the list read itself again once a testimony has been written, so the new row turns up
    without a reload.
  */
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: "", body: "", type: "text", file: null, allow_all: true, authorise: "" });
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;
  const { name: memberName, email: memberEmail } = admin;

  useEffect(() => {
    rememberAdmin({ community_id: communityId, name: memberName, email: memberEmail });
  }, [communityId, memberName, memberEmail]);

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    The address, not the session object, and the community the page is about. An answer is
    tagged with the community it was read from and only the one matching the screen is listed,
    so a response that lands after the community changed shows nothing rather than another
    community's sharings.
  */
  const email = signedIn?.email || "";
  useEffect(() => {
    if (!email || !communityId) return;
    testimonies
      .getTestimonies(communityId, offset, {}, email)
      .then((result) => {
        setFetched({ ...result, community_id: communityId });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [email, communityId, offset, refresh]);

  function openAdd() {
    setDraft({ date: today(), body: "", type: "text", file: null, allow_all: true, authorise: "" });
    setDraftError("");
    setAdding(true);
  }

  function closeAdd() {
    if (saving) return;
    setAdding(false);
  }

  /*
    Only the day, the type and the words or file are chosen here. The address the row is written
    against is the one signed in on this page and the community is the one on screen, both of
    which addTestimony takes from the caller rather than the form.
  */
  async function saveTestimony(event) {
    event.preventDefault();
    setSaving(true);
    setDraftError("");
    try {
      const authorise = String(draft.authorise || "")
        .split(",")
        .map((addr) => addr.trim())
        .filter(Boolean);
      const one = await testimonies.addTestimony({
        community_id: communityId,
        email,
        date: draft.date,
        type: draft.type,
        body: draft.body,
        file: draft.file,
        allow_all: draft.allow_all,
        authorise: draft.allow_all ? [] : authorise,
      });
      setAdding(false);
      setFetched(null);
      setRefresh((count) => count + 1);
      return one;
    } catch (e) {
      setDraftError(e.message);
    } finally {
      setSaving(false);
    }
    return null;
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

  const page = fetched?.community_id === communityId ? fetched : null;
  const first = page && page.shown ? page.from + 1 : 0;
  const last = page ? page.from + page.shown : 0;

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
        <p className="eyebrow">Testimonies</p>
        <h1 className="serif">{admin.name || "This community"}</h1>
        <p className="sub">{admin.email}</p>

        {/* The way out comes before the list, not after it. On a community with dozens of
            testimonies the bottom of the page is a long scroll away, and by then the person
            reading has already forgotten where they came from. */}
        <button
          className="back"
          type="button"
          onClick={() => navigate("/member-dashboard", { state: admin })}
        >
          Back to the dashboard
        </button>

        {!communityId ? (
          <div className="note">
            No community was chosen, so there is nothing to read here. Go back, click a
            community, and its testimonies open on this page.
          </div>
        ) : (
          <>
            <div className="row">
              <button className="add" type="button" onClick={openAdd}>
                Add a testimony
              </button>
            </div>

            {error && <div className="note bad">{error}</div>}
            {!error && !page && <LoadingBoxes count={4} words="Reading what this community has shared…" />}

            {page && !error && (
              <>
                <p className="tally">
                  {page.total
                    ? `Showing ${first}–${last} of ${page.total}, newest first.`
                    : "Nothing has been shared here yet."}
                </p>

                {page.testimonies.map((one) => (
                  <article className="item" key={one.testimony_id}>
                    <p className="when">{pretty(one.date)}</p>
                    <p className="body"><TestimonyBody value={one.body} /></p>
                  </article>
                ))}

                {page.total > page.shown || page.from > 0 ? (
                  <div className="row">
                    <button
                      className="ghost"
                      type="button"
                      disabled={page.from === 0}
                      onClick={() => setOffset(Math.max(0, page.from - page.shown))}
                    >
                      Newer
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      disabled={last >= page.total}
                      onClick={() => setOffset(last)}
                    >
                      Older
                    </button>
                  </div>
                ) : null}
              </>
            )}

            <ExtraTestimonies communityId={communityId} email={email} privileged={false} />
          </>
        )}

        <button
          className="back"
          type="button"
          onClick={() => navigate("/member-dashboard", { state: admin })}
        >
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
              Recorded against {email} in {admin.name || "this community"}.
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
              Type
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="pdf">PDF</option>
                <option value="docx">Docx</option>
              </select>
            </label>

            {draft.type === "text" ? (
              <label>
                Testimony
                <textarea
                  value={draft.body}
                  placeholder="What did God do?"
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
              </label>
            ) : (
              <label>
                {draft.type === "image" ? "Image" : draft.type === "pdf" ? "PDF" : "Document"}
                <input
                  type="file"
                  accept={
                    draft.type === "image"
                      ? "image/*"
                      : draft.type === "pdf"
                        ? "application/pdf"
                        : ".docx"
                  }
                  onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] || null })}
                />
              </label>
            )}

            <label>
              Allow everybody to read this?
              <select
                value={draft.allow_all ? "yes" : "no"}
                onChange={(event) => setDraft({ ...draft, allow_all: event.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            {!draft.allow_all && (
              <label>
                Authorise (emails, comma-separated)
                <input
                  type="text"
                  value={draft.authorise}
                  placeholder="someone@example.com, another@example.com"
                  onChange={(event) => setDraft({ ...draft, authorise: event.target.value })}
                />
              </label>
            )}

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
