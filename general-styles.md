# Kopano — general styles

Everything a frontend needs to know to build a page that looks like it was always part of this app.
Written for an AI or a developer who is about to write markup here and cannot see every other file.

Read the whole thing once. The parts you copy verbatim are **§2 the page shell**, **§12 the starter
template** and **§13 the rules that are easy to break by accident**.

---

## 1. What the stack actually is

| | |
|---|---|
| Framework | React 19, function components only |
| Build | Vite 8 (`npm run dev`, `npm run build`) |
| Routing | `react-router-dom` 7, flat route list in `src/App.jsx` |
| CSS | **None of the usual things.** No Tailwind, no styled-components, no CSS modules, no `.css` imports per page |
| UI library | None. Every control is a plain `<div>`, `<button>`, `<table>` |
| Icons | Inline `<svg>` or an HTML entity (`&larr;` `&times;` `&#9776;` `★`). No icon package |
| Fonts | One Google Fonts `@import`, inside the page's own css string |

`src/index.css` and `src/App.css` are **empty files and stay empty**. Every component carries its own
styles as a template string and renders them with `<style>{css}</style>`. Do not put a rule in a
global stylesheet to fix one page; do not create a new `.css` file for a page.

The mechanism, precisely:

```jsx
const css = `
.au .card{border:1px solid var(--line);border-radius:2px;padding:24px}
`;
// ...
<div className="au">
  <style>{css}</style>
  <div className="card">…</div>
</div>
```

The `<style>` tag is global — the scoping comes from the leading class on every single rule. So:

- **every rule you write must start with the page's scope class.** A bare `.card{…}` leaks into the
  whole app.
- Page scopes in use: `.au` (almost every page), `.st` (admin settings), `.fb` (feedback),
  `.lv` (leave a community), `.kpd` / `.kpx` (the two delete screens), `.kp` (the landing page, which
  is the only dark page).
- Shared components use a **prefix on every class instead of a scope class**: `kp-` (menu, back),
  `kt-` (toast), `lb-` (loading boxes), `kp-pg` / `kp-say` / `kp-go` / `kp-step` / `kp-which`
  (pager), `gd-` (guide modal), `sl-`, `xt-`, `xs-`, `qr`. Two pages already own the words `go`,
  `say`, `main`, `card`, so a reusable component may never name itself with one of them unqualified —
  that is how the pager once inherited a black background from a stylesheet it had never met.
- Two components using the same scope (`.au`) in one document would style each other. That only
  happens in the `tmp-*-preview.html` scratch files; if you build one, rewrite the scope per block
  (`.replaceAll(".au", ".au.leader")`).

---

## 2. The page shell

Every page opens with the same five lines. They are not optional and they are not deduplicated:
`html`, `body` and `#root` are the only global rules the app has, and each page repeats them because
the page has to be able to stand alone.

```jsx
const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au.loading{display:block}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}
`
```

Then the three regions of a page, in this order, as siblings:

```jsx
<div className="au">
  <style>{css}</style>

  <div className="bar">        {/* top bar: menu, wordmark, way back */}
    <div className="menuwrap"><Menu /></div>
    <a className="logo serif" href="/community">Kopano</a>
    <BackToCommunities />      {/* margin-left:auto pushes it right */}
  </div>

  <section className="hero">   {/* optional, see §6 */}
    <div className="inner">…</div>
  </section>

  <main className="main">…</main>
</div>
```

A page with a community behind it renders the header inside `.hero`, not inside `.main`. A page
without one (`/feedback`, `/terms`, the delete screens) puts its heading straight in `.main` or a
`.doc` column.

---

## 3. Tokens

There is no design-token file. These are the values every stylesheet in `src/` uses. Match them
exactly; "close enough" is how an app starts looking like three apps.

### Colour

| Name | Value | Where |
|---|---|---|
| ink | `#111` | all text, all primary buttons, all borders a control takes on focus/selection |
| muted | `#666` | `--muted`, secondary text, `.sub`, table headers, counts |
| body copy | `#333` | long-form paragraphs (`.au p, .au li` on terms-like pages, guide step text) |
| line | `#e3e3e3` | `--line` on dashboards and content pages |
| line (auth/docs) | `#d9d9d9` | `--line` on login, signup, forgot-password, terms, settings |
| line (feedback) | `#d4d4d4` | `--line` on the feedback page and the guide panel |
| input border | `#bdbdbd` | search boxes, `.kp-step`, any field that must look pressable |
| page | `#fff` | the background of everything except the landing page |
| band | `#faf9f7` | the hero when there is no picture |
| panel | `#fafafa` | table headers, `.stat`, `.ask`, `.topic`, hover rows, active star |
| notice | `#f4f4f4` | `.note`, `.error`, menu-hover |
| danger | `#a11111` | destructive text, `.note.bad` left border, `.danger` fill, row-menu items |
| danger tint | `#fbeaea` on `#7a1010` | full-width form error blocks (feedback) |
| yours | `#1f7a3f` | the 4px left border that marks "this row is mine" (prayer topics) |
| disabled | `opacity:.55` (`.5` on feedback) | never a greyed fill — the button keeps its colour and fades |

Dark grounds — used **only** for the login side panel, the `/community` hero band and the landing
page. Never for a page body, never behind a list, never behind a control:

```css
linear-gradient(135deg,#5a5a5a 0%,#2e2e2e 100%)   /* login side */
linear-gradient(135deg,#5a5a5a 0%,#2a2a2a 100%)   /* community hero */
linear-gradient(180deg,#3a3a3a 0,#2a2a2a 100%)    /* landing page */
```

Scrim and shadow:

```css
rgba(17,17,17,.4)                    /* menu scrim   */
rgba(17,17,17,.55)                   /* guide scrim  */
rgba(20,20,20,.5)                    /* modal veil   */
box-shadow:0 1px 3px rgba(17,17,17,.12)    /* button sitting over a photograph */
box-shadow:0 10px 26px rgba(0,0,0,.14)     /* row menu */
box-shadow:0 20px 44px rgba(0,0,0,.28)     /* popup */
box-shadow:0 4px 16px rgba(17,17,17,.2)    /* toast */
```

### Type

```css
serif:  "Playfair Display",Georgia,"Times New Roman",serif   /* weight 500, always via .serif */
sans:   system-ui,-apple-system,"Segoe UI",Arial,sans-serif   /* the default, never declared per element */
mono:   ui-monospace,SFMono-Regular,Menlo,monospace           /* join codes only */
```

Playfair is loaded with `ital,wght@0,500;1,500` only — **normal 500 and italic 500 exist, 700 does
not**. Ask for a heavier weight and the browser fakes it.

The house voice: a heading is **uppercase serif with one word in italic lowercase**. That contrast is
the brand.

```jsx
<h1 className="serif">Welcome <em>back</em></h1>
<h1 className="serif">Care for people <em>before they drift away</em></h1>
```

```css
.au h1 em{text-transform:none;font-style:italic}
```

Scale:

| Element | Size / line-height | Notes |
|---|---|---|
| `h1` page title | `44px / 1.1`, uppercase | dashboards. `40px` on `/community`, `38px` settings & feedback, `36px` terms, `32px` inside a form box. Collapses to `32px` under 860px |
| `h2` popup title | `24–28px` | serif, inside `.pop` and the guide |
| `.sub` | `17px`, `--muted` | the one line under an `h1`. `15px` on settings |
| `.eyebrow` | `13px / 600 / .08em / uppercase`, `--muted` | the role word above an `h1`: `ADMIN`, `Leader`, `Member` |
| `h3` section label | `13px / 600 / .08em / uppercase`, `--muted`, `margin:48px 0 16px` | a list's heading, not a title. `flex` + `gap:10px` so a `.count` sits inline |
| `.stat .n` | `30px` serif | a number |
| `.card .title` | `20px / 500` | |
| body | `15px` | table cells, popups |
| `.note`, `.hint`-ish, meta | `14px` | |
| labels, small caps | `12–13px` | |
| code | `34px / .14em` mono | the join code |

Letter-spacing is only ever `0`, `.06em`, `.08em` or `.14em`. `.08em` + uppercase + 600 + muted *is*
the small-caps label — use it for anything that names a block of data.

### Space, radius, borders

- Spacing ladder: `4 6 8 10 12 14 16 18 20 22 24 28 32 44 48 56 64 72 96`. Nothing else.
- Content measures: `.main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}` —
  **1000px** for leader/member/single-purpose pages, **1400px** for the admin dashboard (its tables
  are wide), **640px** feedback, **680px** terms document, **960px** settings document.
- Radius: **`2px`** for everything. `999px` for pills, count badges, circled step numbers. `50%` for
  avatars and skeleton dots. No 4/8/12px corners anywhere.
- Borders: `1px solid var(--line)`. Emphasis is `1px solid #111` or a `3px`/`4px` left edge, never a
  thicker box.
- A card is `border:1px solid var(--line);border-radius:2px;background:#fff` with `16–24px` padding.
  No shadow. Shadows belong to floating things only (popups, toasts, row menus, buttons over a photo).

---

## 4. Fonts and the hero wave

The dashboards underline a title with a hand-drawn wave rather than a rule. It is a data-URI SVG on
`h1 + .sub::after`, so any page that has an `h1` followed by a `.sub` gets it for free:

```css
.au h1 + .sub::after{content:"";display:block;width:120px;height:14px;margin-top:22px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='14' viewBox='0 0 120 14' fill='none' stroke='%23111' stroke-width='1.2'%3E%3Cpath d='M0 7 Q 5 0 10 7 T 20 7 T 30 7 T 40 7 T 50 7 T 60 7 T 70 7 T 80 7 T 90 7 T 100 7 T 110 7 T 120 7'/%3E%3C/svg%3E") no-repeat}
```

The same path appears as markup on the login side panel, the landing page and the terms document, in
`stroke="#fff"` or `stroke="#111"` at `strokeWidth="1.2"`. Keep the geometry (`Q 5 0 10 7`,
10-unit period, 120 wide); if you need it in a new colour, change the stroke, not the wave.

---

## 5. Components, page-scoped

These names are what the pages already use. Reuse a name that exists rather than inventing a near
synonym, because the next person greps for it.

### Top bar

```css
.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line);position:relative;z-index:10}
.au .bar .logo{font-size:24px;text-decoration:none}
.au .menuwrap{display:flex;align-items:center;position:relative}
```

Order is always **menu, wordmark, … , back**. `BackToCommunities` carries `margin-left:auto`. The
logo links to `/community` from inside a community and to `/login` from the auth screens.

### Title block

```jsx
<p className="eyebrow">Leader</p>
<h1 className="serif">{name}</h1>
<p className="sub">{email}</p>
```

### Links row — the dashboard's ways out

```css
.au .links{display:flex;flex-wrap:wrap;gap:10px;margin:32px 0 0}
.au .links button{background:#ffffff;color:#111;border:1px solid #111;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 1px 3px rgba(17,17,17,.12)}
.au .links button:hover{background:#111;color:#fff}
.au .links button.primary{background:#111;color:#fff}
.au .links button.primary:hover{background:#333;border-color:#333}
```

They are opaque **because they sit on a photograph**; a translucent button there is an unreadable
label. `primary` is the one action that matters today — `Take attendance` on admin and leader,
`Not attending` / `Check in` elsewhere.

### Note / hint

```css
.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}
.au .hint{font-size:13px;color:var(--muted);margin:12px 0 0}
```

A `.note` is what a page says about its own state ("No community was chosen…"). Errors use
`.note.bad`. Server failures go in `.note.bad` or a `.err`/`.fail` line under the field that caused
them — never in an `alert()`.

### Stats

```css
.au .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 20px}
.au .stat{border:1px solid var(--line);border-radius:2px;padding:16px 18px;background:#fafafa}
.au .stat .n{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:30px;line-height:1.1}
.au .stat .l{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-top:4px}
```

Three across, one column under 860px.

### Find box

One box over a list that is already loaded. It filters in memory; it does not re-fetch.

```css
.au .find{margin:0 0 6px}
.au .find input{width:100%;max-width:460px;font:inherit;font-size:16px;color:var(--text);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 14px center;border:1px solid #bdbdbd;border-radius:2px;padding:11px 14px 11px 42px}
.au .find input:focus{outline:none;border-color:#111}
.au .clear{background:none;border:0;padding:0;font:inherit;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:1px solid var(--line)}
.au .clear:hover{color:#111;border-bottom-color:#111}
```

Wire it as `const people = usePager(listed, PER_PAGE, find)` — the third argument is what resets the
page when the list changes.

### Table

```css
.au .tablewrap{border:1px solid var(--line);border-radius:2px;overflow-x:auto;margin-top:14px}
.au table{width:100%;border-collapse:collapse;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--line)}
.au td{padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:middle}
.au tbody tr:last-child td{border-bottom:0}
.au tbody tr:hover td{background:#fafafa}
.au th.last,.au td.last{width:44px;text-align:right;padding-right:0}   /* the ⋯ column */
.au .tally{font-size:14px;color:var(--muted);margin:14px 0 0}
```

`tablewrap` is also the element the pager anchors to: `<div className="tablewrap" id={people.anchorId}>`.

Person cell, avatar, role pill:

```css
.au td .who{display:flex;align-items:center;gap:12px;font-weight:500}
.au .avatar{flex:none;width:34px;height:34px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:15px}
.au .role{display:inline-block;border:1px solid var(--line);padding:2px 10px;font-size:12px;font-weight:600;text-transform:capitalize;background:#fff}
.au .role.leader{border-color:#111}
.au .role.admin{border-color:#111;background:#111;color:#fff}
```

Avatars are **initials on black**, never photographs, and they carry the two letters of a name the
page is allowed to show.

### Card grid

```css
.au .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.au .card{border:1px solid var(--line);border-radius:2px;padding:24px;background:#fff}
.au button.card{display:block;width:100%;text-align:left;font-family:inherit;cursor:pointer;color:var(--text)}
.au button.card:hover{border-color:#111}
.au button.card:focus-visible{outline:2px solid #111;outline-offset:2px}
.au .card .title{display:block;font-size:20px;margin:0 0 6px;font-weight:500}
.au .card .cap{display:block;color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600}
```

A card you click **is a `<button>`**, not a div with an onClick.

### Row menu (⋯)

```css
.au .dotswrap{position:relative;display:inline-block}
.au .dots{background:#fff;border:1px solid transparent;border-radius:2px;width:32px;height:28px;font-size:17px;line-height:1;cursor:pointer;color:#111}
.au .dots:hover,.au .dots.on{border-color:var(--line)}
.au .rowmenu{position:absolute;top:32px;right:0;background:#fff;border:1px solid var(--line);border-radius:2px;box-shadow:0 10px 26px rgba(0,0,0,.14);z-index:12;min-width:170px}
.au .rowmenu button{display:block;width:100%;text-align:left;background:#fff;border:0;padding:11px 14px;font-size:14px;font-family:inherit;cursor:pointer;color:#a11111}
.au .rowmenu button:hover{background:#f4f4f4}
.au .rowmenu button.plain{color:#111}
```

Destructive items are red by default and take `.plain` to stop being red.

### Popup / modal

```css
.au .veil{position:fixed;inset:0;background:rgba(20,20,20,.5);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20}
.au .pop{background:#fff;border-radius:2px;width:100%;max-width:440px;padding:28px;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.au .pop h2{font-size:24px;margin:0 0 12px}
.au .pop p,.au .pop .lead{color:var(--muted);font-size:15px;margin:0 0 10px}
.au .pop .who{color:var(--text);font-weight:600}
.au .pop .fail{color:#a11111;font-size:14px;margin:14px 0 0}
.au .pop .row{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.au .danger{background:#a11111;color:#fff;border:0;border-radius:2px;padding:12px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
```

Buttons go **right-aligned, cancel then act**. Close on Escape (see `menu.jsx`), close on scrim
click, `role="dialog" aria-modal="true"`.

### Forms

```css
.au .field{margin-bottom:16px}
.au label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.au input[type="email"],.au input[type="password"]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:2px;font-size:15px;font-family:inherit;background:#fff;color:var(--text)}
.au input:focus{outline:none;border-color:#111}
.au .btn{width:100%;padding:13px 16px;border-radius:2px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.au .btn.black{background:#111;color:#fff;border:1px solid #111}
.au .btn.outline{background:#fff;color:#111;border:1px solid #111}
.au .btn:disabled{opacity:.55;cursor:not-allowed}
.au .divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:13px;margin:22px 0}
.au .divider::before,.au .divider::after{content:"";flex:1;height:1px;background:var(--line)}
.au .error{background:#f4f4f4;border-left:3px solid #111;padding:10px 14px;font-size:14px;margin-bottom:16px}
```

Three things are non-negotiable on inputs: **`font-family:inherit`** (a form without the page's font
is instantly visible), **`border-radius:2px`**, and **a real `<label htmlFor>`**. In popups the label
is the small-caps form instead (`12px / .08em / uppercase / --muted / 600`).

Checkbox/radio choices that matter (roles) get a card each, not a bare input:

```css
.au .roles label{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--line);border-radius:2px;padding:12px 14px;cursor:pointer;font-size:14px;color:var(--text)}
.au .roles label.on{border-color:#111;box-shadow:inset 0 0 0 1px #111}
.au .roles .what b{font-size:15px;font-weight:600;text-transform:capitalize}
.au .roles .what span{color:var(--muted);font-size:13px;line-height:1.45}
```

Segmented filters are pills:

```css
.au .filter{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0}
.au .filter button{background:#fff;color:#666;border:1px solid var(--line);border-radius:999px;padding:6px 16px;font-size:13px;font-family:inherit;cursor:pointer}
.au .filter button.on{border-color:#111;color:#111;font-weight:600}
```

Textarea entries ("the ask") live in a bordered panel above the list they add to:

```css
.au .ask{border:1px solid var(--line);border-radius:2px;padding:20px 22px;margin:34px 0 0;background:#fafafa}
.au .ask .what{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:21px;font-weight:500;margin:0}
.au .ask .why{color:var(--muted);font-size:14px;margin:8px 0 0}
.au .ask textarea{width:100%;font:inherit;font-size:16px;color:var(--text);background:#fff;border:1px solid #bdbdbd;border-radius:2px;padding:11px 12px;resize:vertical;min-height:96px;margin:16px 0 0}
```

### List row (not a table)

```css
.au .list{display:flex;flex-direction:column;gap:12px;margin-top:14px}
.au .topic{border:1px solid var(--line);border-left:4px solid #111;border-radius:2px;padding:16px 18px;background:#fafafa}
.au .topic.mine{border-left-color:#1f7a3f}
.au .topic .day{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0}
.au .topic .words{font-size:17px;margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.au .topic .foot{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:12px 0 0;font-size:13px;color:var(--muted)}
.au .topic .foot .who{margin-right:auto}
```

`white-space:pre-wrap;overflow-wrap:anywhere` is what keeps a typed paragraph intact without a long
word bursting the card. Any free text a person typed needs it.

### Code display

```css
.au .codebox{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px}
.au .code{font-size:34px;letter-spacing:.14em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:9px 18px;font-size:14px;font-family:inherit;cursor:pointer}
.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:10px 20px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:20px}
.au .go:disabled{opacity:.55;cursor:default}
```

---

## 6. The hero band (a community's picture)

Every dashboard opens on the fellowship's own banner. Three rules make it work and one helper makes
it safe.

```css
.au .hero{background:#faf9f7;background-size:cover;background-position:center;border-bottom:1px solid var(--line)}
.au .hero.picture{position:relative}
.au .hero.picture::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.75) 45%,rgba(255,255,255,.25) 100%)}
.au .hero .inner{position:relative;z-index:1;max-width:1000px;width:100%;margin:0 auto;padding:56px 56px 48px}
```

```jsx
import { heroStyle, pictureUrl } from "../page_functions/picture.js";

<section className={`hero${picture ? " picture" : ""}`} style={heroStyle(picture)}>
  <div className="inner">…</div>
</section>
```

- The band is **the width of the window**; `.hero .inner` carries `.main`'s measure and side padding
  so the words still line up with the page underneath. A photo inside a 1000px box with white either
  side reads as a thumbnail.
- The white wash from the left is what keeps dark text readable over a photograph somebody else
  chose. Never remove it, never lighten it, and never put light text on the picture instead.
- `pictureUrl()` is the only way a stored string becomes an image address. It refuses anything that
  is not `http(s)` and returns `''`, and `heroStyle('')` returns `undefined` so the plain band shows.
  A non-empty value you did not pass through it is a bug.
- A community with nothing saved gets the plain `#faf9f7` band — the same banner minus a photo, not
  an empty frame.

---

## 7. Shared components — import these, do not rebuild them

```jsx
import Menu from "../components/menu.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";
import { pushToast } from "../components/toast.jsx";
```

| Component | Use | Notes |
|---|---|---|
| `<Menu heading items guideRole />` | the slide-over every signed-in page carries | already contains Feedback, Profile, Leave a community, Log out. `items` is `[{ to, label, state }]`. Auto-opens the Guide once per role per browser — do not duplicate that |
| `<BackToCommunities />` | right end of `.bar` on any page about one community | plain `<a href="/community">` |
| `<BackToDashboard role state />` | same corner, when the page came from a dashboard | renders **nothing** if `role` is missing; never guess a dashboard |
| `<LoadingBoxes kind="rows｜cards" count={3} words="Loading…" />` | any list whose first read is outstanding | `count` is clamped to 1–12 |
| `<Pager state={people} noun="people" />` | under every list | `PER_PAGE = 10` everywhere |
| `pushToast({ title, detail, life = 6000, delay = 0 })` | a short confirmation | `<ToastHost />` is already mounted above the router in `App.jsx` |
| `heroStyle / pictureUrl` | any community picture | see §6 |

Pager usage, exactly:

```jsx
const people = usePager(listed, PER_PAGE, find);
// …
<div className="tablewrap" id={people.anchorId}>
  {people.chunk.map((one) => …)}
</div>
<Pager state={people} noun="people" />
```

Paging happens **after** search and sort, never instead of them. Say `Showing 1–10 of 140 people.`,
not "Page 1".


---

## 8. How a page behaves (this is visible in the styles)

The look depends on three conventions, so a new page that skips them looks wrong even with the right
css.

**Loading is a shape, not a spinner.** A list holds `null` until its read lands and `[]` once it is
truly empty. `null` renders `<LoadingBoxes>`; `[]` renders the sentence about nobody being there.

```jsx
{rows === null ? <LoadingBoxes words="Reading the roster…" /> : rows.length === 0 ? <p className="sub">Nobody is listed yet.</p> : <table>…</table>}
```

A blank gap plus "no servings yet" printed a second before the rows arrive is the exact bug this
exists to prevent.

**Fetches fail quietly and cancel on unmount.**

```jsx
useEffect(() => {
  if (!communityId) return;
  let alive = true;
  thing.read(communityId)
    .then((rows) => alive && setRows(rows || []))
    .catch(() => {});            // a banner that will not read is no banner; the notice box is this page's work
  return () => { alive = false };
}, [communityId]);
```

**Auth is observed, never demanded.** `accounts.onChange(user)` sets what the page shows; a null
session is not a sign-out and never throws the reader out — it shows the "we could not read your
session" state.

**Data comes from a class in `src/page_functions/`.** Instantiate one at module scope
(`const communities = new CommunityFetch()`) and call it from effects. Routes are reached through
`callGod`, which picks the door (`/api/self`, `/api/leader`, `/api/admin`) from the action; a page
asks for a thing by name and never builds a URL. The tier is decided by the server — a page cannot
ask for columns it is not owed, which is why a member's banner comes from `memberOf` and not from the
admin `find`.

**Navigation hands its context along.** A community card navigates with
`navigate("/leader-dashboard", { state: { community_id, name, email, role } })`, and
`src/admin/state.js` (`adminState` / `rememberAdmin` / `forgetAdmin`, localStorage key
`kopano.admin`) fills in whatever the link did not carry, so a reload or a bookmark still lands on
the right fellowship. Build a page reading its community from `useLocation().state` through
`adminState`, and pass the same bag back when you go somewhere.

**Only the reader's own email address is ever displayed.** Other people appear by name and role,
never by address.

---

## 9. Responsive

One primary breakpoint at **860px**, plus `1200px and (orientation:landscape)` for the admin
two-column grid, `820px` for the landing page, `640px` for the guide panel and settings, `620px` for
the back link's wording, `520px` for toasts.

```css
@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au .hero .inner{padding:32px 24px 36px}
  .au h1{font-size:32px}
  .au .stats{grid-template-columns:1fr}
  .au td,.au th{font-size:14px;padding:10px 12px}
}
```

- Never introduce a horizontal scroll on the page; tables get `overflow-x:auto` on their wrapper
  instead.
- Grids collapse to `1fr` at the breakpoint. Card grids use `auto-fit/minmax(220px,1fr)` and need no
  media query.
- Long words break inside cards (`overflow-wrap:anywhere`; the settings `h1` uses `word-break:break-word`)
  — a community can be named anything.
- The 860px query is a **block per page**, appended after the rules. Keep it last so it wins.

---

## 10. Motion and accessibility

Motion is rare and short. The whole vocabulary:

```css
transition:opacity .25s ease,transform .25s ease;   /* panels, toasts, guide */
transform:translateX(-100%) → translateX(0)          /* the menu slide-over */
@keyframes lb-slide{0%{background-position:130% 0}100%{background-position:-30% 0}}   /* the only animation */
```

Nothing loops except the loading shimmer, and that honours the user:

```css
@media (prefers-reduced-motion:reduce){ .lb .dot,.lb .cell,.lb .card{animation:none;background:#f2f2f2} }
```

Accessibility requirements already met on every page — keep them met:

- `<style>{css}</style>` never replaces a semantic element. Headings are `h1/h2/h3`, dialogs are
  `role="dialog" aria-modal="true"` with `aria-labelledby`, the loading line is
  `role="status" aria-live="polite"` with the shapes beside it `aria-hidden="true"`, decorative SVG is
  `aria-hidden="true"`.
- Focus is visible: `outline:2px solid #111;outline-offset:2px` on cards and popup inputs, or a
  border change on inputs. Do not write `outline:none` without putting a `:focus` style back.
- Toggle groups are `role="radiogroup"` with `role="radio" aria-checked` children (see the star
  rating and yes/no in `pages/feedback.jsx`).
- Escape closes anything that opens, and the listener is removed on cleanup.
- Contrast is black-on-white or muted-666-on-white. Never grey text below `#666` on white, and never
  dark text over a picture without the §6 wash.

---

## 11. The dark pages (only two of them)

`src/landing.jsx` and, on its left half, `src/pages/login.jsx`. They invert the token set and nothing
else changes:

```css
.fb{--ink:#111;…}                                     /* feedback keeps the light tokens under its own scope */
.kp{--text:#f4f4f4;--muted:#d0d0d0;--line:rgba(255,255,255,.25);background:linear-gradient(180deg,#3a3a3a 0,#2a2a2a 100%);color:var(--text)}
```

- The landing hero is a photo behind `filter:grayscale(1) contrast(1.05)` and a dark wash
  `linear-gradient(90deg,rgba(20,20,20,.88) 0%,rgba(20,20,20,.6) 50%,rgba(20,20,20,.25) 100%)`, with
  `.hero::after` dropping to a flat `rgba(20,20,20,.6)` under 820px.
- Its container is `.kp .wrap{max-width:1100px;margin:0 auto;padding:0 24px}` and sections are
  `padding:88px 0`, separated by `border-top:1px solid var(--line)` rows rather than cards or shadows.
- Buttons on dark are white-on-black: `.kp .btn{background:#fff;color:#111;padding:12px 30px}`, with
  `.outline` as a `1px solid var(--text)` border.
- Everything the reader interacts with after `/login` is on white. Do not make a new dark page.

---

## 12. Starter template

A new page about one community, ready to fill in. Drop it in `src/pages/`, add a kebab-case route in
`src/App.jsx`, and put its entry button in the right dashboard's `.links`.

```jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminState, rememberAdmin } from "../admin/state.js";
import Menu from "../components/menu.jsx";
import BackToCommunities, { BackToDashboard } from "../components/back.jsx";
import LoadingBoxes from "../components/loading_boxes.jsx";
import Pager, { usePager, PER_PAGE } from "../components/pager.jsx";

const PER = PER_PAGE;

const css = `
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&display=swap");

html,body{margin:0;padding:0;background:#fff;display:block;min-width:0}
#root{max-width:none;margin:0;padding:0;text-align:left;width:100%}

.au{--text:#111;--muted:#666;--line:#e3e3e3;min-height:100vh;background:#fff;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.6}
.au *{box-sizing:border-box}
.au a{color:inherit}
.au .serif{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-weight:500}

.au .bar{display:flex;align-items:center;justify-content:flex-start;gap:14px;padding:18px 24px;border-bottom:1px solid var(--line);position:relative;z-index:10}
.au .bar .logo{font-size:24px;text-decoration:none}
.au .menuwrap{display:flex;align-items:center;position:relative}

.au .main{padding:64px 56px 96px;max-width:1000px;width:100%;margin:0 auto}
.au .eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.au h1{font-size:44px;line-height:1.1;margin:0 0 8px;text-transform:uppercase}
.au h1 em{text-transform:none;font-style:italic}
.au .sub{color:var(--muted);margin:0;font-size:17px}
.au h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:48px 0 16px;font-weight:600;display:flex;align-items:center;gap:10px}
.au h3 .count{background:#111;color:#fff;border-radius:999px;font-size:12px;letter-spacing:0;padding:1px 10px}
.au .note{background:#f4f4f4;border-left:3px solid #111;padding:12px 16px;font-size:14px;margin:22px 0 0}
.au .note.bad{border-left-color:#a11111}
.au .hint{font-size:13px;color:var(--muted);margin:12px 0 0}

.au .find{margin:0 0 6px}
.au .find input{width:100%;max-width:460px;font:inherit;font-size:16px;color:var(--text);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 14px center;border:1px solid #bdbdbd;border-radius:2px;padding:11px 14px 11px 42px}
.au .find input:focus{outline:none;border-color:#111}

.au .tablewrap{border:1px solid var(--line);border-radius:2px;overflow-x:auto;margin-top:14px}
.au table{width:100%;border-collapse:collapse;font-size:15px}
.au th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 16px;background:#fafafa;border-bottom:1px solid var(--line)}
.au td{padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:middle}
.au tbody tr:last-child td{border-bottom:0}
.au tbody tr:hover td{background:#fafafa}

.au .go{background:#111;color:#fff;border:0;border-radius:2px;padding:11px 22px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.au .go:disabled{opacity:.55;cursor:default}
.au .ghost{background:#fff;color:#111;border:1px solid var(--line);border-radius:2px;padding:8px 16px;font-size:13px;font-family:inherit;cursor:pointer}

@media (max-width:860px){
  .au .bar{padding:14px 20px}
  .au .main{padding:36px 24px 72px}
  .au h1{font-size:32px}
  .au td,.au th{font-size:14px;padding:10px 12px}
}
`;

export default function NewPage() {
  const navigate = useNavigate();
  const route = useLocation().state;
  const held = adminState({}, route);
  const communityId = held.community_id;

  const [rows, setRows] = useState(null);      // null = still reading, [] = genuinely empty
  const [find, setFind] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    rememberAdmin({ ...held });
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    let alive = true;
    // fetch(communityId)
    //   .then((data) => alive && setRows(data || []))
    //   .catch((e) => alive && setError(e.message));
    return () => { alive = false };
  }, [communityId]);

  const listed = (rows || []).filter((one) =>
    !find.trim() || JSON.stringify(one).toLowerCase().includes(find.trim().toLowerCase()));
  const paged = usePager(listed, PER, find);

  return (
    <div className="au">
      <style>{css}</style>

      <div className="bar">
        <div className="menuwrap"><Menu /></div>
        <a className="logo serif" href="/community">Kopano</a>
        <BackToDashboard role={held.role} state={route} />
        <BackToCommunities />
      </div>

      <main className="main">
        <p className="eyebrow">{held.role || "Community"}</p>
        <h1 className="serif">The <em>new</em> thing</h1>
        <p className="sub">{held.name}</p>

        {!communityId ? (
          <div className="note">No community was chosen, so there is nothing to open here.</div>
        ) : (
          <>
            <h3>Things<span className="count">{listed.length}</span></h3>
            <div className="find">
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Filter…" aria-label="Filter" />
            </div>
            {rows === null ? (
              <LoadingBoxes words="Reading…" />
            ) : (
              <div className="tablewrap" id={paged.anchorId}>
                <table>
                  <thead><tr><th>Name</th></tr></thead>
                  <tbody>{paged.chunk.map((one) => <tr key={one.id}><td>{one.name}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <Pager state={paged} noun="things" />
            {error && <div className="note bad">{error}</div>}
          </>
        )}
      </main>
    </div>
  );
}
```

---

## 13. Rules that are easy to break by accident

1. **Never add a rule to `src/index.css` or `src/App.css`**, and never create a `.css` file for a
   page. Styles live in the component that renders them.
2. **Every rule starts with the scope class** (`.au`, `.st`, `.fb`, `.lv`, …) or with a global
   prefix that no page owns (`kp-`, `kt-`, `lb-`, `gd-`, `sl-`).
3. **White grounds for controls.** A button, a pager, a menu or a table header never gets a dark
   fill just to "make it stand out". Dark is text, borders and the one `primary` action.
4. **`2px` radius.** `999px` for pills. Nothing in between.
5. **`font-family:inherit` on every input, button, textarea and select.**
6. **No `alert()`, no `confirm()`, no `prompt()`.** Confirmations are `.veil`/`.pop` dialogs with the
   buttons right-aligned; results are `.note`, `.note.bad` or a toast.
7. **No new dependencies, no icon or component library, no CSS-in-JS package.** `jspdf`, `jszip`,
   `qrcode.react`, `firebase` and `@supabase/supabase-js` are already there for specific jobs.
8. **No emoji in the interface.** Stars are `★`, arrows are `&larr;`/`&rarr;`, the menu is `&#9776;`,
   closing is `&times;`.
9. **Never show another person's email address.** Names and roles only, unless it is the reader's own.
10. **Never paint a stored string as an image address directly** — `pictureUrl()` first.
11. **Never fetch inside render, and never leave a fetch writing state after unmount** — the `alive`
    flag is not ceremony.
12. **A list over ten rows is paged** with `usePager` + `<Pager>`, `PER_PAGE = 10`, and the wrapper
    carrying `anchorId`.
13. **Comments here are prose that explains why**, written as full sentences above the block they
    cover — e.g. why a radius is declared after the shared block instead of inside it. Match that
    density; do not add comments that restate the code.
14. **Do not rename an existing class to make a new page fit**; add a scoped rule instead. Other
    pages and `tests/pager-classes.test.js` refer to these names.

---

## 14. Check your work before you hand it back

```powershell
npm run build      # must succeed; it currently finishes in about 16s
npx oxlint         # currently 12 warnings and 0 errors — do not add to the 12
npx vitest run     # currently 22 files / 230 tests green
```

To see a page without signing in, the app has a scratch pattern: a root-level `tmp-preview.html` that
loads a `tmp-preview.jsx`, which pulls a real page's stylesheet out of its source with Vite's
`?raw` import (`raw.match(/const css = `([\s\S]*?)`;/)[1]`) and mounts real markup under it. That way
what you measure is the actual cascade rather than a copy. Those files are scratch and are never
committed — nothing in `.gitignore` excludes `tmp-*`, so read `git status` before you stage anything.

---

## 15. Where the reference files are

| Want to see | Read |
|---|---|
| the fullest page (hero, stats, table, row menu, popup, role picker, code box) | `src/admin/Dashboard.jsx` |
| the same at 1000px with a leader's tools | `src/leader/Dashboard.jsx` |
| a member's page, and the hero arriving without an admin read | `src/member/Dashboard.jsx` |
| auth form, split layout, Google button | `src/pages/login.jsx`, `src/pages/create_account.jsx` |
| cards, dark hero band, join popup | `src/pages/community.jsx` |
| a write-above-a-list page with filters and inline editing | `src/pages/prayer_topics.jsx` |
| rating controls, radio groups, a thank-you state | `src/pages/feedback.jsx` |
| long-form document styling | `src/pages/TCs.jsx`, `src/admin/settings.jsx` |
| slide-over, modal, scrim, escape handling | `src/components/menu.jsx`, `src/components/guide.jsx` |
| a control that must look right on five different pages | `src/components/pager.jsx`, `src/components/back.jsx`, `src/components/loading_boxes.jsx`, `src/components/toast.jsx` |
| the only dark page | `src/landing.jsx` |
| route names and how pages receive their community | `src/App.jsx`, `src/admin/state.js` |
