import { describe, expect, it, vi } from 'vitest'

/*
  The two ways an export fails a person quietly, and the fixes for both.

  The first is the one that actually happened on production: jsPDF is imported lazily so that nobody
  pays half a megabyte for a button they never press, which also means it is only fetched when a
  download is clicked. A tab open from before a redeploy names chunks the new build no longer serves,
  the browser answers with a 404, and every function in the community fails for that one reason. The
  message worth showing is "reload the page", not the browser's own words about modules.

  The second is what the archive used to do with that: it wrote a zip containing a single
  `00_contents.txt` reading "0 of 18 wrote out" and handed it over as a finished download. A person
  who believes they have saved their records and then deletes them has been failed by the tool, not
  by the database, so an archive with nothing in it is now an error rather than a file.
*/

const LIST = [
  { id: 1, name: 'Easter Convention', function_date: '2026-04-10' },
  { id: 2, name: "Men's Braai", function_date: '2026-06-20' },
]

vi.mock('../src/page_functions/church_functions.js', () => ({
  ChurchFunctionsFetch: class {
    async getFunctions() {
      return LIST
    }
  },
}))

// What the builders stand in for: the per-function read and render, which is where a missing chunk
// surfaces. Each test hands back the failure it wants the archive to meet.
const build = vi.hoisted(() => ({ current: () => Promise.reject(new Error('the register could not be read')) }))
vi.mock('../src/page_functions/export/function_docs.js', () => ({
  buildFunctionPdf: (one) => build.current(one),
}))

// The error a stale chunk arrives as, built the way the app builds it — so this test reads the same
// sentence a person would read under the button, not a paraphrase of it.
const stale = () =>
  staleLibraryError(
    new Error('Failed to fetch dynamically imported module: https://church.test/assets/jspdf.es.min-DxaD3_aW.js'),
  )

import { buildFunctionsArchive } from '../src/page_functions/export/functions_archive.js'
import { isStaleLibrary, staleLibraryError } from '../src/page_functions/export/libraries.js'

describe('a chunk the last deploy left behind', () => {
  it('recognises what each browser says when a lazy module will not load', () => {
    expect(isStaleLibrary(new Error('Failed to fetch dynamically imported module: https://x/assets/jspdf.es.min-DxaD3_aW.js'))).toBe(true)
    expect(isStaleLibrary(new Error('error loading dynamically imported module: https://x/assets/jspdf.es.min-DxaD3_aW.js'))).toBe(true)
    expect(isStaleLibrary(new Error('Unable to preload CSS for /assets/style.css'))).toBe(true)
  })

  it('leaves an ordinary failure alone, because that sentence is already the app\'s own', () => {
    expect(isStaleLibrary(new Error('You are not an admin of this community.'))).toBe(false)
    expect(isStaleLibrary(undefined)).toBe(false)
    expect(isStaleLibrary('a bare string')).toBe(false)
  })
})

describe('an archive that produced nothing', () => {
  it('refuses to hand over a zip of nothing but its contents page', async () => {
    build.current = () => Promise.reject(new Error('the register could not be read'))
    await expect(buildFunctionsArchive({ community_id: 'c1' })).rejects.toThrow(
      'None of the 2 functions could be built. Easter Convention: the register could not be read',
    )
  })

  it('turns a browser\'s module message into the one instruction that can work', () => {
    const spoken = stale()
    expect(spoken.stale_library).toBe(true)
    expect(spoken.message).toMatch(/Reload the page/)
    // The original 404 stays reachable, because it is what tells a developer which chunk went missing.
    expect(spoken.cause.message).toMatch(/dynamically imported module/)
  })

  it('passes the reload-able error up with its flag intact, so the button can offer the reload', async () => {
    build.current = () => Promise.reject(stale())
    const caught = await buildFunctionsArchive({ community_id: 'c1' }).then(
      () => null,
      (error) => error,
    )
    expect(caught.stale_library).toBe(true)
    expect(caught.message).toMatch(/Reload the page/)
  })

})

describe('the archive still needs a community to talk about', () => {
  it('refuses before it reads anything when no community was chosen', async () => {
    await expect(buildFunctionsArchive({})).rejects.toThrow('community_id is required')
  })
})
