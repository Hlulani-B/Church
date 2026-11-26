/*
  Turning a document spec into a PDF. This is the only file in the export set that knows anything
  about layout, and it knows nothing about functions, servings or testimonies: it is handed a title,
  a few facts, sections of table and text, and the attachments to paste, and it decides where every
  line goes on an A4 page.

  What it is built to survive is an archive a person prints and reads after the rows behind it have
  been deleted to free up space — which is a different job from a screenshot. So a table that runs
  over a page carries its own header onto the next one, a row is never split between two pages, wide
  cells are wrapped rather than clipped, every attachment keeps the path it came from printed under
  it, and the last line on every page says which page of how many this is.
*/

import { drawn } from '../table_files.js'
import { loadJsPdf } from './libraries.js'

const PAGE = { width: 595.28, height: 841.89 } // A4, in points
const MARGIN = 44
const BOTTOM = PAGE.height - MARGIN - 26 // the strip under this is where the page number lives
const TEXT = PAGE.width - MARGIN * 2

const SIZE = { title: 20, subtitle: 11, heading: 13, label: 8.5, body: 10, small: 8 }
const LEAD = { heading: 24, body: 14, small: 11 }

const INK = '#111111'
const MUTED = '#666666'
const LINE = '#d8d8d8'
const FILL = '#f4f4f4'

/*
  The shape one document takes:

    {
      title, subtitle, meta: [{ label, value }],
      sections: [{
        heading, note,
        table: { columns: [...], rows: [[...], ...] },
        lines: [string],            // wrapped paragraphs
        entries: [{ heading, lines: [], images: [{ path, name, caption, dataUrl, format, width, height, reason }] }],
        empty: string               // said instead of a table when there is nothing in the section
      }],
      footer
    }

  `entries` is the attachment form: a heading, the words under it, and the pictures pasted after. It
  is what a testimony and a receipt list use, where a table would only clip both.
*/
export async function renderPdf(spec) {
  // Loaded through ./libraries.js rather than imported here so that a chunk left behind by a
  // redeploy arrives as "reload the page" instead of as a browser's own words about modules.
  const jsPDF = await loadJsPdf()
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const sheet = new Sheet(printable(doc))
  sheet.run(spec)
  sheet.numberPages(spec.footer)
  return doc.output('blob')
}

class Sheet {
  constructor(doc) {
    this.doc = doc
    this.y = MARGIN
  }

  run(spec) {
    this.title(spec)
    this.meta(spec.meta)
    for (const section of spec.sections || []) this.section(section)
    if (!(spec.sections || []).length) this.note('Nothing was recorded under this heading.')
  }

  // Everything below the current line, and a new page when it would not fit on this one.
  space(height) {
    if (this.y + height > BOTTOM) {
      this.doc.addPage()
      this.y = MARGIN
      return true
    }
    return false
  }

  title(spec) {
    const { doc } = this
    doc.setTextColor(INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(SIZE.title)
    const head = doc.splitTextToSize(String(spec.title || 'Untitled'), TEXT)
    this.space(head.length * 24 + 10)
    doc.text(head, MARGIN, this.y + 16)
    this.y += head.length * 24 + 4

    if (spec.subtitle) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(SIZE.subtitle)
      doc.setTextColor(MUTED)
      doc.text(String(spec.subtitle), MARGIN, this.y + 8)
      this.y += 18
    }
    doc.setDrawColor(LINE)
    doc.line(MARGIN, this.y + 4, MARGIN + TEXT, this.y + 4)
    this.y += 18
  }

  // The facts about the document itself, in two columns of label and value: what a reader of a
  // printed page needs before they read a single row.
  meta(items) {
    const rows = (items || []).filter((one) => one && one.value !== null && one.value !== undefined && String(one.value).trim() !== '')
    if (!rows.length) return
    const { doc } = this
    const column = Math.floor(TEXT / 2)
    const half = Math.ceil(rows.length / 2)

    for (let i = 0; i < half; i += 1) {
      const pair = [rows[i], rows[i + half]].filter(Boolean)
      this.space(30)
      pair.forEach((one, slot) => {
        const x = MARGIN + slot * column
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(SIZE.label)
        doc.setTextColor(MUTED)
        doc.text(String(one.label).toUpperCase(), x, this.y + 9)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SIZE.body)
        doc.setTextColor(INK)
        const value = doc.splitTextToSize(String(one.value), column - 12)
        doc.text(value, x, this.y + 23)
      })
      this.y += 34
    }
    this.y += 6
  }

  section(section) {
    const { doc } = this
    if (section.heading) {
      this.space(LEAD.heading + 8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(SIZE.heading)
      doc.setTextColor(INK)
      doc.text(doc.splitTextToSize(String(section.heading), TEXT), MARGIN, this.y + 14)
      this.y += LEAD.heading
    }
    if (section.note) this.note(section.note)
    if (section.table) this.table(section.table, section.empty)
    for (const line of section.lines || []) this.paragraph(line)
    for (const entry of section.entries || []) this.entry(entry)
    this.y += 14
  }

  note(value) {
    const { doc } = this
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SIZE.small)
    doc.setTextColor(MUTED)
    const lines = doc.splitTextToSize(String(value), TEXT)
    this.space(lines.length * LEAD.small + 4)
    doc.text(lines, MARGIN, this.y + 8)
    this.y += lines.length * LEAD.small + 4
  }

  paragraph(value) {
    const { doc } = this
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SIZE.body)
    doc.setTextColor(INK)
    const lines = doc.splitTextToSize(String(value ?? ''), TEXT)
    this.space(lines.length * LEAD.body + 6)
    doc.text(lines, MARGIN, this.y + 11)
    this.y += lines.length * LEAD.body + 6
  }

  /*
    Column widths from what the cells actually hold, capped at both ends: a Person column full of
    names and a Receipt column of dates should not each take half the page, and a 200-character note
    should not push every other column off it. Below the content width the leftover is shared out, so
    a narrow table still reads across the whole page.
  */
  table({ columns = [], rows = [] }, empty) {
    if (!rows.length) {
      this.note(empty || 'Nothing to list here yet.')
      return
    }
    const { doc } = this
    const weights = columns.map((head, index) => {
      const widest = Math.max(String(head).length, ...rows.map((row) => String(row[index] ?? '').length))
      return Math.min(Math.max(widest + 2, 8), 46)
    })
    const total = weights.reduce((sum, one) => sum + one, 0) || 1
    let widths = weights.map((one) => (one / total) * TEXT)
    const narrowest = Math.min(...widths)
    if (narrowest < 46) widths = grow(widths, 46)

    const header = () => {
      this.space(26)
      doc.setFillColor(FILL)
      doc.rect(MARGIN, this.y, TEXT, 20, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(SIZE.label)
      doc.setTextColor(MUTED)
      let x = MARGIN + 6
      columns.forEach((head, index) => {
        doc.text(String(head).toUpperCase(), x, this.y + 13)
        x += widths[index]
      })
      this.y += 20
    }

    header()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(SIZE.body)
    for (const row of rows) {
      const cells = row.map((cell) => String(cell ?? ''))
      const stacked = cells.map((cell, index) => doc.splitTextToSize(cell, widths[index] - 12))
      const height = Math.max(18, Math.max(...stacked.map((one) => one.length)) * LEAD.body + 10)
      // A row moves whole: a name on one page and its amount on the next is not a register.
      if (this.y + height > BOTTOM) {
        doc.addPage()
        this.y = MARGIN
        header()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(SIZE.body)
      }
      doc.setTextColor(INK)
      let x = MARGIN + 6
      stacked.forEach((lines, index) => {
        doc.text(lines, x, this.y + 13)
        x += widths[index]
      })
      this.y += height
      doc.setDrawColor(LINE)
      doc.line(MARGIN, this.y, MARGIN + TEXT, this.y)
    }
    this.y += 8
  }

  /*
    One thing being recorded with its attachments: a heading, the words under it, then every file
    pasted at the width of the page with the path it came from printed beneath. That path line is the
    reason a bucket file can still be fetched years after the row that pointed at it is gone.
  */
  entry(entry) {
    const { doc } = this
    if (entry.heading) {
      this.space(LEAD.heading)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(SIZE.body)
      doc.setTextColor(INK)
      doc.text(doc.splitTextToSize(String(entry.heading), TEXT), MARGIN, this.y + 11)
      this.y += LEAD.heading - 4
    }
    for (const line of entry.lines || []) this.paragraph(line)
    for (const image of entry.images || []) this.image(image)
    this.y += 6
  }

  image(image) {
    if (!image) return
    const { doc } = this
    const caption = [image.caption, image.path].filter(Boolean).join(' · ')

    if (!image.dataUrl) {
      // No bytes to paste — a pdf, a docx, a file that would not load. The path is still the fact
      // worth keeping, so it is printed where the picture would have been.
      this.paragraph(`Attachment: ${image.name || 'file'}${image.reason ? ` (${image.reason})` : ''}`)
      if (image.path) this.note(image.path)
      return
    }

    const box = Math.min(TEXT, 420)
    const scale = Math.min(box / image.width, (BOTTOM - this.y - 40) / image.height, 1)
    const width = Math.max(40, image.width * Math.max(scale, 0.05))
    const height = Math.max(40, image.height * Math.max(scale, 0.05))
    this.space(height + 34)
    doc.setDrawColor(LINE)
    doc.addImage(image.dataUrl, image.format || 'JPEG', MARGIN, this.y + 2, width, height, undefined, 'FAST')
    doc.rect(MARGIN, this.y + 2, width, height)
    this.y += height + 8
    if (caption) this.note(caption)
  }

  // Which page of how many, on every page: an archive printed out and filed loses its meaning the
  // moment a sheet goes missing, and a footer that says "3 of 14" says what was taken out.
  numberPages(footer) {
    const { doc } = this
    const count = doc.getNumberOfPages()
    for (let page = 1; page <= count; page += 1) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(SIZE.small)
      doc.setTextColor(MUTED)
      doc.line(MARGIN, BOTTOM + 8, MARGIN + TEXT, BOTTOM + 8)
      if (footer) doc.text(String(footer), MARGIN, BOTTOM + 20)
      doc.text(`page ${page} of ${count}`, MARGIN + TEXT, BOTTOM + 20, { align: 'right' })
    }
  }
}

// Widening every column that is under a floor, and taking the same total back out of the columns
// that can afford it, so the table still ends exactly at the right margin.
function grow(widths, floor) {
  const out = [...widths]
  for (let pass = 0; pass < out.length; pass += 1) {
    const tight = out.map((one) => Math.max(one, floor))
    const debt = TEXT - tight.reduce((sum, one) => sum + one, 0)
    if (debt >= 0) return normalise(tight)
    const room = tight.filter((one) => one > floor)
    if (!room.length) return normalise(tight)
    const share = debt / room.length
    for (let i = 0; i < out.length; i += 1) if (tight[i] > floor) out[i] = tight[i] + share
  }
  return normalise(out)
}

function normalise(widths) {
  const sum = widths.reduce((total, one) => total + one, 0) || 1
  return widths.map((one) => (one / sum) * TEXT)
}

/*
  Every string that reaches the page is folded to what the standard fonts can draw, and doing it here
  rather than at each call is the point: a page of names written once will be written again somewhere
  else, and the one character that is missed does not fail — it silently turns the whole line to junk.

  The reason is jsPDF's encoding rule: with a standard font it writes cp1252 bytes, but a single
  character outside cp1252 (a Zulu ḽ, a Chinese sign, an emoji) makes it switch that run to UTF-16,
  which the WinAnsi font then draws as alternating blanks and boxes.

  Only the characters the font has no byte for are folded, and folding one stretch of them cannot
  disturb the rest of the line: `drawn` also strips the marks off accented letters, and an archive
  that writes Jose for André has lost the thing a person is called by. The fold itself is the app's
  own, shared with the table exporter so a PDF and a spreadsheet say the same thing about a name.
*/
export function foldValue(value) {
  if (Array.isArray(value)) return value.map(foldValue)
  if (typeof value !== 'string') return value

  // Foreign characters are folded in one run at a time, so a letter and the mark sitting on it are
  // still read together, and the line breaks the layout counts on are left where they are.
  let out = ''
  let run = ''
  const flush = () => {
    if (run) {
      out += drawn(run)
      run = ''
    }
  }
  for (const one of value) {
    const code = one.codePointAt(0)
    const foreign = code > 255 || code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)
    if (foreign) run += one
    else {
      flush()
      out += one
    }
  }
  flush()
  return out
}

function printable(doc) {
  return new Proxy(doc, {
    get(receiver, key) {
      const value = doc[key]
      if (key === 'text' || key === 'splitTextToSize') {
        return (...args) => doc[key](...args.map(foldValue))
      }
      return typeof value === 'function' ? value.bind(doc) : value
    },
  })
}
