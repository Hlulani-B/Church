import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { AdminDashboardFetch } from "../page_functions/admin_dashboard.js";
import { heroStyle, pictureUrl } from "../page_functions/picture.js";
import { isStaleLibrary } from "../page_functions/export/libraries.js";
import AdminMenu from "./menu.jsx";
import BackToCommunities from "../components/back.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import { adminState, rememberAdmin } from "./state.js";

const accounts = new Auth();
const dashboard = new AdminDashboardFetch();

/*
  The two things a fellowship lets its admins say about itself: what it is called, and the picture it
  is shown under.

  This page exists because the community row was otherwise written once — when the group was opened —
  and never read back into a box. A name typed here and a picture chosen here are the only two columns
  /api/admin will carry on an update for a community: the join code is drawn by the server on the
  dashboard, and who opened the fellowship is a record rather than a field, so neither is offered and
  neither can be reached even by a request built by hand.

  The band at the top is the dashboard's own hero, painted here at the same width with the same wash,
  because a picture that has to be saved before you can see what it does is a picture chosen blind.
  What you are looking at is what the dashboard will look like.
*/

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.st{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.st *{box-sizing:border-box}
.st a{color:inherit}
.st .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.st .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line)}
.st .bar .logo{font-size:24px;text-decoration:none}

.st .doc{max-width:960px;margin:0 auto;padding:0 0 96px}
.st .under{padding:36px 32px 0}

/* the same banner the admin dashboard opens with, so the picture is chosen where it will be seen */
.st .hero{background:#faf9f7;background-size:cover;background-position:center;border-bottom:1px solid var(--line)}
.st .hero.picture{position:relative}
.st .hero.picture::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.75) 45%,rgba(255,255,255,.25) 100%)}
.st .hero .inner{position:relative;z-index:1;padding:40px 32px 34px}
.st .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.st h1{font-size:38px;line-height:1.12;margin:0;text-transform:uppercase;word-break:break-word}
.st h1 + .sub{margin-top:8px}
.st .sub{color:var(--muted);font-size:15px;margin:0}

.st h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:40px 0 10px}
.st label{display:block;font-size:15px;font-weight:600;margin:0 0 6px}
.st .text{width:100%;max-width:520px;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font:inherit;font-size:16px;background:#fff;color:var(--text)}
.st .text:focus{outline:none;border-color:#111}
.st .file{font:inherit;font-size:14px;color:var(--text);padding:10px 12px;border:1px solid var(--line);border-radius:2px;background:#fff}
.st .hint{font-size:13px;color:var(--muted);margin:8px 0 0;max-width:600px}

.st .btn{padding:11px 20px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:#111;color:#fff;border:1px solid #111}
.st .btn.outline{background:#fff;color:#111}
.st .btn:disabled{opacity:.55;cursor:not-allowed}
.st .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
.st .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:26px 0 0}
.st .note.bad{border-left-color:#a11111}

@media (max-width:640px){
  .st .under{padding:26px 20px 0}
  .st .hero .inner{padding:28px 20px 26px}
  .st h1{font-size:28px}
}
`;

export default function CommunitySettingsPage() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const [signedIn, setSignedIn] = useState(null);
  const [noSession, setNoSession] = useState(false);
  const [row, setRow] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [picture, setPicture] = useState("");
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState("");
  const [paste, setPaste] = useState("");
  /*
    The object address of whatever file is waiting to be uploaded. It lives in a ref rather than in
    state because it is not something the page renders — it is the handle that has to be revoked
    before the next one is made and when the screen goes away, and an address nobody revokes is a
    copy of a photograph the browser holds on to for the rest of the session.
  */
  const waiting = useRef(null);
  /*
    The file box itself, so that putting a picture aside can empty it. A browser keeps whatever name a
    person picked showing in that box, so a cleared preview standing under a box still naming
    `hall.jpg` would be a page saying two different things — and picking the same file again would
    never fire a change at all.
  */
  const fileBox = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const admin = adminState({ email: signedIn?.email }, route);
  const communityId = admin.community_id;

  /*
    Firebase Storage is read off the disk only when a picture is actually being saved. The library
    behind it is carried by nobody who opens a fellowship, changes a name or takes attendance, and
    pressing Save is the one moment its two functions are needed — so it arrives with the click, the
    same way the leaflet map arrives when a check-in asks where the room was.
  */
  async function storage() {
    try {
      return await import("../page_functions/storage.js");
    } catch (error) {
      if (!isStaleLibrary(error)) throw error;
      throw new Error(
        "This page was opened before the site was last updated, so the copy of the picture uploader it "
          + "builds with is no longer on the server. Reload the page and press Save again — nothing was changed.",
      );
    }
  }

  useEffect(() => {
    return accounts.onChange((user) => {
      setSignedIn(user || null);
      setNoSession(!user);
    });
  }, []);

  /*
    The row is read rather than trusted to what the link carried, so a name changed on another device
    shows here before anything is typed over it. `picture` is checked on the way in — a value that is
    not an address is no picture, and the same rule the dashboard paints by.
  */
  const email = signedIn?.email || "";
  useEffect(() => {
    if (!email || !communityId) return;
    dashboard
      .getCommunity(communityId)
      .then((one) => {
        setRow(one);
        setName(one?.name || "");
        setPicture(pictureUrl(one?.picture));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [communityId, email]);

  useEffect(() => {
    if (!row?.name) return;
    rememberAdmin({ community_id: communityId, name: row.name, email });
  }, [communityId, row, email]);

  /*
    A chosen file is shown from an address the page makes for itself, so the band changes the moment a
    photo is picked and not only after it has been uploaded. The old address is revoked in the same
    breath, because the file it stood for is not being shown any more.
  */
  function choose(event) {
    const picked = event.target.files?.[0] || null;
    if (waiting.current) URL.revokeObjectURL(waiting.current);
    waiting.current = picked ? URL.createObjectURL(picked) : null;
    setFile(picked);
    setDraft(waiting.current || "");
    setError("");
  }

  /* Nothing else ever takes the waiting file back out, so this is the last chance to release it. */
  useEffect(
    () => () => {
      if (waiting.current) URL.revokeObjectURL(waiting.current);
    },
    [],
  );

  function setAside() {
    if (waiting.current) URL.revokeObjectURL(waiting.current);
    waiting.current = null;
    setFile(null);
    setDraft("");
    if (fileBox.current) fileBox.current.value = "";
  }

  const shown = row?.community_id === communityId ? row : null;
  const stored = shown?.picture || "";
  /*
    What the band paints: the file waiting to be uploaded if there is one, and otherwise the address
    that is saved. A waiting file is shown from an object address this page made for itself, which is
    why it goes straight to the style — `pictureUrl` is for what comes out of the row, and a blob
    address is not something a community should ever be stored as.
  */
  const preview = draft ? { backgroundImage: `url("${draft}")` } : heroStyle(picture);
  const showing = Boolean(draft || picture);
  const dirty =
    name.trim() !== (shown?.name || "") || picture !== stored || Boolean(file);
  const canSave = Boolean(shown) && !busy && dirty && Boolean(name.trim());

  /*
    A pasted address is taken as the picture, which is how a fellowship points at a photo it already
    hosts somewhere. It is checked here rather than saved and refused later: the band is showing what
    the box holds, so a value that cannot paint should say so at the box.
  */
  function attach() {
    const address = pictureUrl(paste);
    if (!address) {
      setError("That is not a picture address. It has to start with http:// or https://");
      return;
    }
    setError("");
    setPicture(address);
    setPaste("");
    setAside();
  }

  function clear() {
    setPicture("");
    setAside();
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    const previous = stored;
    try {
      const { dropCommunityPicture, uploadCommunityPicture } = await storage();
      // The file goes to Firebase Storage first: a row should never hold an address with no object behind it.
      const fresh = file
        ? await uploadCommunityPicture({ file, community_id: communityId })
        : null;
      const address = fresh ? fresh.url : picture;
      const rowNow = await dashboard.saveCommunity(communityId, {
        name: name.trim(),
        picture: address || "",
      });
      const next = pictureUrl(rowNow?.picture) || address;
      setRow(rowNow);
      setName(rowNow?.name || name.trim());
      setPicture(next);
      setAside();
      setPaste("");
      rememberAdmin({ community_id: communityId, name: rowNow?.name || name.trim(), email });
      setSaved(`Saved. ${rowNow?.name || name.trim()} opens with this banner now.`);
      /*
        Only now: the row has the new address, so the file the old one pointed at is nobody's picture
        any more. This covers taking the picture away as well as replacing it, because the object
        behind a removed one is the one thing nobody will ever load again. A link this app did not
        write — a seeded photograph, an address typed in by hand — is left exactly where it is, since
        this project does not own it, and `dropCommunityPicture` says so by doing nothing.
      */
      if (previous && previous !== next) await dropCommunityPicture(previous);
      return true;
    } catch (e) {
      setError(e.message || "Nothing was changed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="st">
        <style>{css}</style>
        <div className="doc">
          <div className="under">
            {noSession ? (
              <p className="sub">
                This browser holds no saved session, so there is nothing to change here.{" "}
                <a href="/login">Log in</a>
              </p>
            ) : (
              <p className="sub">Checking your sign-in…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!communityId) {
    return (
      <div className="st">
        <style>{css}</style>
        <div className="doc">
          <div className="under">
            <h2>Community settings</h2>
            <p className="sub">
              This screen changes one fellowship, so it needs to know which one.{" "}
              <a href="/community">Go to your communities</a> and open it from there.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded && !shown) {
    return (
      <div className="st">
        <style>{css}</style>
        <LoadingBoxes count={1} words="Reading this community…" />
      </div>
    );
  }

  return (
    <div className="st">
      <style>{css}</style>

      <div className="bar">
        <AdminMenu state={admin} />
        <a className="logo serif" href="/community">Kopano</a>
        <BackToCommunities />
      </div>

      <div className="doc">
        <section className={`hero${showing ? " picture" : ""}`} style={preview}>
          <div className="inner">
            <p className="eyebrow">Community settings</p>
            <h1 className="serif">{name.trim() || "This community"}</h1>
            <p className="sub">
              {showing
                ? "This is the banner your dashboard opens with."
                : "No picture yet, so the dashboard shows this band plain."}
            </p>
          </div>
        </section>

        <div className="under">
          <h2>What it is called</h2>
          <label htmlFor="community-name">Community name</label>
          <input
            className="text"
            id="community-name"
            type="text"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="hint">
            Every screen in the fellowship takes its name from this, so use the words your people
            already use for it.
          </p>

          <h2>How it looks</h2>
          <label htmlFor="community-file">Picture</label>
          <input
            className="file"
            id="community-file"
            ref={fileBox}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={choose}
          />
          <p className="hint">
            A JPEG, PNG or WebP up to 12 MB. The wide part is what shows, so pick something that
            still says something with its left side covered in white. It is stored in this project's
            Firebase Storage and the dashboard keeps only the address.
          </p>
          <div className="row">
            {file && (
              <button className="btn outline" type="button" onClick={setAside}>
                Leave {file.name} out
              </button>
            )}
            {(picture || file) && (
              <button className="btn outline" type="button" onClick={clear}>
                Remove the picture
              </button>
            )}
          </div>

          <h2>Or point at a picture you already have</h2>
          <label htmlFor="community-url">Address</label>
          <input
            className="text"
            id="community-url"
            type="text"
            placeholder="https://…"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
          <div className="row">
            <button className="btn outline" type="button" onClick={attach} disabled={!paste.trim()}>
              Use this address
            </button>
          </div>

          <form onSubmit={save}>
            <div className="row">
              <button className="btn" type="submit" disabled={!canSave}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button className="btn outline" type="button" onClick={() => navigate("/admin-dashboard", { state: admin })}>
                Back to the dashboard
              </button>
            </div>
          </form>

          {error && <div className="note bad">{error}</div>}
          {saved && !error && <div className="note">{saved}</div>}
          {shown && !dirty && !saved && !error && (
            <div className="note">Nothing here has changed since it was saved.</div>
          )}
        </div>
      </div>
    </div>
  );
}
