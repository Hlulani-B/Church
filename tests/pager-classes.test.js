import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
  Why the pagination bar once arrived black.

  `Pager` is dropped onto fifteen different lists and owns none of the stylesheets it lands in, so its
  markup has to be unreachable from them. It used to name its parts with the plainest words available —
  `go`, `say`, `step`, `which` — and in this app `go` is the primary button: `admin/Dashboard.jsx`
  writes `.au .go{background:#111}`, and a dozen files after it write the same black box under another
  page's root class. A descendant selector does not care that the element came from a shared component,
  so the group holding "← Previous / Page 1 of 2 / Next →" inherited a black background, white text and
  twenty pixels of padding, and `session_live.jsx`'s `.sl .say` gave the count line a green border.

  Two rules follow from that, and both are cheap to hold and easy to lose in a rename:
    - everything the control renders is named `kp-`something, a prefix no page uses for its own;
    - no page restyles the control's parts, because a rule for `.kp-step` written anywhere but here is
      the same collision waiting for a different name.
*/

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const PAGER = join(SRC, 'components', 'pager.jsx')

// Files worth reading, which is source rather than anything a build produced.
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((one) => {
    const path = join(dir, one.name)
    if (one.isDirectory()) return one.name === 'node_modules' || one.name === 'dist' ? [] : sources(path)
    return /\.(jsx|css)$/.test(one.name) ? [path] : []
  })
}

const pager = readFileSync(PAGER, 'utf8')

// Class names as the component applies them, and as its own css spells them. Comments come off first:
// the header carries a usage example with the host's own class in it (`tablewrap`), and the selectors
// are read out of the style block rather than out of the whole file, because the prose names other
// pages' classes on purpose and a scanner has not the sense to tell an example from a rule.
const body = pager.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const applied = [...body.matchAll(/className="([^"{]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/))
const sheet = body.match(/const css = `([\s\S]*?)`;/)
const styled = [...(sheet ? sheet[1] : '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1])
const tokens = [...new Set([...applied, ...styled])].filter(Boolean)

describe('pager markup', () => {
  it('knows its own classes, so the rule below is about something', () => {
    // Guards the scanner itself: a rewrite that changes how the names are written should make this
    // fail rather than quietly test an empty list.
    expect(tokens.length).toBeGreaterThan(4)
    expect(tokens).toContain('kp-pg')
  })

  it('names every one of its classes with the kp- prefix', () => {
    // A bare `go`, `say`, `step` or `count` belongs to whichever page is hosting the list, and the
    // page wins the argument by writing it into its own stylesheet.
    expect(tokens.filter((one) => !one.startsWith('kp-'))).toEqual([])
  })
})

describe('other stylesheets', () => {
  const parts = tokens.filter((one) => one !== 'kp-pg')

  it('do not style the pager parts directly', () => {
    // The container may be nudged by a page that needs a different gap; the arrow buttons and the
    // count never may, because that is how a shared control stops being shared.
    const offenders = sources(SRC)
      .filter((path) => path !== PAGER)
      .filter((path) => parts.some((token) => readFileSync(path, 'utf8').includes(`.${token}`)))
      .map((path) => path.slice(ROOT.length))

    expect(offenders).toEqual([])
  })
})
