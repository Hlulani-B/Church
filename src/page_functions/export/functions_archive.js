/*
  Every function in a community, in one zip.

  This is the archive half of the export set: it lists what was planned, builds one PDF per function
  through the same `buildFunctionPdf` the single-function button uses, and collects the results into a
  zip with a contents file on top. It does not know what a function's rows look like and it does not
  know how a page is laid out — it only knows that a batch of slow jobs has to be run a few at a time
  and that one function failing must not throw away the fifty-nine that worked.

  A function comes out as a folder, not a loose file, because a register is not the whole record. The
  attachments are the part a page cannot always carry — a pdf receipt and a docx cannot be pasted into a
  PDF at all — so they are written next to the document that names them, as the files themselves. Reading
  the archive off the bucket url is not enough: the point of the download is that it survives the rows
  being deleted, and a link to a file that was removed with them is not a record.

  The contents file is not decoration. An admin who exports sixty functions, deletes them, and finds
  two missing has no way to learn that from the folder alone; `00_contents.txt` says how many were
  asked for, how many came out, which ones did not and why, and how many files sit beside them — the
  difference between an archive and a folder full of files that happen to look complete.
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

// `01`, `02` — the order the register lists them in, carried into every name so an extracted folder
// still reads as a sequence rather than as sixty files a window sorted alphabetically.
const pad = (number) => String(number).padStart(2, '0')

/*
  One function's folder. The number is on the document inside it as well, so a zip pulled out without
  its directories — which is what some phone archive tools do — still pairs every page with the function
  it was built for.
*/
function folderName(index, title) {
  return `functions/${pad(index + 1)}_${slug(title)}`
}

// `01_name.pdf` inside `01_name/` — unique even when two functions were planned under the same name.
function entryName(index, title) {
  return `${folderName(index, title)}/${pad(index + 1)}_${slug(title)}.pdf`
}

/*
  An attachment as it is saved: numbered in the order the document prints it, so `03_…` is the third
  entry under Payment receipts, and carrying the person's name because the bucket renames an upload to
  something like `1704883200123.jpg`, which tells nobody anything once it is sitting in a folder of six
  of them. The name is cut short — the upload keeps its own extension either way, and a path that runs
  past what Windows will extract is worse than a slightly clipped label.
*/
function attachmentName(index, folder, file) {
  const who = slug(file.who).slice(0, 40)
  return `${folder}/attachments/${pad(index + 1)}_${who}__${slug(file.name, 'file')}`
}

function contents({ list, results, failures, files, on }) {
  const lines = [
    `Functions exported on ${on}`,
    `${results.length} of ${list.length} wrote out${failures.length ? `, ${failures.length} did not` : ''}, with ${files} attached file${files === 1 ? '' : 's'} kept alongside them.`,
    '',
    'Every function is a folder of its own: the register as a pdf, then its attachments under',
    'attachments/ as the files themselves — a receipt a page cannot paste is still there in full.',
    'A file that could not be read at all is named in the document that tried to show it.',
    '',
  ]
  results.forEach((one) => {
    const counted = one.files ? ` — ${one.files} file${one.files === 1 ? '' : 's'}` : ''
    lines.push(`${pad(one.order)}. ${one.title}${one.date ? ` — ${pretty(one.date)}` : ''}${counted}`)
  })
  if (failures.length) {
    lines.push('', 'These could not be exported:')
    for (const one of failures) lines.push(`- ${one.title}: ${one.reason}`)
  }
  return lines.join('\n')
}

/*
  The whole archive: read the list, build a folder per function, zip them, and hand back the blob with
  the counts. `onProgress` sees every finished function, which is what the button counts up from.

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
    /*
      The files inside one function are too small a unit to report sixty times over; the function
      itself is the thing a person is waiting on, so only the batch reports progress.

      `files: true` is what makes this a different read from the single-function button: the receipts
      are fetched as whole files rather than only as pictures, and a folder is worth more than the
      document that describes them.
    */
    (one, index) =>
      buildFunctionPdf({ community_id, function_id: one.id, name: one.name, files: true }).then((result) => {
        const folder = folderName(index, result.title)
        const attachments = result.attachments || []
        return {
          title: result.title,
          order: index + 1,
          date: one.function_date,
          files: attachments.length,
          entries: [
            { name: entryName(index, result.title), blob: result.blob },
            ...attachments.map((file, at) => ({ name: attachmentName(at, folder, file), blob: file.blob })),
          ],
        }
      }),
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

  const fileCount = results.reduce((sum, one) => sum + one.files, 0)
  const entries = [
    {
      name: '00_contents.txt',
      blob: new Blob([contents({ list, results, failures, files: fileCount, on: stamp() })], { type: 'text/plain' }),
    },
    ...results.flatMap((one) => one.entries),
  ]
  const blob = await zipBlobs(entries)
  return { blob, count: results.length, asked: list.length, failures, files: fileCount, total: entries.length }
}
