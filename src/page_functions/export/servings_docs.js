/*
  A community's servings on paper.

  Two registers make the page up: the members who serve, read from the `servings` table, and the extra
  members — the people who never joined the app — read from `extra_servings` beside them. This builds
  one document out of both, and it is the document an admin wants before a person is taken out of a
  community or a serving row is cleared: once the row is gone there is no way to answer who was doing
  the ushering that month.

  Servings hold no files. A row is a person and a free word for what they do, so unlike a function's
  export there are no receipts to paste and no paths to print — the whole archive is one readable page.
  Where a serving is listed against an address the roster no longer answers, the document says the name
  is missing rather than printing an address in its place, which is the rule the screen follows.
*/

import extra from '../extra.js'
import servings from '../servings.js'
import { moment } from '../table_files.js'
import { renderPdf } from './pdf.js'

const NO_ROLE = 'no role was written down'

// A person from the roster, in the two cells the screen gives them.
function member(one) {
  const name = String(one.name || '').trim()
  return [name || 'a name this fellowship has not got', String(one.surname || '').trim() || '—']
}

// Whose extra serving this is, read off the joined extra member the server returns.
function extraName(one) {
  return `${one.extra_members?.name ?? ''} ${one.extra_members?.surname ?? ''}`.trim() || 'an extra member'
}

// A tally of the roles, so a printed page answers "how is this fellowship staffed" without counting rows.
function tally(rows, read) {
  const counts = new Map()
  for (const one of rows) {
    const role = String(read(one) || '').trim() || NO_ROLE
    counts.set(role, (counts.get(role) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => `${role} × ${count}`)
}

export function servingsSpec({ roles = [], extras = [], community, community_name }) {
  return {
    title: 'Servings',
    subtitle: community_name ? `${community_name}, the people who serve` : 'The people who serve',
    meta: [
      { label: 'Members serving', value: `${roles.length}` },
      { label: 'Extra members serving', value: `${extras.length}` },
      { label: 'Community', value: community || '' },
      { label: 'Archived on', value: moment(new Date().toISOString()) },
    ],
    sections: [
      {
        heading: 'Who serves, and what they do',
        note: roles.length ? `Roles held: ${tally(roles, (one) => one.role).join(', ')}.` : undefined,
        table: {
          columns: ['Name', 'Surname', 'Role'],
          rows: roles.map((one) => [...member(one), String(one.role || '').trim() || NO_ROLE]),
        },
        empty: 'Nobody is listed under servings for this community yet.',
      },
      {
        heading: 'Extra members serving',
        note: 'The people who never joined the app, listed on their behalf by a leader or an admin.',
        table: {
          columns: ['Who', 'Role'],
          rows: extras.map((one) => [extraName(one), String(one.role || '').trim() || NO_ROLE]),
        },
        empty: 'No extra member holds a serving in this community.',
      },
    ],
    footer: 'Servings, as recorded on the day this was exported',
  }
}

/*
  The whole page as one PDF: both registers read the way the screen reads them, then drawn. `extras` is
  allowed to fail — an admin whose community has no extra members has nothing on that half, and the
  document should still come out with the members' half on it.
*/
export async function buildServingsPdf({ community_id, community_name }) {
  if (!community_id) throw new Error('community_id is required')
  const [roles, extras] = await Promise.all([
    servings.getRoles(community_id),
    extra.getServings(community_id).catch(() => []),
  ])
  if (!(roles || []).length && !(extras || []).length) {
    throw new Error('This community has no servings to export yet.')
  }
  const spec = servingsSpec({ roles: roles || [], extras: extras || [], community: community_id, community_name })
  return { spec, blob: await renderPdf(spec) }
}
