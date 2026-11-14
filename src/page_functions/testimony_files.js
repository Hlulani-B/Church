/*
  The two writers behind the export buttons. They are handed rows and nothing else: reading is
  src/page_functions/testimonies.js, and this file only turns rows that were already read into
  something that leaves the browser. Both formats carry the same four columns in the same order.

  The .xlsx is written here rather than pulled in as a dependency: a zip of six small parts,
  stored rather than deflated, with the date as a real date cell so Excel sorts and filters it
  as a date. The PDF is written here for the same reason, and by the same kind of hand: the
  pages are drawn with the two standard fonts every reader already carries, so neither export
  prints anything, opens a window or asks for a permission — both are a file in the downloads.
*/

const HEADS = ['Name', 'Surname', 'Date', 'Testimony']

// Excel counts days from 1899-12-30, and a testimony date is a plain calendar day.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function day(text) {
  return String(text ?? '').slice(0, 10)
}

function dayNumber(date) {
  const read = Date.parse(`${day(date)}T00:00:00Z`)
  return Number.isNaN(read) ? null : Math.round((read - EXCEL_EPOCH) / 86400000)
}

function pretty(date) {
  const read = Date.parse(`${day(date)}T00:00:00Z`)
  return Number.isNaN(read)
    ? day(date)
    : new Date(read).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// The search a file was written out of, once for a filename and once for a sentence. A name
// is part of that search now, and a file of one person's sharing said only "all dates" would
// be answering a different question from the one that was asked.
function stamp({ from, to } = {}) {
  if (from && to) return `${day(from)}_to_${day(to)}`
  if (from) return `${day(from)}_onwards`
  if (to) return `up_to_${day(to)}`
  return 'all_dates'
}

function spoken({ from, to, name } = {}) {
  const days =
    from && to
      ? `${pretty(from)} to ${pretty(to)}`
      : from
        ? `${pretty(from)} onwards`
        : to
          ? `up to ${pretty(to)}`
          : 'every date'
  const who = String(name || '').trim()
  return who ? `${days}, shared by ${who}` : days
}

// A search term becomes part of a download name, so it is cut down to what a file may be
// called by every operating system at once: no separators, no length nobody can read.
function byline(name) {
  const who = String(name || '')
    .replace(/[^A-Za-z0-9._ -]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '')
  return who ? `_by-${who}` : ''
}

function fileName(title, search, extension) {
  const clean =
    String(title || '')
      .replace(/[^A-Za-z0-9._ -]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-') || 'testimonies'
  return `${clean}${byline(search?.name)}_${stamp(search)}.${extension}`
}

/*
  Both writers are asked the same thing first: is there anything to write? An empty workbook
  and an empty document both look like success and are neither, so the page is handed a
  sentence to show instead.
*/
function check(rows) {
  if (!rows.length) throw new Error('No testimonies match this search, so there is nothing to export.')
  return rows
}

/*
  A testimony is typed by a person and pasted from anywhere, so both writers assume nothing
  about what is in it. XML 1.0 has no room for the control range at all — a single stray
  character of it makes the whole workbook unreadable — so those are dropped while the newline
  and the tab that hold a testimony's paragraphs stay.
*/
function xml(text) {
  let kept = ''
  for (const one of String(text ?? '')) {
    const code = one.codePointAt(0)
    kept += code < 32 && code !== 9 && code !== 10 && code !== 13 ? ' ' : one
  }
  return kept.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CRC = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/*
  A zip of stored entries: a local header and the bytes for each part, then the directory that
  says where every one of them is. Nothing is deflated, which the format allows and Excel
  reads, and it keeps this file to bytes rather than to a second dependency. Names are marked
  UTF-8 so a community called in any alphabet survives the trip.
*/
function zip(parts) {
  const encoder = new TextEncoder()
  const now = new Date()
  const dosTime = (now.getHours() << 10) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const files = parts.map((one) => {
    const data = encoder.encode(one.text)
    return { name: encoder.encode(one.name), data, crc: crc32(data) }
  })
  const bytes = new Uint8Array(
    files.reduce((n, one) => n + 76 + one.name.length * 2 + one.data.length, 0) + 22,
  )
  const view = new DataView(bytes.buffer)
  const starts = []
  let at = 0
  const word = (v) => { view.setUint16(at, v, true); at += 2 }
  const dword = (v) => { view.setUint32(at, v >>> 0, true); at += 4 }
  const put = (v) => { bytes.set(v, at); at += v.length }

  for (const one of files) {
    starts.push(at)
    dword(0x04034b50); word(20); word(0x0800); word(0); word(dosTime); word(dosDate)
    dword(one.crc); dword(one.data.length); dword(one.data.length)
    word(one.name.length); word(0)
    put(one.name); put(one.data)
  }
  const directory = at
  files.forEach((one, i) => {
    dword(0x02014b50); word(20); word(20); word(0x0800); word(0); word(dosTime); word(dosDate)
    dword(one.crc); dword(one.data.length); dword(one.data.length)
    word(one.name.length); word(0); word(0); word(0); word(0)
    dword(0); dword(starts[i])
    put(one.name)
  })
  // Measured before anything is written: the cursor moves while the record goes out.
  const span = at - directory
  dword(0x06054b50); word(0); word(0); word(files.length); word(files.length)
  dword(span); dword(directory); word(0)
  return bytes
}

const CONTENT_TYPES =
  `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>'

const ROOT_RELS =
  `${DECL}<Relationships xmlns="${PKG}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
  '</Relationships>'

const WORKBOOK =
  `${DECL}<workbook xmlns="${MAIN}" xmlns:r="${REL}">` +
  '<sheets><sheet name="Testimonies" sheetId="1" r:id="rId1"/></sheets></workbook>'

const WORKBOOK_RELS =
  `${DECL}<Relationships xmlns="${PKG}">` +
  `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
  '</Relationships>'

/*
  Four styles, which is all the sheet asks for: plain, a bold header, text that starts at the
  top of a cell and wraps rather than running off the page, and a date written as
  YYYY-MM-DD so the column reads the way the search on screen reads.
*/
const STYLES =
  `${DECL}<styleSheet xmlns="${MAIN}">` +
  '<numFmts count="1"><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '<dxfs count="0"/></styleSheet>'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Four columns, so the letter is never further along the alphabet than D.
const at = (row, col) => `${String.fromCharCode(65 + col)}${row}`

function text(row, col, value, style) {
  return `<c r="${at(row, col)}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function sheetXml(rows) {
  const head = `<row r="1">${HEADS.map((one, col) => text(1, col, one, 1)).join('')}</row>`
  const body = rows.map((one, n) => {
    const row = n + 2
    const serial = dayNumber(one.date)
    // A day the sheet can count is written as one; anything odder is written as it came.
    const date = serial === null
      ? text(row, 2, one.date, 2)
      : `<c r="${at(row, 2)}" s="3"><v>${serial}</v></c>`
    return `<row r="${row}">${text(row, 0, one.name, 2)}${text(row, 1, one.surname, 2)}${date}${text(row, 3, one.body, 2)}</row>`
  }).join('')
  const last = rows.length + 1
  return (
    `${DECL}<worksheet xmlns="${MAIN}"><dimension ref="A1:D${last}"/>` +
    '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols><col min="1" max="2" width="20" customWidth="1"/>' +
    '<col min="3" max="3" width="12" customWidth="1"/>' +
    '<col min="4" max="4" width="110" customWidth="1"/></cols>' +
    `<sheetData>${head}${body}</sheetData>` +
    `<autoFilter ref="A1:D${last}"/></worksheet>`
  )
}

/*
  An <a download> clicked once, because that saves the bytes without opening a tab. The
  address behind it has to outlive the click, so it is revoked on a timer rather than at once.
*/
function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return name
}

export function downloadExcel(rows, { title, dates = {} } = {}) {
  const wanted = check(rows)
  const bytes = zip([
    { name: '[Content_Types].xml', text: CONTENT_TYPES },
    { name: '_rels/.rels', text: ROOT_RELS },
    { name: 'xl/workbook.xml', text: WORKBOOK },
    { name: 'xl/_rels/workbook.xml.rels', text: WORKBOOK_RELS },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml(wanted) },
  ])
  return { name: save(bytes, fileName(title, dates, 'xlsx'), XLSX), count: wanted.length }
}

/*
  The PDF is made here, byte by byte, because the alternative is a font library in the
  bundle. It is a plain table on A4: four columns, the header repeated at the top of every
  page, a testimony wrapped over as many lines as it needs and never split across a page.

  The two standard fonts carry their own widths, so wrapping is measured with the real
  Helvetica metrics rather than guessed at. Those fonts answer to cp1252 bytes, which is a
  wider set than ASCII but not the whole unicode range, so anything they cannot draw is
  folded onto the nearest thing they can: an accent is dropped (é to e, ḽ to l), a typographic
  dash or quote is taken in bytes, and only a sign with no relative at all is left as ?.
*/

const A4_W = 595.28
const A4_H = 841.89
const EDGE = 40 // every margin, and the gap between two columns
const TEXT = 9 // points
const LEAD = 11.6 // the line a row of text sits on
const ROW_PAD = 5

// Helvetica, thousandths of an em, from the space at 32 to the tilde at 126: twelve a line.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584,
  278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
  722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
  278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

// The glyphs outside that range that the font does have, by their code point.
const RARE = {
  132: 333, 133: 1000, 145: 222, 146: 222, 147: 333, 148: 333, 149: 350,
  150: 556, 151: 1000, 153: 1000,
}

// The punctuation a testimony picks up off a phone, in the byte the font draws it with.
const CP1252 = {
  '\u20ac': 128, '\u201a': 130, '\u0192': 131, '\u201e': 132, '\u2026': 133,
  '\u2020': 134, '\u2021': 135, '\u02c6': 136, '\u2030': 137, '\u0160': 138,
  '\u2039': 139, '\u0152': 140, '\u017d': 142, '\u2018': 145, '\u2019': 146,
  '\u201c': 147, '\u201d': 148, '\u2022': 149, '\u2013': 150, '\u2014': 151,
  '\u02dc': 152, '\u2122': 153, '\u0161': 154, '\u203a': 155, '\u0153': 156,
  '\u017e': 158, '\u0178': 159,
}

// Text as the bytes the fonts will be asked to draw: accents folded off, the common
// typographic signs mapped, and control characters — which the row would otherwise be
// measured with and the font would not show — dropped rather than guessed at.
function drawn(text) {
  let out = ''
  for (const one of String(text ?? '').normalize('NFD')) {
    const code = one.codePointAt(0)
    if ((code >= 0x300 && code <= 0x36f) || code === 0x327 || code === 0x328) continue
    if (code === 9 || code === 10 || code === 13) out += one
    else if (code < 32 || code === 127) continue
    else if (code <= 255) out += one
    else {
      const mapped = CP1252[one]
      if (mapped) out += String.fromCharCode(mapped)
      else if (code >= 0x2000 && code <= 0x200b) out += ' '
      else out += '?'
    }
  }
  return out
}

// How wide `text` is at TEXT points. Everything the font draws above ASCII is given the
// width of an m, which is never narrower than the truth for a letter, so a measured line
// can be short but cannot spill out of its column.
function width(text) {
  let total = 0
  for (const one of text) {
    const code = one.codePointAt(0)
    total += code < 32 ? 0 : code <= 126 ? HELV[code - 32] : RARE[code] || 556
  }
  return (total * TEXT) / 1000
}

// `text` inside a column `max` points wide: broken on spaces, and inside a word only when
// the word alone is wider than the column. A newline in a testimony is kept as one.
function wrap(text, max) {
  const lines = []
  for (const para of drawn(text).split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      if (!word) continue
      const joined = line ? `${line} ${word}` : word
      if (width(joined) <= max) {
        line = joined
        continue
      }
      if (line) {
        lines.push(line)
        line = ''
      }
      if (width(word) <= max) {
        line = word
        continue
      }
      for (const ch of word) {
        if (line && width(line + ch) <= max) line += ch
        else {
          if (line) lines.push(line)
          line = ch
        }
      }
    }
    lines.push(line)
  }
  return lines.length ? lines : ['']
}

// Column widths, and the four values of a row in that order. The last column takes what is
// left, because the testimony is the only part of the row with no length of its own.
const COLS = [82, 82, 62, A4_W - 2 * EDGE - 226]
const TOP_FIRST = A4_H - EDGE - 56 // under the title block
const TOP_NEXT = A4_H - EDGE - 4 // where the header sits on a page of its own
const HEADER = LEAD + 4
const FLOOR = EDGE + 18 // the footer line lives below this

function rowCells(one) {
  return [one.name, one.surname, one.date, one.body].map((text, i) =>
    wrap(text, COLS[i] - 8),
  )
}

// Rows grouped into pages: a row goes to the next page whole rather than being split, the
// header is repeated wherever a page starts, and only a row too tall for a whole page of its
// own is cut — the rest of it carries on under the next header instead of running off.
const take = (cells, n) => cells.map((lines) => lines.slice(0, n))
const drop = (cells, n) => cells.map((lines) => lines.slice(n))
const filled = (cells) => cells.some((lines) => lines.length)
const linesOf = (cells) => Math.max(...cells.map((lines) => lines.length), 1)

function layout(rows) {
  const pages = []
  let head = TOP_FIRST
  let top = head - HEADER
  let page = []
  const fresh = () => {
    if (page.length) pages.push({ head, rows: page })
    head = TOP_NEXT
    top = head - HEADER
    page = []
  }
  for (const source of rows.map(rowCells)) {
    let rest = source
    while (filled(rest)) {
      let cells = rest
      let height = linesOf(cells) * LEAD + ROW_PAD
      if (top - height < FLOOR) {
        if (page.length) {
          fresh()
          continue
        }
        const room = Math.max(1, Math.floor((top - FLOOR - ROW_PAD) / LEAD))
        if (height > room * LEAD + ROW_PAD) {
          cells = take(rest, room)
          rest = drop(rest, room)
          height = room * LEAD + ROW_PAD
        }
      }
      page.push({ cells, top, height })
      top -= height
      rest = drop(rest, linesOf(cells))
    }
  }
  pages.push({ head, rows: page })
  return pages
}

const PDF = 'application/pdf'

const num = (n) => String(Math.round(n * 100) / 100)

// A string inside a PDF literal: the two characters that would otherwise be structure.
function literal(text) {
  return drawn(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

const put = (x, y, text, { font = 'F1', size = TEXT, color = '0 0 0' } = {}) =>
  `BT\n${color} rg\n/${font} ${num(size)} Tf\n1 0 0 1 ${num(x)} ${num(y)} Tm\n(${literal(text)}) Tj\nET\n`

const rect = (x, y, w, h) => `${num(x)} ${num(y)} ${num(w)} ${num(h)} re\n`

// The left edge of each column, then the right edge of the last one.
const X = [EDGE]
for (const one of COLS) X.push(X[X.length - 1] + one)

/*
  One page, drawn top down. The y axis of a PDF grows upwards, so a row's `top` is where its
  first line's baseline sits a little under, and the boxes are stroked after the text rather
  than before it — the order makes no difference to what is on the paper, but the rules must
  be grey and the words black, and each command says which of the two it is drawing.
*/
function pageStream(index, page, total, title, dates, count) {
  let out = ''
  if (index === 0) {
    out += put(EDGE, A4_H - EDGE - 18, title, { font: 'F2', size: 17 })
    out += put(EDGE, A4_H - EDGE - 34, `${count} ${count === 1 ? 'testimony' : 'testimonies'} — ${spoken(dates)}`, {
      size: 9,
      color: '0.35 0.35 0.35',
    })
    out += `0.6 w\n0.1 0.1 0.1 RG\n${rect(EDGE, A4_H - EDGE - 44, X[X.length - 1] - EDGE, 0)}S\n`
  }
  out += '0.7 w\n0.62 0.62 0.62 RG\n'
  out += `0.92 0.92 0.92 rg\n${rect(EDGE, page.head - HEADER, X[X.length - 1] - EDGE, HEADER)}f\n`
  HEADS.forEach((one, col) => {
    out += put(X[col] + 4, page.head - HEADER / 2 - 3, one, { font: 'F2' })
    out += rect(X[col], page.head - HEADER, COLS[col], HEADER)
  })
  out += 'S\n'
  for (const row of page.rows) {
    row.cells.forEach((lines, col) => {
      lines.forEach((line, k) => {
        out += put(X[col] + 4, row.top - TEXT - 4 - k * LEAD, line, { font: 'F1' })
      })
      out += rect(X[col], row.top - row.height, COLS[col], row.height)
    })
    out += 'S\n'
  }
  out += put(EDGE, EDGE, `Page ${index + 1} of ${total}`, { size: 8, color: '0.45 0.45 0.45' })
  return out
}

/*
  The file itself: the catalog, the pages, the two fonts, then one page dictionary and one
  content stream per page. Offsets are counted in bytes as the pieces go out, which is why
  every string written here has already been through `drawn` — one character, one byte.
*/
function pdfBytes(rows, title, dates, count) {
  const pages = layout(rows)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${6 + i * 2} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${literal(title)}) /Subject (Testimonies) /Creator (Kopano) /Producer (Kopano) >>`,
  ]
  pages.forEach((page, i) => {
    const content = pageStream(i, page, pages.length, title, dates, count)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4_W)} ${num(A4_H)}]` +
        ` /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length + 2} 0 R >>`,
    )
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
  })

  let file = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(file.length)
    file += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const start = file.length
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f\r\n`
  for (const one of offsets) file += `${String(one).padStart(10, '0')} 00000 n\r\n`
  file +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\n` +
    `startxref\n${start}\n%%EOF\n`
  return Uint8Array.from(file, (ch) => ch.charCodeAt(0))
}

export function downloadPdf(rows, { title, dates = {} } = {}) {
  const wanted = check(rows)
  const bytes = pdfBytes(wanted, title || 'testimonies', dates, wanted.length)
  return { name: save(bytes, fileName(title, dates, 'pdf'), PDF), count: wanted.length }
}
