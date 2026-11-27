import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFilePath, kindOf, loadAttachment, nameOf } from '../src/page_functions/export/attachments.js'
import { functionSpec, receiptFiles } from '../src/page_functions/export/function_docs.js'
import { servingsSpec } from '../src/page_functions/export/servings_docs.js'
import { testimoniesSpec } from '../src/page_functions/export/testimony_docs.js'
import { mapLimit, ratio } from '../src/page_functions/export/pool.js'
import { foldValue } from '../src/page_functions/export/pdf.js'
import { slug, stamp } from '../src/page_functions/export/save.js'

/*
  The export set's invariants. These files exist so a leader can delete rows and still read what they
  said, which makes two things worth locking down harder than the layout: an archive must never print an
  address (the fellowship's rule is that a person is a name, and a saved PDF is the one thing that leaves
  a room), and a file that could not be read must still say where it was rather than vanish.

  Nothing here renders a page or touches the DOM. `saveBlob` and the browser's image canvas are
  deliberately untested — they are the parts that only exist inside a browser.
*/

const detail = (over = {}) => ({
  function: {
    id: 7,
    name: 'Year End Gathering',
    function_date: '2026-12-05',
    location: 'Hall',
    requires_payment: true,
    amount: 150,
    created_by: 'planner@church.org',
    created_at: '2026-11-01T09:00:00Z',
    ...(over.function || {}),
  },
  planned_by: 'Grace Mokoena',
  people: [
    {
      email: 'one@church.org',
      label: 'Nomsa Dube',
      attending: true,
      paid: true,
      expected_pay_date: null,
      proof_path: 'https://bucket.test/kopano/receipts/one.pdf',
      proof_submitted_at: '2026-11-02T09:00:00Z',
      confirmed_by: 'leader@church.org',
      confirmed_by_label: 'Peter Botha',
      confirmed_at: '2026-11-03T09:00:00Z',
    },
    {
      email: 'two@church.org',
      label: 'two@church.org', // what every read falls back to when the users table has no name
      attending: false,
      paid: false,
      expected_pay_date: '2026-12-01',
      proof_path: null,
      proof_submitted_at: null,
      confirmed_by: null,
      confirmed_by_label: null,
      confirmed_at: null,
    },
  ],
  ...over,
})

// What the whole document says, as one string: the only way to test "no address appears anywhere".
function spoken(spec) {
  return JSON.stringify(spec)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the naming helpers', () => {
  it('slug turns a typed title into something a filesystem accepts', () => {
    expect(slug('Week of Prayer / 2026: "Revival"')).toBe('Week of Prayer - 2026- -Revival-')
    expect(slug('   ')).toBe('export')
    expect(slug(undefined, 'fallback')).toBe('fallback')
    expect(slug('../../etc/passwd')).toBe('-..-etc-passwd')
    expect(slug('a'.repeat(200))).toHaveLength(90)
  })

  it('stamp is the day a person reads, not a moment they have to parse', () => {
    expect(stamp(new Date(2026, 10, 26))).toBe('2026-11-26')
    expect(stamp(new Date(2026, 0, 4))).toBe('2026-01-04')
  })

  it('reads a stored url for what it is', () => {
    expect(kindOf('https://x.test/a/b/photo.JPG')).toBe('image')
    expect(kindOf('https://x.test/a/b/receipt.pdf?token=1')).toBe('pdf')
    expect(kindOf('https://x.test/a/b/notes.docx')).toBe('other')
    expect(kindOf('')).toBe('other')
    expect(nameOf('https://x.test/a/b/photo%20one.png?token=1')).toBe('photo one.png')
    expect(nameOf('')).toBe('file')
    expect(isFilePath('enc:v1:abcd')).toBe(false)
    expect(isFilePath('https://x.test/a.png')).toBe(true)
    expect(isFilePath(null)).toBe(false)
  })
})

describe('foldValue — what the standard fonts can still draw', () => {
  // jsPDF writes a run containing one character outside cp1252 as UTF-16 while telling the font the
  // bytes are WinAnsi, so the whole line prints as junk. The fold has to catch that character without
  // spending a real accent to do it.
  it('leaves the letters the encoding has room for exactly as they were typed', () => {
    expect(foldValue('André Üsa')).toBe('André Üsa')
    expect(foldValue('¼ cup × 3 · Kopano')).toBe('¼ cup × 3 · Kopano')
  })

  it('turns the characters there is no byte for into the nearest one there is', () => {
    expect(foldValue('“Revival”')).toBe('\u0093Revival\u0094')
    expect(foldValue('Nomsa 中 Dube')).toBe('Nomsa ? Dube')
    expect(foldValue('Mḽankana')).toBe('Mlankana')
    // The accent survives sitting next to a character that had to be folded.
    expect(foldValue('André 中')).toBe('André ?')
  })

  it('folds a row of cells and leaves what is not a string alone', () => {
    expect(foldValue(['André', '中', 7, null])).toEqual(['André', '?', 7, null])
    expect(foldValue(null)).toBe(null)
    expect(foldValue(0)).toBe(0)
  })

  it('keeps the breaks a line is made of and drops what the font has no glyph for', () => {
    const asItStands = 'two' + String.fromCharCode(10) + 'lines' + String.fromCharCode(9) + 'tab'
    expect(foldValue(asItStands)).toBe(asItStands)
    expect(foldValue('Nomsa' + String.fromCharCode(1) + 'Dube')).toBe('NomsaDube')
    expect(foldValue('Nomsa' + String.fromCharCode(127) + 'Dube')).toBe('NomsaDube')
  })
})

describe('mapLimit — a batch that must not cancel itself', () => {
  it('keeps the input order even when the jobs finish out of it', async () => {
    const waits = [40, 0, 20, 10]
    const out = await mapLimit(waits, 2, async (ms, index) => {
      await new Promise((done) => setTimeout(done, ms))
      return index
    })
    expect(out.map((one) => one.value)).toEqual([0, 1, 2, 3])
  })

  it('writes a failure into its own slot and finishes the rest', async () => {
    const out = await mapLimit([1, 2, 3, 4], 2, async (one) => {
      if (one === 2) throw new Error('the receipt would not load')
      return one * 10
    })
    expect(out[1].ok).toBe(false)
    expect(out[1].error.message).toBe('the receipt would not load')
    expect(out.filter((one) => one.ok).map((one) => one.value)).toEqual([10, 30, 40])
  })

  it('never runs more than the limit at once, and counts every finished item', async () => {
    let live = 0
    let peak = 0
    const seen = []
    await mapLimit(
      Array.from({ length: 9 }, (one, index) => index),
      3,
      async () => {
        live += 1
        peak = Math.max(peak, live)
        await new Promise((done) => setTimeout(done, 5))
        live -= 1
      },
      (progress) => seen.push(progress.done),
    )
    expect(peak).toBeLessThanOrEqual(3)
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(ratio({ done: 4, total: 60 })).toBe('4 / 60')
    expect(ratio({ done: 0, total: 0 })).toBe('')
  })
})

describe('functionSpec — the register as it must print', () => {
  it('writes names, never the addresses the rows are keyed on', async () => {
    const spec = await functionSpec({ detail: detail(), attending: [], paid: [] })
    const said = spoken(spec)
    expect(said).toContain('Nomsa Dube')
    expect(said).not.toContain('@church.org')
    // The unnamed person is said as unnamed, which is the page's own rule carried onto paper.
    expect(said).toContain('someone this fellowship has not named')
  })

  it('keeps the path of a file it cannot paste', async () => {
    const spec = await functionSpec({ detail: detail(), attending: [], paid: [] })
    const receipts = spec.sections.find((one) => one.heading === 'Payment receipts')
    expect(receipts.entries).toHaveLength(1)
    const image = receipts.entries[0].images[0]
    expect(image.dataUrl).toBeUndefined()
    expect(image.path).toBe('https://bucket.test/kopano/receipts/one.pdf')
    expect(image.reason).toContain('pdf')
  })

  it('says a receipt failed instead of dropping the line when the file will not load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const withImage = detail({
      function: { id: 7, name: 'X', requires_payment: true, amount: 10 },
      people: [
        {
          email: 'one@church.org',
          label: 'Nomsa Dube',
          attending: true,
          paid: true,
          proof_path: 'https://bucket.test/kopano/receipts/one.png',
        },
      ],
    })
    const spec = await functionSpec({ detail: withImage, attending: [], paid: [] })
    const image = spec.sections.find((one) => one.heading === 'Payment receipts').entries[0].images[0]
    expect(image.reason).toContain('network down')
    expect(image.path).toContain('one.png')
  })

  it('asks a free function no money questions at all', async () => {
    const free = detail({ function: { id: 8, name: 'Prayer Meeting', requires_payment: false } })
    const spec = await functionSpec({ detail: free, attending: [], paid: [] })
    const headings = spec.sections.map((one) => one.heading)
    expect(headings).not.toContain('Paid and confirmed')
    expect(headings).not.toContain('Payment receipts')
    expect(headings).toContain('Attending')
    expect(spec.meta.find((one) => one.label === 'Cost').value).toBe('Free — nobody pays')
  })

  it('files the four states where the screen puts them', async () => {
    const spec = await functionSpec({ detail: detail(), attending: [], paid: [] })
    const rowsOf = (heading) => spec.sections.find((one) => one.heading === heading).table.rows
    expect(rowsOf('Paid and confirmed').map((one) => one[0])).toEqual(['Nomsa Dube'])
    // The second person has no name on the users table, so the promised row says so instead of
    // printing the address the row is keyed on.
    const promised = rowsOf('Promised a date')
    expect(promised).toHaveLength(1)
    expect(promised[0][0]).toBe('someone this fellowship has not named')
    expect(promised[0][2]).toBe('Not coming')
    // The second person promised a date and then said they were not coming — both rows say so.
    expect(rowsOf('Not attending').length).toBe(1)
    expect(rowsOf('Not attending')[0][1]).toContain('Promised by')
  })

  it('lists the extra members who never joined beside the ones who did', async () => {
    const spec = await functionSpec({
      detail: detail(),
      attending: [{ member_id: 'm1', attending: true, extra_members: { name: 'Sipho', surname: 'Zulu' } }],
      paid: [{ member_id: 'm1', paid: true, extra_members: { name: 'Sipho', surname: 'Zulu' }, confirmed: null }],
    })
    expect(spec.sections.find((one) => one.heading === 'Extra members attending').table.rows[0]).toEqual(['Sipho Zulu', 'Coming'])
    expect(spec.sections.find((one) => one.heading === 'Payments from extra members').table.rows[0][1]).toBe('Paid')
  })

  /*
    The archive asks for the bytes as well as the picture, because a receipt that is a pdf or a docx has
    never once fitted inside a page — until now the answer was a printed url. Two things have to hold: the
    file comes back whole, and a page that cannot use it is still not downloaded for at all.
  */
  it('carries the file itself when a folder is asked for, and not when it is not', async () => {
    const fetched = vi.fn(async () => ({ ok: true, blob: async () => ({ size: 12, type: 'application/pdf' }) }))
    vi.stubGlobal('fetch', fetched)

    const kept = await loadAttachment('https://bucket.test/kopano/receipts/one.pdf', { keep: true })
    expect(kept.blob).toEqual({ size: 12, type: 'application/pdf' })
    expect(kept.bytes).toBe(12)
    expect(kept.reason).toContain('saved as a file in the folder')

    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', fetched)
    const for_a_page = await loadAttachment('https://bucket.test/kopano/receipts/one.pdf')
    expect(for_a_page.blob).toBeUndefined()
    expect(fetched).toHaveBeenCalledTimes(1)
  })
})

describe('receiptFiles — what an archive folder carries', () => {
  const spec = (entries) => ({ sections: [{ heading: 'Payment receipts', entries }] })

  it('keeps the order the document prints in and the person the entry is headed with', () => {
    const files = receiptFiles(
      spec([
        { heading: 'Nomsa Dube — one.pdf', who: 'Nomsa Dube', images: [{ name: 'one.pdf', path: 'p/one.pdf', blob: { size: 3 } }] },
        { heading: 'Sipho Zulu — two.png', who: 'Sipho Zulu', images: [{ name: 'two.png', path: 'p/two.png', blob: { size: 9 } }] },
      ]),
    )
    expect(files.map((one) => `${one.who}/${one.name}`)).toEqual(['Nomsa Dube/one.pdf', 'Sipho Zulu/two.png'])
  })

  /*
    A receipt that refused to load has nothing to save. It stays in the document as the failure it is and
    is left out of the folder, rather than becoming a zero-byte file that looks like a lost upload.
  */
  it('skips a file that came back with no bytes', () => {
    const files = receiptFiles(
      spec([
        { heading: 'Nomsa Dube — one.pdf', who: 'Nomsa Dube', images: [{ name: 'one.pdf', reason: 'the file refused to load (404)' }] },
      ]),
    )
    expect(files).toEqual([])
  })

  it('says nothing about files when a function had no receipts at all', () => {
    expect(receiptFiles({ sections: [{ heading: 'Attending', table: {} }] })).toEqual([])
    expect(receiptFiles(undefined)).toEqual([])
  })
})

describe('servingsSpec', () => {
  it('writes the tally of roles and no addresses', async () => {
    const spec = servingsSpec({
      roles: [
        { email: 'one@church.org', name: 'Nomsa', surname: 'Dube', role: 'worship' },
        { email: 'two@church.org', name: 'Peter', surname: 'Botha', role: 'ushering' },
        { email: 'three@church.org', name: 'Grace', surname: 'Mokoena', role: 'worship' },
        { email: 'four@church.org', name: '', surname: '', role: '' },
      ],
      extras: [{ id: 1, role: 'teaching', extra_members: { name: 'Sipho', surname: 'Zulu' } }],
      community: 'community-uuid',
      community_name: 'Kopano',
    })
    const said = spoken(spec)
    expect(said).not.toContain('@church.org')
    expect(said).toContain('worship × 2')
    expect(said).toContain('no role was written down')
    expect(spec.sections[1].table.rows).toEqual([['Sipho Zulu', 'teaching']])
    expect(spec.meta.find((one) => one.label === 'Members serving').value).toBe('4')
  })
})

describe('testimoniesSpec', () => {
  const prepared = {
    row: { date: '2026-05-14', allow_all: false, authorise: ['one@church.org'] },
    words: 'He carried me through the year.',
    file: '',
    attachment: null,
  }

  it('says who could read it, in words, without printing the list', () => {
    const spec = testimoniesSpec({ members: [prepared], extras: [], community_name: 'Kopano' })
    const said = spoken(spec)
    expect(said).toContain('Seen only by the 1 person the author named')
    expect(said).not.toContain('@church.org')
  })

  it('keeps a body that will not open on the page as a stated failure', () => {
    const sealed = { row: { date: '2026-05-14', allow_all: true }, words: '', file: '', reason: 'these words will not open' }
    const spec = testimoniesSpec({ members: [sealed], extras: [] })
    expect(spoken(spec)).toContain('(these words will not open)')
    expect(spoken(spec)).toContain('Open to the whole community')
  })

  it('carries an image attachment with the caption it was shared under', () => {
    const withFile = {
      row: { date: '2026-05-14', allow_all: true },
      words: '',
      file: 'https://bucket.test/kopano/testimonies/one.png',
      attachment: { path: 'https://bucket.test/kopano/testimonies/one.png', name: 'one.png', dataUrl: 'data:', width: 800, height: 600 },
    }
    const spec = testimoniesSpec({ members: [withFile], extras: [] })
    const entry = spec.sections[0].entries[0]
    expect(entry.images[0].dataUrl).toBe('data:')
    expect(entry.images[0].caption).toBe('the sharing itself, as an image')
  })
})
