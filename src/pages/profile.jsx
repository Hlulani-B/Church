import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../functions/auth.js";
import { UserFetch } from "../page_functions/user.js";
import Menu from "../components/menu.jsx";

const accounts = new Auth();
const users = new UserFetch();

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#d9d9d9;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:1px solid var(--line);font-size:14px}
.au .bar .logo{font-size:22px;text-decoration:none}

.au .doc{max-width:680px;margin:0 auto;padding:56px 24px 80px}
.au h1{font-size:36px;line-height:1.2;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au p{color:#333;margin:0 0 12px}
.au .sub{color:var(--muted)}

.au .field{margin:28px 0 16px}
.au label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.au input[type="text"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.au input[type="text"]:focus{outline:none;border-color:#111}
.au .email{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;background:#f4f4f4;color:var(--muted)}
.au .hint{font-size:13px;color:var(--muted);margin:6px 0 0}

.au .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:#111;color:#fff;border:1px solid #111}
.au .btn:disabled{opacity:.55;cursor:not-allowed}
.au .error,.au .saved{border-left:3px solid #111;padding:10px 14px;font-size:14px;margin:20px 0 0}
.au .saved{background:#f4f4f4}
.au .error{background:#f4f4f4;border-left-color:#111}
`;

export default function ProfilePage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(null);
  const [member, setMember] = useState(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    return accounts.onChange((user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      setSignedIn(user);
      users.find()
        .then((row) => {
          setMember(row);
          if (row) {
            setName(row.name || "");
            setSurname(row.surname || "");
          }
        })
        .catch((fetchError) => setError(fetchError.message));
    });
  }, [navigate]);

  const dirty = name !== (member?.name || "") || surname !== (member?.surname || "");
  const canSave = Boolean(member) && !busy && dirty && name.trim() && surname.trim();

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const row = await users.update({ name, surname });
      setMember(row);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="au">
        <style>{css}</style>
        <article className="doc">
          <p className="sub">Checking your sign-in…</p>
        </article>
      </div>
    );
  }

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <a className="logo serif" href="/community">Kopano</a>
        <Menu />
      </div>

      <article className="doc">
        <h1 className="serif">Your <em>profile</em></h1>
        <p className="sub">Only your name and surname are yours to change.</p>

        {error && <div className="error">{error}</div>}
        {!member && !error && (
          <div className="error">
            No member row for {signedIn.email} yet, so there is nothing to edit.
          </div>
        )}

        {member && (
          <form onSubmit={save}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                required
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="surname">Surname</label>
              <input
                id="surname"
                type="text"
                required
                autoComplete="family-name"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="email" id="email" type="text" value={member.email} readOnly />
              <p className="hint">
                Your email address is how your attendance and testimonies are linked to you, so
                it cannot be changed here. Ask a leader if it is wrong.
              </p>
            </div>

            <button className="btn" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : "Save changes"}
            </button>

            {saved && <div className="saved">Saved.</div>}
          </form>
        )}
      </article>
    </div>
  );
}
