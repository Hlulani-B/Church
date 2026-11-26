/*
  The two heavy libraries an export pulls in, loaded in one place.

  jsPDF and jszip are imported lazily on purpose: together they are around half a megabyte, and a
  person who never presses a download button should not have carried them to get here. The price of
  that choice is that the fetch happens late — at the moment of the press, which can be twenty minutes
  after the page was opened — and a build names those chunks after their contents. Every redeploy
  renames them and removes the old ones, so a tab left open from before an update asks the server for
  a file that no longer exists and is answered with a 404. "Failed to fetch dynamically imported
  module" is that 404, and it only ever shows up on the export path because the export path is the
  only one that waits this long to load something.

  Nothing in the app can fetch a file the server has thrown away, so the only real recovery is to
  reload the page and let the current html name the current chunks. What belongs here is making that
  recognisable: mark the error so the button can offer the reload, instead of printing a browser
  sentence that no person can act on.
*/

// What the browsers say when a lazy chunk cannot be fetched, in their own words. Chrome, Firefox and
// Safari all phrase it differently, and none of them say "the site was updated".
const STALE_CHUNK =
  /failed to fetch dynamically imported module|error loading dynamically imported module|unable to preload css|importing a module script failed/i

export function isStaleLibrary(error) {
  return STALE_CHUNK.test(String(error?.message || error || ''))
}

/*
  A chunk that will not load, turned into a sentence worth reading. Any other error is handed back
  exactly as it came, because "you are not an admin of this community" is already the app's own
  message and rewriting it would only make it vaguer.

  Exported so the sentence itself can be tested: it is the only part of this file a person ever reads.
*/
export function staleLibraryError(error) {
  if (!isStaleLibrary(error)) return error
  const spoken = new Error(
    'This page was opened before the site was last updated, so the copy of the PDF library it builds '
      + 'with is no longer on the server. Reload the page and press Download again — no record was lost, '
      + 'and nothing was written.',
    { cause: error },
  )
  // The flag is what lets the button offer a reload rather than only state a failure.
  spoken.stale_library = true
  return spoken
}

export async function loadJsPdf() {
  try {
    const { jsPDF } = await import('jspdf')
    return jsPDF
  } catch (error) {
    throw staleLibraryError(error)
  }
}

export async function loadJsZip() {
  try {
    return (await import('jszip')).default
  } catch (error) {
    throw staleLibraryError(error)
  }
}
