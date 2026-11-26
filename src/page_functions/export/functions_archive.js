/*
  Every function in a community, in one zip.

  This is the archive half of the export set: it lists what was planned, builds one PDF per function
  through the same `buildFunctionPdf` the single-function button uses, and collects the results into a
  zip with a contents file on top. It does not know what a function's rows look like and it does not
  know how a page is laid out — it only knows that a batch of slow jobs has to be run a few at a time
  and that one function failing must not throw away the fifty-nine that worked.

  The contents file is not decoration. An admin who exports sixty functions, deletes them, and finds
  two missing has no way to learn that from the folder alone; `00_contents.txt` says how many were
  asked for, how many came out, and which ones did not and why — the difference between an archive and
  a folder full of files that happen to look complete.
*/

import { ChurchFunctionsFetch } from '../church_functions.js'
import { pretty } from '../table_files.js'
import { buildFunctionPdf } from './function_docs.js'
import { mapLimit } from './pool.js'
import { slug, stamp } from './save.js'
import { zipBlobs } from './zip.js'

const functions = new ChurchFunctionsFetch()

// Three at a time: enough that a sixty-function community does not take a minute per read, few enough
// that the receipts inside them are not competing with fifty-nine other fetches for the same socket.
const CONCURRENCY = 3

// `01_name.pdf`, `02_name.pdf` — ordered the way the register lists them, and unique even when two
// functions were planned under the same name.
function entryName(index, title) {
  const pad = String(index + 1).padStart(2, '0')
  return `functions/${pad}_${slug(title)}.pdf`
}

function contents({ list, results, failures, on }) {
  const lines = [
    `Functions exported on ${on}`,
    `${results.length} of ${list.length} wrote out${failures.length ? `, ${failures.length} did not` : ''}.`,
    '',
  ]
  results.forEach((one) => {
    lines.push(`${String(one.order).padStart(2, '0')}. ${one.title}${one.date ? ` — ${pretty(one.date)}` : ''}`)
  })
  if (failures.length) {
    lines.push('', 'These could not be exported:')
    for (const one of failures) lines.push(`- ${one.title}: ${one.reason}`)
  }
  return lines.join('\n')
}

/*
  The whole archive: read the list, build a PDF per function, zip them, and hand back the blob with the
  counts. `onProgress` sees every finished function, which is what the button counts up from.

  A function whose PDF could not be built is skipped and named in the contents file rather than
  stopping the download: an archive that fails on the nineteenth of sixty leaves the leader with
  nothing at all, which is worse than one that is forty-one short and says so.
*/
export async function buildFunctionsArchive({ community_id }, { onProgress } = {}) {
  if (!community_id) throw new Error('community_id is required')
  const list = (await functions.getFunctions(community_id)) || []
  if (!list.length) throw new Error('This community has no functions to export yet.')

  const built = await mapLimit(
    list,
    CONCURRENCY,
    // The files inside one function are too small a unit to report sixty times over; the function
    // itself is the thing a person is waiting on, so only the batch reports progress.
    (one, index) =>
      buildFunctionPdf({ community_id, function_id: one.id, name: one.name }).then((result) => ({
        name: entryName(index, result.title),
        blob: result.blob,
        title: result.title,
        order: index + 1,
        date: one.function_date,
      })),
    onProgress,
  )

  const results = built.filter((one) => one?.ok).map((one) => one.value)
  const broken = built
    .map((one, index) => (one?.ok ? null : { index, error: one?.error }))
    .filter(Boolean)
  const failures = broken.map(({ index, error }) => ({
    title: list[index]?.name || `function ${list[index]?.id}`,
    reason: error?.message || 'it could not be read',
  }))

  /*
    A zip holding nothing but its own contents page is not an archive, and offering it as one is how a
    person ends up deleting rows they believed they had saved. When not a single function came out, the
    cause is one thing rather than eighteen, and it belongs in the sentence under the button instead of
    in a file nobody opens — so it is raised, not zipped. Partial archives still download, and still name
    what is missing, because forty-one good functions are worth having.

    A library that would not load is rethrown as it came: the flag on it is what earns the button its
    reload link, and rewriting it here would bury the only recovery there is.
  */
  if (!results.length) {
    const stale = broken.find(({ error }) => error?.stale_library)
    if (stale) throw stale.error
    throw new Error(
      failures.length
        ? `None of the ${list.length} functions could be built. ${failures[0].title}: ${failures[0].reason}`
        : `None of the ${list.length} functions could be built.`,
    )
  }

  const entries = [
    { name: '00_contents.txt', blob: new Blob([contents({ list, results, failures, on: stamp() })], { type: 'text/plain' }) },
    ...results,
  ]
  const blob = await zipBlobs(entries)
  return { blob, count: results.length, asked: list.length, failures, total: entries.length }
}
