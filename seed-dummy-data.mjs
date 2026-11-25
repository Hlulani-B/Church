/*
  Dummy data for the whole app, in simple words.

  One community admin is baloyihlulani91@gmail.com, and every table gets real rows: a second
  community and twenty-two people spread over the two fellowships as one admin, three leaders and
  eighteen members, check-in sessions (one past, one coming, one called off), attendance with
  arrivals and apologies — including absences recorded FOR somebody else with a recorded_by, the way
  the new For-who box writes them — testimonies shared in plain words that are STORED encrypted
  through the app's own addTestimony (type 'text', so the body and the address go into the table as
  `enc:v1:` ciphertext), feedback, and servings.

  It runs through the same vitest setup as the encryption seed, because that is what gives the
  browser page functions their import.meta.env:

    npx vitest run --config vitest.encryption.config.js seed-dummy-data

  Every line here is written by the app's own classes (User, Community, CommunityMember,
  Session, Event, Feedback, ChurchFunctions) or by the real addTestimony; the cleanup at the top,
  the servings rows and the bulk answer pass reach Supabase directly, because a row at a time
  through the app's own writes would be thousands of requests for what a handful of batched upserts
  say at once. Re-running replaces the dummy communities instead of stacking duplicates.

  The second test below adds 50 more encrypted testimonies on top, each authorised to
  baloyihlulani91@gmail.com alone. It refuses to run twice — the bulk rows are APPENDED, so
  clearing them is left to you (delete the ones you do not want on the admin testimonies
  screen, or drop their rows in Supabase) before seeding another batch.

  The third test fills both dummy fellowships with a calendar of planned functions — past ones for
  the leader's register to look back on and plenty still to come for the available list and the RSVP
  page. It appends too, and it leaves a fellowship that already has functions alone.

  The fourth test answers that calendar: who is coming, who put a receipt up, who only gave a date,
  and which of those receipts a leader has signed off. It leaves some people not having answered at
  all, because a register where everybody replied tells you nothing about what the tallies look like.
  The sample receipts go into the same `kopano` bucket the browser uploads to, so the proof on the
  RSVP page opens a real document instead of a dead address: about half of them are PDF pages written
  here out of nothing, and about half are photographs fetched from picsum.photos, because the screen
  that shows a proof has to be seen holding both kinds.

  The fifth test makes sure nobody on either roster is a blank on the screens: every one of the
  twenty-two people gets at least one testimony, at least one attendance row, a serving row of their
  own and an answer under at least one function. It only fills what is missing — a person the passes
  above already covered is left exactly as they are — so it can be run on its own after adding another
  name to PEOPLE.

  The sixth test seeds the two extra tables the dashboards read for the people who never open the app:
  a handful of names in extra_members and the gatherings recorded against them in extra_event, spread
  over the recent Sundays — some came, some sent word they would not with a reason, some only had
  their name written down. It clears just these fellowships' extra rows before writing, so it too can
  be run on its own without stacking a second crowd.
*/
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Web Crypto for the encryption helpers, the same way the browser hands it to the app.
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto')
  globalThis.crypto = webcrypto
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
)

// The very key the browser app inlines, so these rows decrypt on screen later.
import.meta.env.VITE_TESTIMONY_ENC_KEY = env.VITE_TESTIMONY_ENC_KEY

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const ADMIN = 'baloyihlulani91@gmail.com'
const JHB = { latitude: -26.2041, longitude: 28.0473 }

const PEOPLE = [
  { email: ADMIN, name: 'Baloyi', surname: 'Hlulani' },
  { email: 'thoko.mahlangu@example.com', name: 'Thoko', surname: 'Mahlangu' },
  { email: 'joshua.dlamini@example.com', name: 'Joshua', surname: 'Dlamini' },
  { email: 'grace.ndlovu@example.com', name: 'Grace', surname: 'Ndlovu' },
  { email: 'samuel.khumalo@example.com', name: 'Samuel', surname: 'Khumalo' },
  { email: 'david.zwane@example.com', name: 'David', surname: 'Zwane' },
  { email: 'annah.mokona@example.com', name: 'Annah', surname: 'Mokona' },
  { email: 'ruth.sibiya@example.com', name: 'Ruth', surname: 'Sibiya' },
  { email: 'sipho.mthembu@example.com', name: 'Sipho', surname: 'Mthembu' },
  { email: 'lerato.molefe@example.com', name: 'Lerato', surname: 'Molefe' },
  { email: 'brian.odendaal@example.com', name: 'Brian', surname: 'Odendaal' },
  { email: 'ntsako.maluleke@example.com', name: 'Ntsako', surname: 'Maluleke' },
  { email: 'mmapula.sekhuhu@example.com', name: 'Mmapula', surname: 'Sekhuhu' },
  { email: 'tinashe.chikwava@example.com', name: 'Tinashe', surname: 'Chikwava' },
  { email: 'zanele.kunene@example.com', name: 'Zanele', surname: 'Kunene' },
  { email: 'pieter.vanwyk@example.com', name: 'Pieter', surname: 'van Wyk' },
  { email: 'joy.mabasa@example.com', name: 'Joy', surname: 'Mabasa' },
  { email: 'sibusiso.gumede@example.com', name: 'Sibusiso', surname: 'Gumede' },
  { email: 'martha.pillay@example.com', name: 'Martha', surname: 'Pillay' },
  { email: 'kelvin.osei@example.com', name: 'Kelvin', surname: 'Osei' },
  { email: 'thandeka.ngobese@example.com', name: 'Thandeka', surname: 'Ngobese' },
  { email: 'abdul.osman@example.com', name: 'Abdul', surname: 'Osman' },
]

// Who sits in which fellowship, and what they are there. A person in both rows is in both
// fellowships, the way somebody who moves between two halls is in real life — the screens are always
// read one community at a time, so nothing here has to allow for the overlap.
const MEMBERSHIP = [
  { email: ADMIN, community: 'Grace Point Fellowship', role: 'admin' },
  { email: 'thoko.mahlangu@example.com', community: 'Grace Point Fellowship', role: 'leader' },
  { email: 'sibusiso.gumede@example.com', community: 'Grace Point Fellowship', role: 'leader' },
  { email: 'joshua.dlamini@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'grace.ndlovu@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'samuel.khumalo@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'david.zwane@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'annah.mokona@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'ruth.sibiya@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'sipho.mthembu@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'lerato.molefe@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'brian.odendaal@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'ntsako.maluleke@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'mmapula.sekhuhu@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'tinashe.chikwava@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'zanele.kunene@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'pieter.vanwyk@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'joy.mabasa@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: ADMIN, community: 'Stream of Hope Fellowship', role: 'admin' },
  { email: 'thoko.mahlangu@example.com', community: 'Stream of Hope Fellowship', role: 'leader' },
  { email: 'zanele.kunene@example.com', community: 'Stream of Hope Fellowship', role: 'leader' },
  { email: 'joshua.dlamini@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
  { email: 'martha.pillay@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
  { email: 'kelvin.osei@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
  { email: 'thandeka.ngobese@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
  { email: 'abdul.osman@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
]

// Words for the bulk pass: five lists of five, crossing into 625 different sentences, so
// 50 testimonies never read as the same line twice.
function simpleWords(one) {
  const pick = (list) => list[one % list.length]
  const openings = [
    'I want to say thank you God.',
    'God has been good to me.',
    'I must give God the glory.',
    'Only God knows what I have been through.',
    'This year taught me to pray more.',
  ]
  const hardParts = [
    'Last year I lost my job and I did not know how I would feed my children.',
    'I was sick for a long time and I was afraid.',
    'We had big problems at home and I could not sleep.',
    'I had no money for school fees and I did not know what to do.',
    'My mother was very sick in the hospital.',
  ]
  const answers = [
    'God answered through this church family.',
    'The leaders prayed with me and helped me.',
    'Brothers and sisters stood beside me.',
    'God gave me strength every single day.',
    'A way opened that I never saw coming.',
  ]
  const closings = [
    'I want to thank everyone who helped me.',
    'I will serve back in this church.',
    'God is faithful.',
    'I am so happy today.',
    'To God be all the glory.',
  ]
  return `${pick(openings)} ${pick(hardParts)} ${pick(answers)} ${pick(closings)}`
}

// A few metres off the hall, so a check-in row reads as a phone stood in the room.
const near = (one) => ({
  latitude: JHB.latitude + one * 0.0004,
  longitude: JHB.longitude + one * 0.0003,
})

/*
  A spread in [0, 1) that is always the same for the same numbers. FNV-1a, because it needs no import
  and no secrecy — its only job is to decide who stayed home. Both passes that answer functions fold
  their choices from it, which is what makes a second run write the same rows the first one did rather
  than starting a second crowd.
*/
function roll(...nums) {
  let h = 2166136261
  for (const n of nums) {
    h ^= Math.trunc(n)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000
}

// The same fold for a word rather than a number, so a choice can be keyed on an address.
function foldOf(words) {
  let h = 2166136261
  for (const letter of String(words)) {
    h ^= letter.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4_294_967_296
}

/*
  The sample proof files the seeded receipts point at, in the same `kopano` bucket the browser
  uploads to, so that the proof on the RSVP page and in the leader's Proof column opens something
  real instead of a dead address.

  Two kinds, because the screen has to be seen holding both. A PDF is text under the hood, so the
  page written here needs no library: a Helvetica line at a fixed position for each row of words on an
  A4 box. The other kind is a photograph fetched from picsum.photos, whose /seed/<name>/ address
  answers the same picture for the same name for as long as that service is up — so a receipt that was
  a photograph on the first run is the same photograph on the second, and the viewer shows a real
  camera image rather than a rectangle of grey.

  Which kind a person gets is folded from their address, and stays the same for every one of their
  receipts. The browser's own uploader puts a file at functions/<person>/<function id>/<uuid>.pdf for
  every answer; the seed keeps one file per person and points all of theirs at it, because two hundred
  copies of the same file would only make these passes slow. `upsert` is on here and the app
  deliberately leaves it off — a seed rewriting its own sample is nothing like a member overwriting
  evidence somebody already looked at.
*/
const BUCKET = 'kopano'
const folderOf = (email) => String(email).replace(/[^a-z0-9._-]/gi, '_').toLowerCase()

function pdfOf(lines) {
  const clean = (words) => words.replace(/[^\x20-\x7E]/g, '').replace(/[\\()]/g, '')
  const body = lines
    .map(
      (line, i) =>
        `BT /F1 ${i === 0 ? 20 : 12} Tf 60 ${780 - i * 30} Td (${clean(line)}) Tj ET`,
    )
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((one, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${one}\nendobj\n`
  })
  const startxref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`
  return { file: new Blob([pdf], { type: 'application/pdf' }), ext: 'pdf' }
}

// One photograph from online, or nothing when the run has no internet to fetch it with.
async function photoOf(email) {
  const seed = folderOf(email).replace(/[^a-z0-9]/gi, '')
  try {
    const answer = await fetch(`https://picsum.photos/seed/${seed}/800/1100`)
    if (!answer.ok) throw new Error(`the picture service answered HTTP ${answer.status}`)
    const type = answer.headers.get('content-type') || 'image/jpeg'
    if (!type.startsWith('image/')) throw new Error(`the picture service answered ${type}`)
    const ext = (type.split('/')[1] || 'jpeg').replace(/[^a-z0-9]/g, '')
    return { file: new Blob([await answer.arrayBuffer()], { type }), ext }
  } catch (e) {
    // A run with no internet still gets a well-shaped proof: the receipt falls back to the page
    // written out here rather than to a url that would 404 on screen.
    console.log(`  (the online picture for ${email} could not be fetched: ${e.message})`)
    return null
  }
}

const sampleProof = new Map()
async function receiptFor(email, label) {
  if (sampleProof.has(email)) return sampleProof.get(email)
  const chosen = foldOf(email) < 0.5 ? await photoOf(email) : null
  const proof =
    chosen ||
    pdfOf([
      'Proof of payment (sample)',
      '',
      `Paid by: ${label}`,
      `Email : ${email}`,
      'Amount: as the function asks',
      'Method: manual deposit, reference SEEDED',
      '',
      'This page was written by seed-dummy-data.mjs so that the',
      'receipt link on the RSVP screen opens a real document.',
      "It is not anybody's bank confirmation.",
    ])
  const path = `functions/${folderOf(email)}/seed/receipt.${proof.ext}`
  try {
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, proof.file, { contentType: proof.file.type, upsert: true })
    if (error) throw error
  } catch (e) {
    // The row still gets a well-shaped url; a bucket that refuses an upload is a thing to read about
    // rather than a reason to leave the whole pass unwritten.
    console.log(`  (the sample receipt for ${email} could not be uploaded: ${e.message})`)
  }
  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  sampleProof.set(email, url)
  return url
}

describe('seed dummy data (all tables, kept in DB)', () => {
  it('fills every table for baloyihlulani91@gmail.com', async () => {
    // --- 1. Clear the last run. The app never deletes a community, so this is the one
    //         stretch that goes straight to the table; users, feedback and testimonies of
    //         past runs are cleared with it so a re-run does not stack duplicates.
    const { data: oldCommunities } = await db
      .from('community')
      .select('community_id, name')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
    for (const one of oldCommunities || []) {
      for (const table of [
        'testimony', 'event', 'session', 'servings', 'community_members',
        // The extra tables hang off the same community. Whether or not those keys cascade, emptying
        // the gatherings and then the members before the community itself is deleted below keeps a
        // re-run from tripping a foreign key on leftover extra rows from the last one.
        'extra_event', 'extra_members',
      ]) {
        const { error } = await db.from(table).delete().eq('community_id', one.community_id)
        if (error) throw new Error(`cleanup ${table}: ${error.message}`)
      }
      const { error } = await db.from('community').delete().eq('community_id', one.community_id)
      if (error) throw new Error(`cleanup community: ${error.message}`)
    }
    // feedback is the one table without a community_id, so its rows from the last run are
    // cleared by the addresses this seed signs them with; everything else went with the
    // communities above.
    const everyEmail = PEOPLE.map((one) => one.email)
    await db.from('feedback').delete().in('email', everyEmail)

    // --- 2. users: the app's own class, and it only ever creates what is not there yet.
    const { User } = await import('./src/functions/user.js')
    const users = new User(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    for (const one of PEOPLE) {
      const found = await users.find(one.email)
      if (found) await users.update(one.email, { name: one.name, surname: one.surname })
      else await users.create(one)
    }
    console.log(`users: ${PEOPLE.length} created/updated, admin is ${ADMIN}`)

    // --- 3. community: two fellowships, each with a join code a person could type.
    const { Community } = await import('./src/functions/community.js')
    const communities = new Community(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const grace = await communities.create({ name: 'Grace Point Fellowship' })
    await communities.update(grace.community_id, { join_id: 'GRACE7' })
    const hope = await communities.create({ name: 'Stream of Hope Fellowship' })
    await communities.update(hope.community_id, { join_id: 'HOPE22' })
    const idOf = { 'Grace Point Fellowship': grace.community_id, 'Stream of Hope Fellowship': hope.community_id }

    // --- 4. community_members: who belongs where, and what role they hold.
    const { CommunityMember } = await import('./src/functions/community_members.js')
    const links = new CommunityMember(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    for (const one of MEMBERSHIP) {
      const found = await links.find(one.email, idOf[one.community])
      if (!found) await links.create({ email: one.email, community_id: idOf[one.community], role: one.role })
    }
    const perFellowship = MEMBERSHIP.reduce((seen, one) => {
      seen[one.community] = (seen[one.community] || 0) + 1
      return seen
    }, {})
    console.log(
      `community_members: ${MEMBERSHIP.length} places over ${PEOPLE.length} people — ` +
        Object.entries(perFellowship)
          .map(([name, count]) => `${count} in ${name}`)
          .join(', '),
    )

    // --- 5. session: three check-ins. Last Sunday's (now history), one called off, and one
    //         opened for a Sunday that has not come yet, so the For-who box has a gathering
    //         to place an advance apology against.
    const { Session } = await import('./src/functions/session.js')
    const sessions = new Session(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const leader = 'thoko.mahlangu@example.com'
    const past = await sessions.create({
      community_id: grace.community_id,
      pin: (await sessions.pin()).pin,
      created_by: leader,
      date: '2026-11-22',
      started_at: '2026-11-22T09:00:00+02:00',
      ended_at: '2026-11-22T11:00:00+02:00',
      event_name: 'Sunday Service',
      latitude: JHB.latitude,
      longitude: JHB.longitude,
      radius: 150,
      allow_any_radius: false,
    })
    const calledOff = await sessions.create({
      community_id: grace.community_id,
      pin: (await sessions.pin()).pin,
      created_by: leader,
      date: '2026-10-18',
      started_at: '2026-10-18T09:00:00+02:00',
      ended_at: '2026-10-18T11:00:00+02:00',
      event_name: 'Sunday Service (called off)',
      latitude: JHB.latitude,
      longitude: JHB.longitude,
      radius: null,
      allow_any_radius: true,
    })
    await sessions.update(calledOff.session_id, { cancel: true })
    await sessions.create({
      community_id: grace.community_id,
      pin: (await sessions.pin()).pin,
      created_by: leader,
      date: '2026-12-06',
      started_at: '2026-12-06T09:00:00+02:00',
      ended_at: '2026-12-06T11:00:00+02:00',
      event_name: 'Sunday Service',
      latitude: JHB.latitude,
      longitude: JHB.longitude,
      radius: 150,
      allow_any_radius: false,
    })
    const bibleStudy = await sessions.create({
      community_id: hope.community_id,
      pin: (await sessions.pin()).pin,
      created_by: ADMIN,
      date: '2026-11-22',
      started_at: '2026-11-22T14:00:00+02:00',
      ended_at: '2026-11-22T15:30:00+02:00',
      event_name: 'Bible Study',
      latitude: JHB.latitude,
      longitude: JHB.longitude,
      radius: null,
      allow_any_radius: true,
    })
    console.log(`session: 4 opened, one of them cancelled`)

    // --- 6. event: the register. Arrivals carry the session they were checked in at, an
    //         apology carries a reason and a recorded_by — including two recorded FOR other
    //         people by the admin, exactly the shape the For-who box writes.
    const { Event } = await import('./src/functions/event.js')
    const gatherings = new Event(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const arrive = (email, session, day, offset, at) =>
      gatherings.record({
        community_id: session.community_id,
        event_date: day,
        event_name: session.event_name,
        user_email: email,
        attend: true,
        reason: null,
        recorded_by: email,
        session_id: session.session_id,
        checked_in_at: at,
        checkin_latitude: near(offset).latitude,
        checkin_longitude: near(offset).longitude,
        latitude: session.latitude,
        longitude: session.longitude,
      })
    await arrive(leader, past, '2026-11-22', 0, '2026-11-22T09:05:00+02:00')
    await arrive('joshua.dlamini@example.com', past, '2026-11-22', 1, '2026-11-22T09:12:00+02:00')
    await arrive('grace.ndlovu@example.com', past, '2026-11-22', 2, '2026-11-22T09:15:00+02:00')
    await arrive('samuel.khumalo@example.com', past, '2026-11-22', -1, '2026-11-22T09:20:00+02:00')
    await arrive('annah.mokona@example.com', past, '2026-11-22', -2, '2026-11-22T09:31:00+02:00')
    await arrive(ADMIN, bibleStudy, '2026-11-22', 0, '2026-11-22T14:04:00+02:00')
    await arrive('thoko.mahlangu@example.com', bibleStudy, '2026-11-22', 1, '2026-11-22T14:10:00+02:00')

    // An older gathering with no session behind it, and apologies with a hand on them.
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-11-15',
      event_name: 'Sunday Service',
      user_email: leader,
      attend: true,
      reason: null,
      recorded_by: leader,
    })
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-11-15',
      event_name: 'Sunday Service',
      user_email: 'joshua.dlamini@example.com',
      attend: true,
      reason: null,
      recorded_by: leader,
    })
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-11-15',
      event_name: 'Sunday Service',
      user_email: 'ruth.sibiya@example.com',
      attend: false,
      reason: 'Transport',
      recorded_by: ADMIN,
    })
    // For-who apologies: the admin typed these for somebody else, so recorded_by is not the person.
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-11-22',
      event_name: 'Sunday Service',
      user_email: 'david.zwane@example.com',
      attend: false,
      reason: 'Work',
      recorded_by: ADMIN,
    })
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-12-06',
      event_name: 'Sunday Service',
      user_email: 'david.zwane@example.com',
      attend: false,
      reason: 'Family',
      recorded_by: ADMIN,
    })
    // An advance apology sent by the member themselves, and a day nobody has taken yet.
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-12-06',
      event_name: 'Sunday Service',
      user_email: 'ruth.sibiya@example.com',
      attend: false,
      reason: 'Sick',
      recorded_by: 'ruth.sibiya@example.com',
    })
    await gatherings.record({
      community_id: grace.community_id,
      event_date: '2026-12-06',
      event_name: 'Sunday Service',
      user_email: 'joshua.dlamini@example.com',
      attend: null,
      reason: null,
      recorded_by: null,
    })
    console.log('event: 17 rows — arrivals, own notices, For-who apologies, one not-taken-yet')

    // --- 7. testimony: shared in simple words, and stored encrypted by the app's OWN
    //         addTestimony (type 'text'): the body and the author's address go into the
    //         table as `enc:v1:` ciphertext; the screen decrypts both.
    const { TestimoniesFetch } = await import('./src/page_functions/testimonies.js')
    const { encryptText, decryptText } = await import('./src/page_functions/crypto.js')
    const testimonies = new TestimoniesFetch(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const shared = [
      {
        email: ADMIN,
        community_id: grace.community_id,
        date: '2026-11-22',
        words: 'God healed my back after two years of pain. I stood the whole service today.',
        allow_all: true,
        authorise: [],
      },
      {
        email: leader,
        community_id: grace.community_id,
        date: '2026-11-22',
        words: 'We had no food last month. On Wednesday a neighbour left groceries at our gate. God sees us.',
        allow_all: true,
        authorise: [],
      },
      {
        email: 'joshua.dlamini@example.com',
        community_id: grace.community_id,
        date: '2026-11-15',
        words: 'After six months of looking, God gave me a job. I start on Monday.',
        allow_all: true,
        authorise: [],
      },
      {
        email: 'grace.ndlovu@example.com',
        community_id: grace.community_id,
        date: '2026-11-15',
        words: 'I am fighting worry again at night. I keep this one between me and my leaders.',
        allow_all: false,
        authorise: [ADMIN, leader],
      },
      {
        email: 'samuel.khumalo@example.com',
        community_id: grace.community_id,
        date: '2026-10-11',
        words: 'My son came back home to God after a long time away. We praised Him at the table.',
        allow_all: true,
        authorise: [],
      },
      {
        email: 'joshua.dlamini@example.com',
        community_id: hope.community_id,
        date: '2026-11-22',
        words: 'The Bible study helped me understand Psalm 23. The Lord is my shepherd, I have enough.',
        allow_all: true,
        authorise: [],
      },
    ]
    for (const one of shared) {
      try {
        await testimonies.addTestimony({ ...one, body: one.words, type: 'text' })
      } catch (e) {
        if (!/foreign key|row-level security|permission/.test(e.message)) throw e
        // Same code, same encrypted columns — only the door is the service key, for databases
        // that still hold the old users(email) foreign key or an anon-insert policy.
        const sealed = await encryptText(one.words)
        const sealedEmail = await encryptText(one.email)
        const { error } = await db.from('testimony').insert({
          community_id: one.community_id,
          user_email: sealedEmail,
          date: one.date,
          body: sealed,
          type: 'text',
          allow_all: one.allow_all,
          authorise: one.authorise,
        })
        if (error) throw new Error(`testimony fallback: ${error.message}`)
      }
    }
    console.log('testimony: 6 text testimonies, bodies and addresses stored as enc:v1: ciphertext')

    // --- 8. feedback: what people said about the app, in the app's own words, signed.
    const { Feedback } = await import('./src/functions/feedback.js')
    const feedback = new Feedback(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    await feedback.create({
      stars: 5,
      solves_problem: true,
      improvements: 'Taking the register by PIN is faster than the paper list.',
      additions: 'It would help to see last month attendance in one screen.',
      most_challenging: 'None so far.',
      email: ADMIN,
    })
    await feedback.create({
      stars: 4,
      solves_problem: true,
      improvements: 'The check-in window is good.',
      additions: null,
      most_challenging: 'Some phones refuse to share their location, so I turn on the any-place option.',
      email: leader,
    })
    await feedback.create({
      stars: 3,
      solves_problem: false,
      improvements: null,
      additions: 'Please make the login page remember my last community.',
      most_challenging: 'Finding the right community took a while.',
      email: 'joshua.dlamini@example.com',
    })
    console.log('feedback: 3 rows')

    // --- 9. servings: the roles the standalone server keeps, written to match the roster.
    const { data: nameOf } = await db.from('users').select('email, name, surname').in('email', everyEmail)
    const servingRows = MEMBERSHIP.map((one) => {
      const who = nameOf.find((person) => person.email === one.email)
      return {
        email: one.email,
        name: who.name,
        surname: who.surname,
        role: one.role,
        community_id: idOf[one.community],
      }
    })
    // servings has no unique constraint but its own id, so this is a plain insert — safe
    // between runs because the cleanup above already emptied these communities' rows.
    const { error: sErr } = await db.from('servings').insert(servingRows)
    if (sErr) throw new Error(`servings: ${sErr.message}`)
    console.log(`servings: ${servingRows.length} rows`)

    // --- 10. Proof of the round trip: read the stored row exactly as Supabase holds it,
    //         then open it exactly as the screen does.
    const { data: stored } = await db
      .from('testimony')
      .select('user_email, body, type, allow_all')
      .eq('community_id', grace.community_id)
      .eq('type', 'text')
      .order('date', { ascending: false })
    console.log('\n=== what is in the database vs what the screen shows ===')
    for (const row of stored) {
      const email = await decryptText(row.user_email)
      const words = await decryptText(row.body)
      console.log(`stored : ${row.body.slice(0, 24)}…  |  screen: ${email} — “${words}”`)
    }
    expect(stored.length).toBeGreaterThan(0)
    expect(stored.every((row) => String(row.body).startsWith('enc:v1:'))).toBe(true)
    // Twenty-two people, two fellowships and a register each means well over a hundred separate
    // writes through the app's own classes, which at a round trip apiece is more than the 60 seconds
    // this file's config gives a test by default.
  }, 180_000)

  it('adds 50 encrypted testimonies authorised to baloyihlulani91@gmail.com only', async () => {
    // --- Runs on top of the data above and does not clean up after itself: these rows are
    //     APPENDED, so a second run would stack another 50. The guard reads the stored
    //     authorise column — plaintext here, because only the body and the address are sealed.
    const { data: bulk } = await db
      .from('testimony')
      .select('testimony_id')
      .eq('allow_all', false)
      .contains('authorise', [ADMIN])
    if ((bulk || []).length >= 50) {
      console.log(`bulk testimonies: ${bulk.length} rows already authorised to ${ADMIN}, nothing added`) 
      console.log('delete them first if you want a fresh batch — this pass only appends')
      return
    }

    // --- The same door the app uses: TestimoniesFetch.addTestimony seals the body and the
    //     author's address into enc:v1: ciphertext before they ever reach the table.
    const { TestimoniesFetch } = await import('./src/page_functions/testimonies.js')
    const { decryptText } = await import('./src/page_functions/crypto.js')
    const testimonies = new TestimoniesFetch(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: communities } = await db
      .from('community')
      .select('community_id')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
    if (!communities?.length) throw new Error('run the first test before this one')

    // Spread over the last twelve weeks, cycling the roster and the two fellowships.
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const dayStamp = (back) => new Date(today.getTime() - back * 86_400_000).toISOString().slice(0, 10)
    for (let one = 0; one < 50; one++) {
      const who = PEOPLE[one % PEOPLE.length]
      await testimonies.addTestimony({
        email: who.email,
        community_id: communities[one % communities.length].community_id,
        date: dayStamp(2 + one * 17 % 84),
        body: simpleWords(one),
        type: 'text',
        // shared in simple words, but only the admin is let in on them
        allow_all: false,
        authorise: [ADMIN],
      })
    }
    console.log('testimony: 50 more text rows, enc:v1: at rest, authorise = [admin]')

    // --- Proof of the round trip, bulk edition: what the table holds next to what the
    //     screen makes of it.
    const { data: stored } = await db
      .from('testimony')
      .select('user_email, body, allow_all, authorise')
      .eq('allow_all', false)
      .contains('authorise', [ADMIN])
      .order('date', { ascending: false })
      .limit(3)
    console.log('\n=== stored ciphertext vs decrypted on screen (bulk sample) ===')
    for (const row of stored) {
      const email = await decryptText(row.user_email)
      const words = await decryptText(row.body)
      console.log(`stored : ${row.body.slice(0, 24)}…  |  screen: ${email} — “${words}”`)
    }
    const { count } = await db
      .from('testimony')
      .select('*', { count: 'exact', head: true })
      .eq('allow_all', false)
      .contains('authorise', [ADMIN])
    console.log(`bulk rows now in the table: ${count}`)
    expect(count).toBeGreaterThanOrEqual(50)
  }, 180_000)

  it('fills both dummy fellowships with a lot of planned functions', async () => {
    /*
      A calendar of gatherings, so the functions register, the opened-out function and the member's
      available list and RSVP page all have something to show without anybody planning anything by
      hand. The writing goes through the app's own ChurchFunctions.create — the same class the pages
      reach — which is what keeps the price honest on its own: a function that asks for nothing is
      stored with no amount, so nothing here can trip the table's amount check.

      This pass only appends, and a fellowship that already has any function is left alone rather
      than topped up, so running it twice adds nothing the second time. The first test in this file
      does clear these rows, because functions.community_id cascades from community: wiping the dummy
      fellowships wipes their gatherings with them, and then this pass can seed a fresh calendar.

      To run only this one:

        npx vitest run --config vitest.encryption.config.js seed-dummy-data -t "planned functions"
    */
    const { ChurchFunctions } = await import('./src/functions/church_functions.js')
    const planner = new ChurchFunctions(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const NAMES = [
      'Youth Breakfast',
      'Women’s Tea',
      'Men’s Braai',
      'Annual Congress',
      'Easter Convention',
      'Christmas Party',
      'Harvest Thanksgiving',
      'Community Outreach Day',
      'Bible Training Seminar',
      'Marriage Enrichment Day',
      'Children’s Nativity',
      'New Year Thanksgiving Service',
      'All-Night Prayer Vigil',
      'Back-to-School Drive',
      'District Meeting',
      'Solo Gospel Evening',
      'Neighbour Care Package Day',
      'Leaders’ Planning Day',
    ]
    // A null is left in on purpose: plenty of real functions never get a place written down.
    const PLACES = [
      'Church hall, 12 Mofolo Road',
      'Community Centre, Morningside',
      'Johannesburg Town Hall',
      'The big green tent behind the hall',
      'School hall, Orlando East',
      null,
      'Backyard at 44 Vilakazi Street',
      'Online — the link is sent later',
      'Stream of Hope hall, second floor',
      null,
    ]
    const COSTS = [50, 80, 100, 150, 200, 250, 300, 350, 500, 1200]
    // Where the calendar starts and ends, in days from today: the register needs gatherings that have
    // gone by, the available list needs ones that have not, so every span crosses today.
    const PLAN = {
      'Grace Point Fellowship': { total: 42, from: -120, to: 240 },
      'Stream of Hope Fellowship': { total: 18, from: -60, to: 200 },
    }

    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const dayOn = (offset) =>
      new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10)

    const { data: fellowships } = await db
      .from('community')
      .select('community_id, name')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
      .order('name')
    if (!fellowships?.length) throw new Error('run the first test before this one')

    let added = 0
    let still_to_come = 0
    let asking = 0
    for (const [group, one] of fellowships.entries()) {
      const { count } = await db
        .from('functions')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', one.community_id)
      if (count) {
        console.log(`${one.name}: ${count} functions already planned, nothing added`)
        continue
      }
      /*
        Only an address the users table knows can plan one, so the RSVP page's "Planned by" is a name
        and surname rather than an email — the class reads names off `users` in a second pass, and an
        address with no row there keeps itself as its own label.
      */
      const { data: roll } = await db
        .from('community_members')
        .select('email')
        .eq('community_id', one.community_id)
      const { data: known } = await db
        .from('users')
        .select('email')
        .in('email', roll.map((person) => person.email))
      const hands = (known || []).map((person) => person.email)
      if (!hands.length) throw new Error(`${one.name} has no member the users table knows`)

      const { total, from, to } = PLAN[one.name] || { total: 24, from: -90, to: 210 }
      for (let i = 0; i < total; i++) {
        // Three in four ask for money, so the free ones and the priced ones are both well covered.
        const requires_payment = i % 4 !== 0
        const function_date = dayOn(Math.round(from + (i * (to - from)) / (total - 1)))
        await planner.create({
          community_id: one.community_id,
          // The offset keeps the two fellowships off the same list in the same order.
          name: NAMES[(i + group * 5) % NAMES.length],
          function_date,
          location: PLACES[(i + group) % PLACES.length],
          requires_payment,
          amount: requires_payment ? COSTS[i % COSTS.length] : null,
          created_by: hands[i % hands.length],
        })
        added++
        if (function_date >= today.toISOString().slice(0, 10)) still_to_come++
        if (requires_payment) asking++
      }
      console.log(`${one.name}: ${total} functions planned, spread from ${dayOn(from)} to ${dayOn(to)}`)
    }
    console.log(
      `functions: ${added} added — ${still_to_come} still to come, ${asking} of them asking for money`,
    )
    // Both fellowships already had a calendar, so this pass added nothing and there is nothing to
    // assert on — the guard above is the whole point of a second run.
    if (!added) return
    expect(added).toBeGreaterThan(0)

    // What the pages will now be handed, read the way the register reads it.
    const { data: sample } = await db
      .from('functions')
      .select('id, name, function_date, location, requires_payment, amount, created_by')
      .gte('function_date', today.toISOString().slice(0, 10))
      .order('function_date', { ascending: true })
      .limit(5)
    console.log('\n=== the first few a member would be offered ===')
    for (const row of sample) {
      const price = row.requires_payment ? `R ${row.amount}` : 'free'
      console.log(
        `${row.function_date}  ${row.name} — ${price}${row.location ? `, at ${row.location}` : ''}  (id ${row.id})`,
      )
    }
  }, 300_000)

  it('records who is coming and who has paid under every planned function', async () => {
    /*
      The two tables under the calendar, so that the register's Going / Paid / Promised columns, the
      opened-out function's list of names and the RSVP page's four states all have real answers behind
      them instead of noughts.

      What the RSVP page itself would write is what gets written here, and nothing more: an answer for
      somebody who never replies is not invented, no money row appears under a free function, no money
      row appears for a person who never answered, and every money row is either a receipt or a
      promise — the shape `paid_fields_match` on the table will enforce whether this file likes it or
      not, so a wrong shape here fails loudly instead of quietly seeding a nonsense row.

      `confirmed_by` and `confirmed_at` are the two columns no screen in the app writes yet, because a
      leader's confirm-payment action does not exist. They go on roughly half the receipts so the
      "confirmed by … on …" sentence can be seen with something behind it. When that write is built,
      these rows are what it will be signing off.

      Everything is upserted on (function_id, user_email), the same key `respond` uses, so a second
      run edits the same answers rather than starting a second crowd. The choices come from a fold
      over the function id and the person's place in the roster rather than from Math.random, so the
      second run picks the same people as the first.

      To run only this one:

        npx vitest run --config vitest.encryption.config.js seed-dummy-data -t "who is coming"
    */
    const { ChurchFunctions } = await import('./src/functions/church_functions.js')
    const reader = new ChurchFunctions(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const dayStart = (stamp) => new Date(`${stamp}T00:00:00Z`).getTime()
    const shift = (stamp, days) =>
      new Date(dayStart(stamp) + days * 86_400_000).toISOString().slice(0, 10)

    // `roll` and `receiptFor` — the same choices and the same sample proofs on every run — are
    // written once at the top of this file, beside the people whose answers they decide.

    // Answers are bulk-writeable in ones, not one at a time.
    const put = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db
          .from(table)
          .upsert(rows.slice(i, i + 200), { onConflict: 'function_id,user_email' })
        if (error) throw new Error(`${table}: ${error.message}`)
      }
    }

    const { data: fellowships } = await db
      .from('community')
      .select('community_id, name')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
      .order('name')
    if (!fellowships?.length) throw new Error('run the first test before this one')

    let answered = 0
    let silent = 0
    let coming = 0
    let receipts = 0
    let promises = 0
    let signed = 0
    let crossed = 0
    for (const group of fellowships) {
      const { data: planned, error: plannedError } = await db
        .from('functions')
        .select('id, function_date, requires_payment')
        .eq('community_id', group.community_id)
        .order('id')
      if (plannedError) throw plannedError
      if (!planned?.length) {
        console.log(`${group.name}: nothing planned, so nothing to answer`)
        continue
      }

      /*
        The roster in a fixed order: the person's place in it is half of what their answer is folded
        from, so sorting by email is what keeps the same crowd answering on the second run. Only
        addresses the users table knows are asked — an answer from a person with no row would show on
        screen as a bare email. `people` keeps the label as well, because the receipt page names who
        paid.
      */
      const { data: roster } = await db
        .from('community_members')
        .select('email, role')
        .eq('community_id', group.community_id)
      const { data: known } = await db
        .from('users')
        .select('email, name, surname')
        .in('email', roster.map((person) => person.email))
      const people = (known || [])
        .map((person) => ({
          email: person.email,
          label: `${person.name || ''} ${person.surname || ''}`.trim() || person.email,
        }))
        .sort((a, b) => a.email.localeCompare(b.email))
      if (!people.length) throw new Error(`${group.name} has no member the users table knows`)
      const emailsWithRoles = new Set(roster.map((person) => person.email))
      // Whoever signs off a receipt has to be somebody this fellowship actually holds as a leader or
      // an admin; a confirmation from a plain member would be a lie about a permission.
      const leaders = roster
        .filter((person) => (person.role === 'admin' || person.role === 'leader') && emailsWithRoles.has(person.email))
        .map((person) => person.email)
        .sort()

      const answers = []
      const money = []
      for (const f of planned) {
        const past = dayStart(f.function_date) < today.getTime()
        for (const [j, person] of people.entries()) {
          // One in seven never replied, and their absence is the honest thing on a register.
          if (roll(f.id, j, 7) < 0.15) {
            silent++
            continue
          }
          const comingNow = roll(f.id, j, 11) > 0.28
          answers.push({ function_id: f.id, user_email: person.email, attending: comingNow })
          answered++
          if (comingNow) coming++
          // Nobody is asked to pay for a gathering they have said they will not attend, and the two
          // sections of the register only stay distinguishable while that holds.
          if (!f.requires_payment || !comingNow) continue

          const about = roll(f.id, j, 13)
          // A fifth of those who answered said nothing about the money: no row at all, the state the
          // RSVP page calls "nothing recorded yet".
          if (about < 0.2) continue

          if (about < 0.62) {
            // A receipt. Uploaded before the day, and never in the future — for a function months
            // away it means "they have already paid", which is exactly what a vigil or a congress
            // contribution looks like.
            const submitted = new Date(
              Math.min(dayStart(f.function_date) - (6 + about * 90) * 3_600_000, Date.now() - 3_600_000),
            ).toISOString()
            const stamp = roll(f.id, j, 17)
            const confirmed =
              (past ? stamp < 0.7 : stamp < 0.35) && leaders.length
              ? {
                  confirmed_by: leaders[(f.id + j) % leaders.length],
                  confirmed_at: new Date(
                    Math.min(
                      new Date(submitted).getTime() + (6 + stamp * 72) * 3_600_000,
                      Date.now() - 1_800_000,
                    ),
                  ).toISOString(),
                }
              : { confirmed_by: null, confirmed_at: null }
            money.push({
              function_id: f.id,
              user_email: person.email,
              paid: true,
              expected_pay_date: null,
              proof_path: await receiptFor(person.email, person.label),
              proof_submitted_at: submitted,
              ...confirmed,
            })
            receipts++
            if (confirmed.confirmed_by) signed++
          } else {
            // A promise: a date and no proof. It sits around the day it was for, so some of them are
            // overdue by the time the register reads them, the way real ones are.
            money.push({
              function_id: f.id,
              user_email: person.email,
              paid: false,
              expected_pay_date: shift(f.function_date, Math.round(roll(f.id, j, 19) * 8) - 3),
              proof_path: null,
              proof_submitted_at: null,
              confirmed_by: null,
              confirmed_at: null,
            })
            promises++
          }
        }
      }

      await put('function_attending', answers)
      await put('function_paid', money)

      /*
        Money sitting beside a "not coming" answer. The tables allow it — a contribution sent by
        somebody who will not be there is a real thing — but on screen the same person then appears
        under "Promised a date" and under "Not attending", which reads as two sections that have been
        swapped. Nothing above writes such a row.

        A full run finds nothing to clear, because the first pass drops the two communities and every
        function row goes with them by cascade; this is for the run of a single pass on its own, which
        inherits whatever the last one left — including the rows written before this rule existed.
      */
      const ids = planned.map((one) => one.id)
      const { data: replies, error: repliesError } = await db
        .from('function_attending')
        .select('function_id, user_email, attending')
        .in('function_id', ids)
      if (repliesError) throw repliesError
      const { data: paidUp, error: paidUpError } = await db
        .from('function_paid')
        .select('function_id, user_email')
        .in('function_id', ids)
      if (paidUpError) throw paidUpError
      const notComing = new Set(
        (replies || [])
          .filter((row) => row.attending === false)
          .map((row) => `${row.function_id}|${row.user_email}`),
      )
      const strays = (paidUp || []).filter((row) =>
        notComing.has(`${row.function_id}|${row.user_email}`),
      )
      const byFunction = new Map()
      for (const row of strays) {
        byFunction.set(row.function_id, [...(byFunction.get(row.function_id) || []), row.user_email])
      }
      for (const [id, emails] of byFunction) {
        const { error: dropError } = await db
          .from('function_paid')
          .delete()
          .eq('function_id', id)
          .in('user_email', emails)
        if (dropError) {
          throw new Error(`clearing money rows under a not-coming answer: ${dropError.message}`)
        }
        crossed += emails.length
      }

      /*
        The rule, checked over what this fellowship now holds rather than trusted: the clear-up either
        emptied every one of these keys or the register will still read as swapped on screen.
      */
      const { data: left, error: leftError } = await db
        .from('function_paid')
        .select('function_id, user_email')
        .in('function_id', ids)
      if (leftError) throw leftError
      const stillCrossed = (left || []).filter((row) =>
        notComing.has(`${row.function_id}|${row.user_email}`),
      )
      expect(stillCrossed).toEqual([])
      console.log(
        `${group.name}: ${answers.length} answers recorded, ${money.length} of them about money`,
      )
    }

    console.log(
      `answers: ${answered} people replied (${coming} coming, ${silent} never answered) — ` +
        `${receipts} receipts up (${signed} confirmed by a leader), ${promises} dates promised` +
        (crossed ? `, ${crossed} money rows cleared from under a "not coming" answer` : ''),
    )
    if (!answered) return
    expect(answered).toBeGreaterThan(0)

    // --- What the three screens are now handed, read through the app's own class rather than SQL.
    const first = fellowships[0]
    const register = await reader.list({ community_id: first.community_id })
    console.log('\n=== the register a leader reads (first five) ===')
    for (const one of register.slice(0, 5)) {
      console.log(
        `${one.function_date}  ${one.name}: ${one.going} going, ${one.paid} paid, ${one.promised} promised`,
      )
    }

    const open = register.find((one) => one.paid > 0)
    if (open) {
      const { people } = await reader.details({ community_id: first.community_id, function_id: open.id })
      console.log(`\n=== opened out: ${open.name} — ${people.length} names, first three ===`)
      for (const person of people.slice(0, 3)) {
        const state = person.paid
          ? `paid, proof ${person.confirmed_by ? `confirmed by ${person.confirmed_by}` : 'waiting for a leader'}`
          : person.expected_pay_date
            ? `promised ${person.expected_pay_date}`
            : 'nothing said about money'
        console.log(`${person.label}: ${person.attending ? 'coming' : 'not coming'} — ${state}`)
      }
    }

    // The member's own screen: one person who has a receipt a leader has signed off, read the way the
    // RSVP page reads it — the plan, who planned it, and what the two tables say about that address.
    // The link is fetched as well, because a proof of payment that 404s is a broken screen however
    // well the row is shaped.
    const mine = await reader.available({ community_id: first.community_id })
    console.log('\n=== the RSVP page a member sees ===')
    console.log(
      `${mine.length} functions still to come in ${first.name}, soonest ${mine[0]?.function_date}`,
    )

    const ids = new Set(register.map((one) => one.id))
    const { data: signedRows } = await db
      .from('function_paid')
      .select('function_id, user_email, proof_path')
      .eq('paid', true)
      .not('confirmed_by', 'is', null)
      .limit(50)
    const shown = (signedRows || []).find((row) => ids.has(row.function_id))
    if (shown) {
      const view = await reader.rsvp({
        community_id: first.community_id,
        function_id: shown.function_id,
        user_email: shown.user_email,
      })
      const standing = view.you
      console.log(
        `${view.function.name} on ${view.function.function_date}, planned by ${view.planned_by}`,
      )
      console.log(
        `${shown.user_email}: ${standing.attending ? 'coming' : 'not coming'}, paid=${standing.paid}, ` +
          `confirmed by ${standing.confirmed_by_label} on ${standing.confirmed_at}`,
      )
      const opened = await fetch(shown.proof_path)
      console.log(`the receipt file opens: HTTP ${opened.status}`)
    }
  }, 300_000)

  it('gives every one of the dummy people a testimony, an attendance row, a serving and a function answer', async () => {
    /*
      Most of the app is read one person at a time: a testimony search by name, an attendance register
      by Sunday, an opened-out function with one member's answer under it, a servings list with a role
      beside each name. A person with no rows anywhere reads as a hole in the app rather than as a
      quiet member, so every address on either dummy roster is topped up to having at least one of each
      of the four things those screens show — and nothing that is already there is touched.

      That last part is why this is its own pass rather than more lines in the first one. Each of the
      four writes here asks the table what it already holds and skips what is covered, so the pass can
      be run on its own straight after adding a name to PEOPLE, and running it twice cannot stack a
      second testimony or a second serving for anybody. Testimonies and servings have no unique key to
      upsert against, so their "already covered" is read out of the table first — and for testimonies
      that means decrypting the stored author, because `user_email` goes in as ciphertext the same as
      the body does.

      Three of the four go through the app's own classes rather than straight to the tables:
      `addTestimony` seals the words the way a real sharing is sealed, `Event.record` writes the row a
      check-in or an apology actually makes, and `ChurchFunctions.respond` is the member's own write,
      which cannot produce a money shape the checks on `function_paid` would refuse. Only servings has
      no class to borrow, so it is written as the standalone server writes it.

      To run only this one:

        npx vitest run --config vitest.encryption.config.js seed-dummy-data -t "every one of the dummy people"
    */
    const { ChurchFunctions } = await import('./src/functions/church_functions.js')
    const { Event } = await import('./src/functions/event.js')
    const { TestimoniesFetch } = await import('./src/page_functions/testimonies.js')
    const { decryptText } = await import('./src/page_functions/crypto.js')
    const gatherings = new Event(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const testimonies = new TestimoniesFetch(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const answerer = new ChurchFunctions(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const todayStr = new Date().toISOString().slice(0, 10)
    const shift = (stamp, days) =>
      new Date(new Date(`${stamp}T00:00:00Z`).getTime() + days * 86_400_000)
        .toISOString()
        .slice(0, 10)
    // The five the notice box still offers as suggestions. A live database built before that column
    // became free wording still carries `event_reason_check`, which refuses anything outside these,
    // so the seed stays inside them and a row here never depends on a migration having been run.
    const REASONS = ['Work', 'Transport', 'Sick', 'Family', 'Other']

    const { data: fellowships } = await db
      .from('community')
      .select('community_id, name')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
      .order('name')
    if (!fellowships?.length) throw new Error('run the first test before this one')

    let addedTestimony = 0
    let addedAttendance = 0
    let addedServing = 0
    let addedAnswer = 0
    const gaps = []

    for (const group of fellowships) {
      // The roster the way the functions passes read it — sorted by address, so the fold that picks
      // what a person does lands on the same person every run.
      const { data: roster, error: rosterError } = await db
        .from('community_members')
        .select('email, role')
        .eq('community_id', group.community_id)
      if (rosterError) throw rosterError
      const { data: known } = await db
        .from('users')
        .select('email, name, surname')
        .in('email', roster.map((person) => person.email))
      const people = (known || [])
        .map((person) => ({
          ...person,
          label: `${person.name || ''} ${person.surname || ''}`.trim() || person.email,
          role: roster.find((one) => one.email === person.email)?.role || 'member',
        }))
        .sort((a, b) => a.email.localeCompare(b.email))
      if (!people.length) throw new Error(`${group.name} has no member the users table knows`)
      // A private testimony is shared with the people this fellowship actually runs by, and an
      // apology written for somebody else is written by one of them too.
      const leaders = roster
        .filter((one) => one.role === 'admin' || one.role === 'leader')
        .map((one) => one.email)
        .sort()

      // --- 1. testimonies: one each for anybody who has never shared in this fellowship.
      const spoken = async () => {
        const { data: rows } = await db
          .from('testimony')
          .select('user_email')
          .eq('community_id', group.community_id)
        const seen = new Map()
        for (const row of rows || []) {
          // A row this key cannot open passes straight through as whatever it holds, so at worst a
          // person is counted under an address nobody recognises and gets topped up anyway.
          const who = await decryptText(row.user_email).catch(() => null)
          if (who) seen.set(who, (seen.get(who) || 0) + 1)
        }
        return seen
      }
      const shared = await spoken()
      for (const [j, person] of people.entries()) {
        if (shared.has(person.email)) continue
        // One in five keeps theirs to their leaders, so the private shape is on these screens too.
        const quiet = leaders.length > 0 && roll(j + 1, group.name.length, 5) < 0.2
        await testimonies.addTestimony({
          email: person.email,
          community_id: group.community_id,
          date: shift(todayStr, -(4 + j * 6)),
          body: simpleWords(j + 3),
          type: 'text',
          allow_all: !quiet,
          authorise: quiet ? leaders.slice(0, 2) : [],
        })
        addedTestimony++
      }

      // --- 2. attendance: this community's own check-ins, most recent three, so the rows land on
      //         gatherings the app can actually show rather than on invented Sundays. A community
      //         with no session yet still gets one older Sunday a leader vouched for, the way the
      //         first pass writes one.
      const { data: opened } = await db
        .from('session')
        .select('session_id, event_name, date, latitude, longitude')
        .eq('community_id', group.community_id)
        .eq('cancel', false)
        .lte('date', todayStr)
        .order('date', { ascending: false })
        .limit(3)
      const sundays = (opened || []).length
        ? opened.map((one) => ({ ...one, event_name: one.event_name || 'Sunday Service' }))
        : [
            {
              session_id: null,
              event_name: 'Sunday Service',
              date: shift(todayStr, -7),
              latitude: JHB.latitude,
              longitude: JHB.longitude,
            },
          ]
      const { data: already } = await db
        .from('event')
        .select('event_date, event_name, user_email')
        .eq('community_id', group.community_id)
      const taken = new Set(
        (already || []).map((row) => `${row.event_date}|${row.event_name}|${row.user_email}`),
      )
      for (const [j, person] of people.entries()) {
        for (const [k, day] of sundays.entries()) {
          const placed = `${day.date}|${day.event_name}|${person.email}`
          if (taken.has(placed)) continue
          const away = roll(k + 1, j, 23) < 0.22
          // An apology recorded FOR somebody else is the For-who box's shape: the person under
          // `user_email` is the one who was away, and the hand on the record is a leader's.
          const forSomeoneElse = away && leaders.length && roll(k + 1, j, 29) < 0.35
          await gatherings.record({
            community_id: group.community_id,
            event_date: day.date,
            event_name: day.event_name,
            user_email: person.email,
            attend: !away,
            reason: away ? REASONS[Math.floor(roll(k + 1, j, 31) * REASONS.length)] : null,
            recorded_by: forSomeoneElse ? leaders[j % leaders.length] : person.email,
            session_id: away ? null : day.session_id,
            checked_in_at: away
              ? null
              : `${day.date}T09:${String(4 + ((j * 7 + k * 3) % 52)).padStart(2, '0')}:00+02:00`,
            checkin_latitude: away ? null : near(j - 8).latitude,
            checkin_longitude: away ? null : near(j - 8).longitude,
            latitude: day.latitude,
            longitude: day.longitude,
          })
          taken.add(placed)
          addedAttendance++
        }
      }

      // --- 3. servings: the row the standalone server writes when somebody joins, which the newer
      //         names on this roster never went through a join screen for.
      const { data: served } = await db
        .from('servings')
        .select('email')
        .eq('community_id', group.community_id)
      const listed = new Set((served || []).map((row) => String(row.email).toLowerCase()))
      const unlisted = people.filter((person) => !listed.has(person.email.toLowerCase()))
      if (unlisted.length) {
        const { error: servingError } = await db.from('servings').insert(
          unlisted.map((person) => ({
            email: person.email,
            name: person.name,
            surname: person.surname,
            role: person.role,
            community_id: group.community_id,
          })),
        )
        if (servingError) throw new Error(`servings in ${group.name}: ${servingError.message}`)
        addedServing += unlisted.length
      }

      // --- 4. functions: an answer under three gatherings for anybody who has never answered one,
      //         so a new name turns up in the register's tallies and on the RSVP page rather than
      //         only in the roster a leader searches.
      const { data: planned } = await db
        .from('functions')
        .select('id, function_date, requires_payment')
        .eq('community_id', group.community_id)
        .order('id')
      const replied = new Set()
      if (planned?.length) {
        const { data: replies } = await db
          .from('function_attending')
          .select('user_email')
          .in('function_id', planned.map((one) => one.id))
        for (const row of replies || []) replied.add(row.user_email)
      }
      for (const [j, person] of people.entries()) {
        if (replied.has(person.email)) continue
        if (!planned?.length) break
        // Spread over the calendar rather than the three nearest, so both halves of the register —
        // the gatherings that have gone by and the ones still to come — have the new names in them.
        const picks = new Set([
          (j * 7) % planned.length,
          (j * 13 + 5) % planned.length,
          (j * 29 + 11) % planned.length,
        ])
        for (const at of picks) {
          const one = planned[at]
          const comingNow = roll(at + 1, j, 37) > 0.26
          const about = roll(at + 1, j, 41)
          const pays = one.requires_payment && comingNow
          await answerer.respond({
            community_id: group.community_id,
            function_id: one.id,
            user_email: person.email,
            attending: comingNow,
            proof_path: pays && about < 0.45 ? await receiptFor(person.email, person.label) : null,
            expected_pay_date:
              pays && about >= 0.45 && about < 0.7
                ? shift(one.function_date, Math.round(roll(at + 1, j, 43) * 6) - 2)
                : null,
          })
          addedAnswer++
          replied.add(person.email)
        }
      }

      /*
        What this fellowship's people now have behind their names, read back out of the tables after
        the top-ups. This is the assertion that matters: not that rows were written, but that nobody on
        a roster is a blank on the screens.
      */
      const testimoniesNow = await spoken()
      const counts = new Map()
      const { data: days } = await db
        .from('event')
        .select('user_email')
        .eq('community_id', group.community_id)
      for (const row of days || []) {
        counts.set(row.user_email, (counts.get(row.user_email) || 0) + 1)
      }
      const servings = new Map()
      const { data: seats } = await db
        .from('servings')
        .select('email')
        .eq('community_id', group.community_id)
      for (const row of seats || []) {
        const who = String(row.email).toLowerCase()
        servings.set(who, (servings.get(who) || 0) + 1)
      }
      const answers = new Map()
      const { data: here } = planned?.length
        ? await db
            .from('function_attending')
            .select('user_email')
            .in('function_id', planned.map((one) => one.id))
        : { data: [] }
      for (const row of here || []) {
        answers.set(row.user_email, (answers.get(row.user_email) || 0) + 1)
      }

      console.log(`\n=== ${group.name}: what each person has behind their name ===`)
      for (const person of people) {
        const had = {
          testimonies: testimoniesNow.get(person.email) || 0,
          sundays: counts.get(person.email) || 0,
          servings: servings.get(person.email.toLowerCase()) || 0,
          answers: answers.get(person.email) || 0,
        }
        const missing = Object.entries(had).filter(([, n]) => !n).map(([what]) => what)
        if (missing.length) gaps.push(`${group.name} / ${person.label}: no ${missing.join(', no ')}`)
        console.log(
          `${person.label} (${person.role}): ${had.testimonies} testimonies, ${had.sundays} sundays, ` +
            `${had.servings} servings, ${had.answers} function answers`,
        )
      }
    }

    console.log(
      `\ntop-ups written: ${addedTestimony} testimonies, ${addedAttendance} attendance rows, ` +
        `${addedServing} servings, ${addedAnswer} function answers`,
    )

    /*
      Both kinds of proof have to be on the table, because the viewer is a different piece of software
      for a photograph than it is for a PDF: whichever kind is missing goes unlooked-at on every screen
      that has one. The count is taken off the stored urls rather than off what this run wrote, since
      the bulk of them are the bulk answer pass's.
    */
    const { data: proofs } = await db.from('function_paid').select('proof_path').eq('paid', true)
    const kinds = { image: 0, pdf: 0, other: 0 }
    for (const row of proofs || []) {
      const ext = String(row.proof_path || '').split('?')[0].split('.').pop().toLowerCase()
      kinds[/^pdf$/.test(ext) ? 'pdf' : /^(png|jpe?g|webp|gif|avif)$/.test(ext) ? 'image' : 'other']++
    }
    console.log(
      `proofs on file: ${kinds.image} pictures, ${kinds.pdf} PDFs, ${kinds.other} of something else`,
    )

    const picture = (proofs || []).find((row) =>
      /\.(jpe?g|png|webp|gif|avif)$/i.test(String(row.proof_path || '')),
    )
    if (picture) {
      const opened = await fetch(picture.proof_path)
      console.log(
        `the picture receipt opens: HTTP ${opened.status}, ${opened.headers.get('content-type')}`,
      )
    }

    // A run that could not reach the picture service wrote every proof as a PDF, which the viewer
    // handles but which leaves the image half of it unseen; saying so is worth a failing run.
    if (!kinds.image) {
      console.log('  (no photograph proofs — the online picture service was unreachable)')
    }
    expect(kinds.image).toBeGreaterThan(0)
    expect(kinds.pdf).toBeGreaterThan(0)
    expect(gaps).toEqual([])
  }, 300_000)

  /*
    A sixth test seeds the two extra tables the dashboards read for the people who never open the app:
    the names in extra_members and the gatherings recorded against them in extra_event. It is the dummy
    half of that feature, so an Extra members card and the extra register have rows to show without a
    leader typing them in by hand first.

    Like the servings rows in the first test, this reaches Supabase straight through the service-key
    client rather than the server's own routes — a row at a time over HTTP would be a round trip per
    line, and these are plain inserts. member_id and event_id are drawn by the database, so they are
    read back from the insert that made them and used to key the gatherings on.

      npx vitest run --config vitest.encryption.config.js seed-dummy-data -t "extra members"
  */
  it('seeds the extra members who never join the app and their gatherings', async () => {
    const { data: fellowships } = await db
      .from('community')
      .select('community_id, name')
      .in('name', ['Grace Point Fellowship', 'Stream of Hope Fellowship'])
      .order('name')
    if (!fellowships?.length) throw new Error('run the first test before this one')
    const ids = fellowships.map((one) => one.community_id)
    const idOf = Object.fromEntries(fellowships.map((one) => [one.name, one.community_id]))

    /*
      A fresh start for just these two fellowships. The gatherings go before the members, because an
      event's member_id points at a member and those rows lean on them; whether or not that key
      cascades, this order never leaves a dangling reference. Then both are written anew below, so a
      second run replaces the crowd rather than doubling it.
    */
    const { error: clearEvents } = await db.from('extra_event').delete().in('community_id', ids)
    if (clearEvents) throw new Error(`cleanup extra_event: ${clearEvents.message}`)
    const { error: clearMembers } = await db.from('extra_members').delete().in('community_id', ids)
    if (clearMembers) throw new Error(`cleanup extra_members: ${clearMembers.message}`)

    // Who keeps no app but is still counted — four in Grace Point, three in Stream of Hope. The leader
    // who added each is a real user, so created_by is an address already on that fellowship's roster.
    const EXTRA_PEOPLE = [
      { community: 'Grace Point Fellowship', name: 'Nomsa', surname: 'Dube', by: 'thoko.mahlangu@example.com' },
      { community: 'Grace Point Fellowship', name: 'Felix', surname: 'Mokhtari', by: 'thoko.mahlangu@example.com' },
      { community: 'Grace Point Fellowship', name: 'Anele', surname: 'Sithole', by: 'sibusiso.gumede@example.com' },
      { community: 'Grace Point Fellowship', name: 'Sipho', surname: 'Nkosi', by: 'sibusiso.gumede@example.com' },
      { community: 'Stream of Hope Fellowship', name: 'Rohan', surname: 'Pretorius', by: 'thoko.mahlangu@example.com' },
      { community: 'Stream of Hope Fellowship', name: 'Zodwa', surname: 'Mkhize', by: 'zanele.kunene@example.com' },
      { community: 'Stream of Hope Fellowship', name: 'Elias', surname: 'Tefu', by: 'zanele.kunene@example.com' },
    ]

    const { data: members, error: mErr } = await db
      .from('extra_members')
      .insert(
        EXTRA_PEOPLE.map((one) => ({
          community_id: idOf[one.community],
          name: one.name,
          surname: one.surname,
          created_by: one.by,
        })),
      )
      .select('member_id, community_id, name, surname, created_by')
    if (mErr) throw new Error(`extra_members: ${mErr.message}`)

    /*
      The gatherings to write a name against, over the recent Sundays so the register reads like real
      services. Each row is one of the three answers the column holds: they came, they sent word they
      would not (with a reason off the five the column allows), or their name was only written down for
      the day. Which of the three is folded from the member and the day, so a second run writes the same
      answer for the same row rather than a fresh crowd.
    */
    const GATHERINGS = ['Sunday Service', 'Prayer Meeting', 'Bible Study', 'Youth Fellowship']
    const REASONS = ['Work', 'Transport', 'Sick', 'Family', 'Other']
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    const sundayBack = (n) => {
      const d = new Date(today.getTime() - n * 7 * 86_400_000)
      d.setUTCDate(d.getUTCDate() - d.getUTCDay())
      return d.toISOString().slice(0, 10)
    }

    const events = []
    for (const [k, member] of members.entries()) {
      const count = 2 + (k % 2)
      for (let at = 0; at < count; at++) {
        const came = roll(k + 1, at + 1, 53)
        events.push({
          community_id: member.community_id,
          member_id: member.member_id,
          event_name: GATHERINGS[(k + at) % GATHERINGS.length],
          event_date: sundayBack(at + 1),
          attend: came < 0.45 ? true : came < 0.8 ? false : null,
          reason: came >= 0.45 && came < 0.8 ? REASONS[(k + at) % REASONS.length] : null,
          recorded_by: member.created_by,
        })
      }
    }
    const { error: eErr } = await db.from('extra_event').insert(events)
    if (eErr) throw new Error(`extra_event: ${eErr.message}`)

    console.log(`extra_members: ${members.length} people who never use the app`)
    console.log(`extra_event: ${events.length} gatherings recorded for them`)

    // Read it back the way the extra register does — each gathering joined to the member it belongs to
    // — and assert that no row came out nameless and that all three kinds of answer reached the table.
    const { data: joined, error: jErr } = await db
      .from('extra_event')
      .select('event_id, community_id, member_id, attend, reason, extra_members(name, surname)')
      .in('community_id', ids)
    if (jErr) throw new Error(`extra_event read: ${jErr.message}`)
    expect(joined.length).toBe(events.length)
    expect(joined.every((one) => one.extra_members?.name)).toBe(true)

    const tally = (want) => joined.filter((one) => one.attend === want).length
    console.log(
      `  came: ${tally(true)}, sent word they would not: ${tally(false)}, written down only: ${tally(null)}`,
    )
  }, 60_000)
})
