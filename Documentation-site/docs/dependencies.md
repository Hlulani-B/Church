# Third-party dependencies

Everything the project pulls in from outside this repository, split by where it actually runs.
Versions are the ones `package-lock.json` resolved when this page was written; the ranges in
`package.json` are what a fresh install accepts.

The rule behind the list: **a dependency has to earn its place in the bundle.** Where a job is
small and well-specified — writing an `.xlsx`, drawing a PDF, formatting a date — it is done here
by hand rather than by a package. That is why [File exports](#file-exports) below is a list of
things this project does *not* use.

## The app, in the browser

These are bundled into the JavaScript Vite ships to a phone.

| Package | Version | What it is for | License |
|---|---|---|---|
| `react` | 19.3.1 | Every screen. | MIT |
| `react-dom` | 19.3.1 | Rendering React into the page. | MIT |
| `react-router-dom` | 7.18.5 | The URL → component table in `src/App.jsx`, and nothing else. | MIT |
| `firebase` | 13.3.0 | Sign-in: email/password, Google, password resets, and minting the ID token every request carries. Imported as `firebase/auth` only — no Firestore, no Storage, no Analytics. | Apache-2.0 |
| `@supabase/supabase-js` | 2.119.0 | Two different jobs: the server's data access, and the browser's direct read of `testimony` (see [findings](findings.md), finding 1). | MIT |
| `qrcode.react` | 4.2.0 | The scannable QR on an open check-in, as an inline SVG rather than an image request. | ISC |

There is no state library, no HTTP client, no CSS framework and no date library. Styling is a
`<style>` string per component; the fetch layer is `src/page_functions/god.js` over `fetch()`;
dates go through the platform `Date` and `toLocaleString`.

## The app, at build and test time

Never shipped to a user.

| Package | Version | What it is for | License |
|---|---|---|---|
| `vite` | 8.3.8 | Dev server and build. Two HTML entries, the SPA and `/qr`. | MIT |
| `@vitejs/plugin-react` | 6.3.0 | JSX and fast refresh for Vite. | MIT |
| `vitest` | 5.1.1 | The check-in invariant suite in `tests/`, run against a chainable Supabase mock. | MIT |
| `oxlint` | 1.94.0 | Linting, `npm run lint`. Config is `.oxlintrc.json`. | MIT |
| `@types/react`, `@types/react-dom` | 19.3.x | Editor and type-checking help. The build does not run `tsc`. | MIT |

`vercel dev` is used for the local serverless functions and is provided by the Vercel CLI, which
is installed globally rather than listed here.

## The serverless functions

`api/*.js` and `lib/god.js` run on Vercel. They import **one** package from this repository's
dependency tree — `@supabase/supabase-js`, reused from `src/functions/*` so the browser and the
server speak to Supabase through the same classes.

Everything else is Node's standard library. Notably, token verification uses `node:crypto`
(`createPublicKey`, `verify`, `timingSafeEqual`) against Google's published signing keys rather
than `firebase-admin`: no service account to keep secret, no cold-start payload, and the trust
boundary is eleven lines of readable code instead of a 30 MB dependency. There is no Express, no
body parser, no CORS package and no JWT library.

## The standalone server, under `server/`

That "no Express" is true of the Vercel functions and of nothing else in the repository. `server/`
is a separate Node application with its own `package.json`, its own lockfile and its own
`node_modules`, and it is not imported by `api/*`, `lib/god.js` or the browser bundle — the two
halves of this project reach Supabase through the same product and through entirely different code.

| Package | Version | What it is for | License |
|---|---|---|---|
| `express` | ^5.3.0 | The HTTP layer, and the router-per-feature shape under `server/src/routes/`. | MIT |
| `@supabase/supabase-js` | ^2.119.2 | Its own service-role client, built in `server/src/supabase.js`. | MIT |
| `dotenv` | ^16.4.5 | Reads `server/.env` at boot. | BSD-2-Clause |
| `nodemon` | ^3.1.14 | Dev only — `npm run dev` in that folder. | MIT |

It is deployed by the [`render.yaml`](https://github.com/Hlulani-B/Church/blob/main/render.yaml) at
the repository root — a blueprint, so Render builds and starts that folder from what the file says
rather than from a dashboard form somebody filled in once. Worth saying plainly: the routes
mounted there today are `/health` and `/servings`, and neither asks who is calling — no bearer check,
no role gate, no community gate, none of the tiers `api/*` keeps. Whatever gets mounted there has to
earn that before it is pointed at real people's rows.

## File exports

Both exported formats are written byte by byte in the browser, in
`src/page_functions/table_files.js`, from rows a page function had already read:

- **`.xlsx`** — a zip of six OOXML parts, *stored* rather than deflated, with real date cells so
  Excel and Google Sheets sort and filter the column as a date.
- **`.pdf`** — an A4 table drawn with the two standard PDF fonts (Helvetica, Helvetica-Bold),
  wrapped using the font's own metric table, with the header repeated on every page.

Nothing is uploaded to produce a download and no window is opened. The packages this deliberately
replaces:

| Not used | Would normally be | Why not |
|---|---|---|
| `xlsx` / `exceljs` | Excel writing | ~1 MB for a feature with four or seven columns. |
| `jspdf` / `pdf-lib` / `pdfkit` | PDF writing | Same, and a font gets embedded for glyphs we never print. |
| `file-saver` | Triggering a download | Eleven lines: an `<a download>` and a blob URL. |
| `dayjs` / `date-fns` | Date handling | `Date` and `toLocaleString` cover everything asked of them. |

## The documentation site

| Package | Version | What it is for | License |
|---|---|---|---|
| `mkdocs` | latest 1.x | The static site generator. | Apache-2.0 |
| `mkdocs-material` | 9.8.1 | The theme, pinned in `Documentation-site/requirements.txt`. | MIT (see note) |

`requirements.txt` names only `mkdocs-material`; it drags MkDocs, Markdown, Pygments and the
Material icons font in as its own dependencies, so the versions above are transitive and will move
unless pinned.

!!! note "Material's licence"
    mkdocs-material is MIT for the public edition. The copy that reaches into GitHub's
    registry for the *Insiders* build is a paid licence, and nothing in this project uses
    Insiders-only features. Redistributing the theme is allowed as long as the copyright notice
    travels with it; using it to ship a competing theme is not.

## Loaded at runtime from someone else's server

These are not in the dependency tree; a visitor's browser fetches them, which means they are a
live third-party request and a piece of uptime somebody else controls.

| Resource | Loaded by | Notes |
|---|---|---|
| Google Fonts — `Playfair Display` | Every app page, via `@import` in its CSS | A display face. If fonts.googleapis.com is blocked, the pages fall back to Georgia/serif. |
| Google Fonts — `Inter`, `JetBrains Mono` | The documentation site, via the theme's `font:` block | Same fallback behaviour. |
| Material icon webfont | The documentation site | Pulled in by mkdocs-material for the `:material-…:` glyphs. |
| `mermaid@11` from unpkg | The documentation site, via `extra_javascript` | Renders the check-in activity diagram. |
| Firebase Authentication | The app, over HTTPS | Identity provider; stores the sign-in methods and the refresh tokens. |
| Supabase (Postgres) | App and server, over HTTPS | Every table this project reads or writes. |
| Vercel | App and `api/*` | Hosting, the request TLS terminus, and the `church-juef.vercel.app` origin that the QR payload is built from. |
| Render | The documentation site, and the server under `server/` | Static site built by `Documentation-site/render.yaml`; the Node app built by the root `render.yaml`. |

No analytics, no advertising or social SDKs, and no error-reporting service: a failure reaches the
browser and the Vercel function logs, nowhere else.

## Licensing, in short

The bundled code is MIT, Apache-2.0 or ISC — all permissive, all compatible with shipping this
app privately or publicly. Two things are worth knowing before that changes:

- `firebase` and `mkdocs` are Apache-2.0, which asks that the NOTICE-style attribution travel with
  a distribution; MIT and ISC ask only that their copyright lines survive.
- Nothing here is GPL or AGPL, so linking against this app creates no obligation to publish its
  source.

This is a reading of the manifests, not legal advice.

## Keeping this page true

A dependency added to `package.json` or `requirements.txt` belongs in the table above, in the
section for where it runs. The honest test is the one used to write it: if the bundle grows, say
so and say what it bought.
