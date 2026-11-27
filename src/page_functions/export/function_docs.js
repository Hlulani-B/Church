/*
  What one planned function looks like on paper.

  This file turns a function into a document spec: the plan at the top, then the four registers a
  leader works out of (confirmed, waiting to be checked, promised, not coming), then the extra
  members' half of the same register, then every payment receipt pasted in at full width with the
  bucket path printed under it. It reads the three tables the screen reads and nothing else, and it
  knows nothing about layout (that is pdf.js) or about saving (that is save.js).

  Two rules it keeps from the app it is exporting. A person is never an email address on the page and
  is therefore never one on paper either: a name that is missing is said as missing. And the file a
  row points at is the row's most fragile part — the whole point of the archive is that it can still
  be read after the rows behind it are deleted to free up space, so the bytes are copied in and the
  path is written out beside them rather than left as the only record of where the file was.
*/

import { ChurchFunctionsFetch } from '../church_functions.js'
import extra from '../extra.js'
import { moment, pretty } from '../table_files.js'
import { renderPdf } from './pdf.js'
import { isFilePath, loadAttachments, nameOf } from './attachments.js'

const functions = new ChurchFunctionsFetch()

const NO_NAME = 'someone this fellowship has not named'
const NO_LEADER = 'a leader this fellowship has not named'

/*
  The heading the receipts of a function are listed under. Named because `receiptFiles` finds them again
  by it, and a section renamed in one place only has to be renamed in one place.
*/
const RECEIPTS = 'Payment receipts'

// A price in words. A paid function with no number in it is impossible through the form and only
// arrives from a hand-written insert, so it is described rather than printed as `R NaN`.
function amount(one) {
  const value = Number(one?.amount)
  return Number.isFinite(value) ? `R ${value.toFixed(2)}` : 'an amount nobody typed'
}

// A person's name, never their address. `label` falls back to the email on every read in this app,
// so the two being equal is exactly the case where no name was found.
function spoken(label, email) {
  const name = String(label || '').trim()
  return name && name !== email ? name : NO_NAME
}

function momentOf(value) {
  return value ? moment(value) : ''
}

function dayOf(value) {
  return value ? pretty(value) : ''
}

const confirmed = (one) => Boolean(one.confirmed_by && one.confirmed_at)

// Every receipt this function holds, member and extra member together, in the order they are pasted.
function receipts(people, payments) {
  const list = []
  const file = (path) => ({ path, name: nameOf(path) })
  for (const one of people) {
    if (isFilePath(one.proof_path)) list.push({ who: spoken(one.label, one.email), ...file(one.proof_path) })
  }
  for (const one of payments) {
    if (!isFilePath(one.proof_path)) continue
    const named = `${one.extra_members?.name ?? ''} ${one.extra_members?.surname ?? ''}`.trim()
    list.push({ who: named || 'an extra member', ...file(one.proof_path) })
  }
  return list
}

/*
  The whole document for one function. `detail` is what the screen shows (the plan, who planned it,
  everybody who answered); the two extra-member tables are read beside it because a leader's register
  is only complete with the people who never joined. Attachments are fetched here, once, and what
  comes back is either bytes to paste or the reason there are none — a missing receipt is written into
  the document rather than dropped from it.

  `keepFiles` asks for the file behind every receipt as well as the picture of it. The document does not
  change either way; what changes is that the loaded file carries its bytes, which is what lets an
  archive folder hold the pdf a page could never paste.
*/
export async function functionSpec({ detail, attending = [], paid = [] }, { onProgress, keepFiles = false } = {}) {
  const one = detail?.function || {}
  const people = detail?.people || []
  const paying = Boolean(one.requires_payment)
  const receiptList = receipts(people, paid)
  const loaded = await loadAttachments(receiptList.map((one) => one.path), { onProgress, keep: keepFiles })

  return {
    title: one.name || 'A function without a name',
    subtitle: [dayOf(one.function_date), one.location].filter(Boolean).join('  ·  '),
    meta: [
      { label: 'Held on', value: dayOf(one.function_date) },
      { label: 'Location', value: one.location || 'No location was written down' },
      { label: 'Cost', value: paying ? `${amount(one)} per head` : 'Free — nobody pays' },
      { label: 'Planned by', value: spoken(detail?.planned_by, one.created_by) },
      { label: 'Planned on', value: momentOf(one.created_at) },
      { label: 'Answers', value: `${people.length} ${people.length === 1 ? 'person has' : 'people have'} said something` },
      { label: 'Archived on', value: momentOf(new Date().toISOString()) },
    ],
    sections: [
      {
        heading: 'Attending',
        note: 'Everybody who said they will be there.',
        table: {
          columns: ['Person', 'Receipt up'],
          rows: people
            .filter((person) => person.attending === true)
            .map((person) => [spoken(person.label, person.email), person.proof_submitted_at ? momentOf(person.proof_submitted_at) : '']),
        },
        empty: 'Nobody is coming.',
      },
      ...(paying
        ? [
            {
              heading: 'Paid and confirmed',
              note: 'A leader has checked these receipts off.',
              table: {
                columns: ['Person', 'Receipt up', 'Confirmed by', 'Confirmed on'],
                rows: people
                  .filter((person) => person.paid && confirmed(person))
                  .map((person) => [
                    spoken(person.label, person.email),
                    momentOf(person.proof_submitted_at),
                    spoken(person.confirmed_by_label, person.confirmed_by) === NO_NAME ? NO_LEADER : spoken(person.confirmed_by_label, person.confirmed_by),
                    momentOf(person.confirmed_at),
                  ]),
              },
              empty: 'No receipt has been signed off yet.',
            },
            {
              heading: 'Receipts to check',
              note: 'Paid, but nobody has looked at the proof yet.',
              table: {
                columns: ['Person', 'Receipt up', 'Amount'],
                rows: people
                  .filter((person) => person.paid && !confirmed(person))
                  .map((person) => [spoken(person.label, person.email), momentOf(person.proof_submitted_at), amount(one)]),
              },
              empty: 'Nothing is waiting for a leader.',
            },
            {
              heading: 'Promised a date',
              note: 'They gave a day they mean to pay by instead of a receipt.',
              table: {
                columns: ['Person', 'Promised by', 'Coming'],
                rows: people
                  .filter((person) => !person.paid && person.expected_pay_date)
                  .map((person) => [spoken(person.label, person.email), dayOf(person.expected_pay_date), said(person)]),
              },
              empty: 'Nobody has promised a date.',
            },
          ]
        : []),
      {
        heading: 'Not attending',
        table: {
          columns: ['Person', paying ? 'Where the money stands' : 'Note'],
          rows: people
            .filter((person) => person.attending === false)
            .map((person) => [spoken(person.label, person.email), paying ? money(person, one) : '']),
        },
        empty: 'Nobody said they will not be there.',
      },
      {
        heading: 'Extra members attending',
        note: 'The people who never joined the app, answered on their behalf by a leader.',
        table: {
          columns: ['Who', 'Attending'],
          rows: attending.map((one) => [
            `${one.extra_members?.name ?? ''} ${one.extra_members?.surname ?? ''}`.trim() || 'an extra member',
            one.attending ? 'Coming' : 'Not coming',
          ]),
        },
        empty: 'No extra member has an answer for this function.',
      },
      ...(paying
        ? [
            {
              heading: 'Payments from extra members',
              table: {
                columns: ['Who', 'Paid', 'Promised by', 'Confirmed by', 'Receipt'],
                rows: paid.map((one) => [
                  `${one.extra_members?.name ?? ''} ${one.extra_members?.surname ?? ''}`.trim() || 'an extra member',
                  one.paid ? 'Paid' : 'Not yet',
                  dayOf(one.expected_pay_date),
                  `${one.confirmed?.name ?? ''} ${one.confirmed?.surname ?? ''}`.trim() || 'not checked',
                  one.proof_path ? nameOf(one.proof_path) : 'no receipt',
                ]),
              },
              empty: 'No payment is recorded for an extra member under this function.',
            },
            {
              heading: RECEIPTS,
              note: keepFiles
                ? 'Each file below is the proof as it was uploaded, pasted at the width of the page where a page can hold it and saved whole in this function\'s folder where it cannot. A file that could not be read is named anyway, with why.'
                : 'Each file below is the proof as it was uploaded, pasted at the width of the page with the address it came from under it. A file that could not be read is named anyway, with why.',
              entries: receiptList.map((item, index) => ({
                heading: `${item.who} — ${item.name}`,
                who: item.who,
                images: [loaded[index] || { path: item.path, name: item.name, reason: 'it was not read' }],
              })),
              lines: receiptList.length ? [] : ['Nothing was attached to any payment under this function.'],
            },
          ]
        : []),
    ],
    footer: `${one.name || 'A function'}${one.function_date ? ` — ${dayOf(one.function_date)}` : ''}`,
  }
}

// Where one person's money stands, in the four states a payment row is allowed to be in.
function money(person, one) {
  if (person.paid && confirmed(person)) {
    const name = spoken(person.confirmed_by_label, person.confirmed_by)
    return `${amount(one)} paid, checked by ${name === NO_NAME ? NO_LEADER : name} on ${momentOf(person.confirmed_at)}`
  }
  if (person.paid) return 'Paid, waiting for somebody to check the receipt'
  if (person.expected_pay_date) return `Promised by ${dayOf(person.expected_pay_date)}`
  return 'Nothing recorded yet'
}

function said(person) {
  if (person.attending === true) return 'Coming'
  if (person.attending === false) return 'Not coming'
  return 'Has not said either way'
}

/*
  The receipts of a built spec as files rather than as pictures on a page, in the order the document
  prints them so `03_…` in a folder is the third entry under Payment receipts. Only a file that came
  back with bytes is listed: one that refused to load has nothing to save, and the page already says so
  where the picture would have been.

  `who` travels with it because the bucket renames an upload to something nobody can read — the person
  is the only part of the name that means anything next to a filename like `1704883200123.jpg`.
*/
export function receiptFiles(spec) {
  const section = (spec?.sections || []).find((one) => one.heading === RECEIPTS)
  const files = []
  for (const entry of section?.entries || []) {
    for (const image of entry.images || []) {
      if (!image?.blob) continue
      files.push({ who: entry.who || 'a payment', name: image.name, path: image.path, blob: image.blob, bytes: image.bytes })
    }
  }
  return files
}

/*
  One function read from start to finish, for a caller that has the ids and wants the document: the
  register from the leader's tier, the extra members' two tables from the server, the spec built out of
  them, and the PDF rendered. The money table is only read under a function that asks for money — a free
  plan has no reason to hold a payment row, and reading for one is a round trip that answers nothing.

  `detail` may be handed in by the page that is already showing it, which is what makes the PDF an
  export of what was read rather than a second, possibly different, read. It is optional because the
  archive of every function has no screen to borrow from.

  `files` is for that archive: it asks for the receipts to be carried as files as well, and they come
  back on `attachments`. A caller that saves one PDF and nothing else leaves it off, because the bytes
  would be fetched, held, and thrown away.
*/
export async function buildFunctionPdf(
  { community_id, function_id, name, detail: given, files = false },
  { onProgress } = {},
) {
  const detail = given || (await functions.getFunctionDetails({ community_id, function_id }))
  const paying = Boolean(detail?.function?.requires_payment)
  const [attending, paid] = await Promise.all([
    extra.getFunctionAttending(function_id).catch(() => []),
    paying ? extra.getFunctionPaid(function_id).catch(() => []) : Promise.resolve([]),
  ])

  const spec = await functionSpec({ detail, attending: attending || [], paid: paid || [] }, { onProgress, keepFiles: files })
  const title = name || spec.title
  return { spec, title, blob: await renderPdf(spec), attachments: files ? receiptFiles(spec) : [] }
}
