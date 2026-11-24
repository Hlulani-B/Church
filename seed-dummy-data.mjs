/*
  Dummy data for the whole app, in simple words.

  One community admin is baloyihlulani91@gmail.com, and every table gets real rows: a second
  community, a leader and seven members, check-in sessions (one past, one coming, one called
  off), attendance with arrivals and apologies — including absences recorded FOR somebody else
  with a recorded_by, the way the new For-who box writes them — testimonies shared in plain
  words that are STORED encrypted through the app's own addTestimony (type 'text', so the body
  and the address go into the table as `enc:v1:` ciphertext), feedback, and servings.

  It runs through the same vitest setup as the encryption seed, because that is what gives the
  browser page functions their import.meta.env:

    npx vitest run --config vitest.encryption.config.js seed-dummy-data

  Every line here is written by the app's own classes (User, Community, CommunityMember,
  Session, Event, Feedback) or by the real addTestimony; only the cleanup at the top and the
  servings rows reach Supabase directly, because those two are not things the app itself does.
  Re-running replaces the dummy communities instead of stacking duplicates.

  The second test below adds 50 more encrypted testimonies on top, each authorised to
  baloyihlulani91@gmail.com alone. It refuses to run twice — the bulk rows are APPENDED, so
  clearing them is left to you (delete the ones you do not want on the admin testimonies
  screen, or drop their rows in Supabase) before seeding another batch.
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
]

// Who sits in which fellowship, and what they are there.
const MEMBERSHIP = [
  { email: ADMIN, community: 'Grace Point Fellowship', role: 'admin' },
  { email: 'thoko.mahlangu@example.com', community: 'Grace Point Fellowship', role: 'leader' },
  { email: 'joshua.dlamini@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'grace.ndlovu@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'samuel.khumalo@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'david.zwane@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'annah.mokona@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: 'ruth.sibiya@example.com', community: 'Grace Point Fellowship', role: 'member' },
  { email: ADMIN, community: 'Stream of Hope Fellowship', role: 'admin' },
  { email: 'thoko.mahlangu@example.com', community: 'Stream of Hope Fellowship', role: 'leader' },
  { email: 'joshua.dlamini@example.com', community: 'Stream of Hope Fellowship', role: 'member' },
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
      for (const table of ['testimony', 'event', 'session', 'servings', 'community_members']) {
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
    console.log('community_members: 8 in Grace Point, 3 in Stream of Hope')

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
    console.log('servings: 11 rows')

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
  })

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
})
