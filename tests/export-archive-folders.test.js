import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
  What the functions zip is shaped like.

  An archive of only PDFs is an archive of the register and nothing else, and the register is the half
  people already have. The attachments are the fragile half: a receipt that is a pdf or a docx cannot be
  pasted into a page at all, so it used to survive the export as a printed url — which stops working the
  moment the rows behind it are deleted, which is precisely why the download was taken.

  So the shape is worth a test on its own: a folder per function, the document inside it, the files under
  `attachments/` in the order the document lists them, and a contents page that counts them.
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

// The per-function build, stood in for: what comes back is a document plus the files that go with it.
const build = vi.hoisted(() => ({ current: () => Promise.resolve({}) }))
vi.mock('../src/page_functions/export/function_docs.js', () => ({
  buildFunctionPdf: (one) => build.current(one),
}))

// The zip step is jszip's job, not this one. Capturing the entries is the whole test; a real archive is
// bytes nobody can assert on without unpacking it.
const zipped = vi.hoisted(() => ({ entries: [] }))
vi.mock('../src/page_functions/export/zip.js', () => ({
  zipBlobs: (entries) => {
    zipped.entries = entries
    return Promise.resolve(new Blob(['zip']))
  },
}))

import { buildFunctionsArchive } from '../src/page_functions/export/functions_archive.js'

const file = (who, name) => ({ who, name, blob: new Blob([name]) })
const names = () => zipped.entries.map((one) => one.name)
const contents = () => zipped.entries[0].blob

beforeEach(() => {
  zipped.entries = []
  build.current = () => Promise.resolve({ title: 'unused', blob: new Blob(['pdf']), attachments: [] })
})

describe('one folder per function', () => {
  it('puts the document and its attachments in a folder named after the function', async () => {
    build.current = ({ function_id }) =>
      Promise.resolve({
        title: function_id === 1 ? 'Easter Convention' : "Men's Braai",
        blob: new Blob(['pdf']),
        attachments: function_id === 1 ? [file('Nomsa Dube', 'receipt.pdf'), file('Sipho Zulu', 'deposit.jpg')] : [],
      })

    await buildFunctionsArchive({ community_id: 'c1' })

    expect(names()).toEqual([
      '00_contents.txt',
      'functions/01_Easter Convention/01_Easter Convention.pdf',
      'functions/01_Easter Convention/attachments/01_Nomsa Dube__receipt.pdf',
      'functions/01_Easter Convention/attachments/02_Sipho Zulu__deposit.jpg',
      "functions/02_Men's Braai/02_Men's Braai.pdf",
    ])
  })

  /*
    The builder only hands over files when the caller said it is building a folder — a single-function
    download has nowhere to put them and would hold a hundred receipts in memory to throw them away. This
    is the wire between the two files, and nothing fails loudly if it is ever dropped.
  */
  it('asks the builder for the files as well as the document', async () => {
    const seen = []
    build.current = (args) => {
      seen.push(args)
      return Promise.resolve({ title: 'Easter Convention', blob: new Blob(['pdf']), attachments: [] })
    }
    await buildFunctionsArchive({ community_id: 'c1' })
    expect(seen.every((one) => one.files === true)).toBe(true)
  })

  it('reports how many files it carried, so the button can say so too', async () => {
    build.current = () =>
      Promise.resolve({
        title: 'Easter Convention',
        blob: new Blob(['pdf']),
        attachments: [file('Nomsa Dube', 'a.pdf'), file('Peter Botha', 'b.docx')],
      })
    const archive = await buildFunctionsArchive({ community_id: 'c1' })
    expect(archive.files).toBe(4) // two of each of the two functions
    expect(archive.count).toBe(2)
  })
})

describe('the contents page', () => {
  it('says what the folder layout is and counts the files in it', async () => {
    build.current = () =>
      Promise.resolve({ title: 'Easter Convention', blob: new Blob(['pdf']), attachments: [file('Nomsa Dube', 'receipt.pdf')] })

    await buildFunctionsArchive({ community_id: 'c1' })
    const said = await contents().text()

    expect(said).toContain('2 of 2 wrote out, with 2 attached files kept alongside them.')
    expect(said).toContain('Every function is a folder of its own')
    expect(said).toContain('01. Easter Convention — 10 April 2026 — 1 file')
  })

  it('still names a function that did not come out, and zips the ones that did', async () => {
    build.current = ({ function_id }) =>
      function_id === 1
        ? Promise.resolve({ title: 'Easter Convention', blob: new Blob(['pdf']), attachments: [] })
        : Promise.reject(new Error('the register could not be read'))

    const archive = await buildFunctionsArchive({ community_id: 'c1' })
    const said = await contents().text()

    expect(archive.count).toBe(1)
    expect(archive.failures).toHaveLength(1)
    expect(names()).toContain('functions/01_Easter Convention/01_Easter Convention.pdf')
    expect(said).toContain('1 of 2 wrote out, 1 did not')
    expect(said).toContain("- Men's Braai: the register could not be read")
  })
})
