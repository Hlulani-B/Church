import React, { useEffect, useState } from "react";

/*
  The one box that plans a function, carried by the functions page so the four questions a
  leader is asked live here and nowhere else: what the function is called, the day it is held,
  where it is, and whether people have to pay for it.

  The amount is the branch that only opens on a yes. Asked in the same box as a fifth field it
  would be answered with a nought or a stray number, and the table refuses both — a function that
  costs nothing holds no amount at all, and one that costs something holds one above zero. So the
  box asks the payment question first and only then shows the money, and clearing the answer takes
  the field away with what was typed into it.

  A dialog like the create-community box on /community: a wall behind it, Escape and a click
  outside both close it, and the Cancel next to the OK says the same thing in words. Nothing is
  written until OK is pressed, so closing this costs nothing.
*/

const css = `
.cf-veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.cf-pop{background:#fff;border-radius:2px;width:100%;max-width:460px;padding:28px;box-shadow:0 20px 44px rgba(0,0,0,.28);color:#111;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6;box-sizing:border-box}
.cf-pop *{box-sizing:border-box}
.cf-pop h2{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500;font-size:26px;margin:0 0 8px}
.cf-pop .lead{color:#666;font-size:15px;margin:0 0 20px}
.cf-pop label{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600;margin:0 0 6px}
.cf-pop .field{margin:0 0 16px}
.cf-pop input[type=text],.cf-pop input[type=date]{width:100%;border:1px solid #e3e3e3;border-radius:2px;padding:11px 12px;font-size:16px;font-family:inherit;color:#111;background:#fff}
.cf-pop input:focus{outline:2px solid #111;outline-offset:1px}

/* the payment question is a whole answer, not a tick in a corner, so it gets its own row */
.cf-pop .ask{display:flex;align-items:flex-start;gap:10px;border:1px solid #e3e3e3;border-radius:2px;padding:12px 14px;margin:0 0 16px;cursor:pointer}
.cf-pop .ask:hover{border-color:#111}
.cf-pop .ask input{width:18px;height:18px;margin:2px 0 0;accent-color:#111;cursor:pointer}
.cf-pop .ask .q{font-size:15px;color:#111;letter-spacing:0;text-transform:none;font-weight:600;margin:0}
.cf-pop .ask .a{display:block;font-size:13px;color:#666;font-weight:400;letter-spacing:normal;text-transform:none;margin-top:2px}

/* the amount only exists while the answer above is yes, so it is framed as the branch it is */
.cf-pop .money{border-left:3px solid #111;background:#fafafa;padding:14px 16px;margin:0 0 16px}
.cf-pop .money input{width:100%;border:1px solid #bdbdbd;border-radius:2px;padding:11px 12px;font-size:16px;font-family:inherit;color:#111}
.cf-pop .fail{color:#a11111;font-size:14px;margin:0 0 14px}
.cf-pop .row{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}
.cf-pop .ghost{background:#fff;color:#111;border:1px solid #e3e3e3;border-radius:2px;padding:11px 20px;font-size:15px;font-family:inherit;cursor:pointer}
.cf-pop .go{background:#111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.cf-pop .go:disabled{opacity:.55;cursor:default}

@media (max-width:640px){
  .cf-veil{padding:16px}
  .cf-pop{padding:22px 20px}
}
`;

export default function CreateFunction({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /*
    Escape means the same as Cancel, and both are refused while a write is in flight — a box that
    closed itself halfway through would leave a function planned that nobody could see was made.
  */
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  async function submit(event) {
    event.preventDefault();
    const given = name.trim();
    if (!given) {
      setError("Give the function a name first.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Say which day it is held.");
      return;
    }
    /*
      The amount is checked here as well as on the server. Not because this page's word is
      trusted — /api/leader refuses the same three things again — but because a box that came
      back from a write already tried is a worse sentence than one that says the number is
      missing before anything left the browser.
    */
    let price = null;
    if (requiresPayment) {
      price = amount === "" ? NaN : Number(amount);
      if (!Number.isFinite(price) || price <= 0) {
        setError("You said people have to pay, so give the amount they pay.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({
        name: given,
        function_date: date,
        location: location.trim() || null,
        requires_payment: requiresPayment,
        amount: price,
      });
    } catch (createError) {
      setError(createError.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="cf-veil"
      role="dialog"
      aria-modal="true"
      aria-label="Create function"
      onClick={() => !saving && onCancel()}
    >
      <style>{css}</style>
      <div className="cf-pop" onClick={(event) => event.stopPropagation()}>
        <h2>Create Function</h2>
        <p className="lead">
          A function is a gathering this community attends, and it may cost something. Only the
          leaders and admins of it plan one.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="function-name">Function name</label>
            <input
              id="function-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Annual Youth Congress"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="function-date">Date held</label>
            <input
              id="function-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="function-location">Location</label>
            <input
              id="function-location"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Community Hall, Soweto"
              maxLength={160}
            />
          </div>

          <label className="ask" htmlFor="function-payment">
            <input
              id="function-payment"
              type="checkbox"
              checked={requiresPayment}
              onChange={(event) => {
                setRequiresPayment(event.target.checked);
                // Turning the question off empties the answer with it, so a price typed and then
                // abandoned cannot reach the server as a number against a free function.
                if (!event.target.checked) setAmount("");
              }}
            />
            <span>
              <span className="q">Do people have to pay for this function?</span>
              <span className="a">
                {requiresPayment
                  ? "Yes — say how much each person pays below."
                  : "No — nobody is charged, so no amount is kept."}
              </span>
            </span>
          </label>

          {requiresPayment && (
            <div className="money">
              <label htmlFor="function-amount">Amount per person</label>
              <input
                id="function-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          {error && <p className="fail">{error}</p>}

          <div className="row">
            <button className="ghost" type="button" disabled={saving} onClick={onCancel}>
              Cancel
            </button>
            <button className="go" type="submit" disabled={saving}>
              {saving ? "Creating…" : "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
