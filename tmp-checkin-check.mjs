/*
  Scratch verification of the PIN check-in. Throwaway accounts in the real project, a dev server
  on 7016, and everything the run touches deleted again at the end. Not part of the app.
*/
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '/home/codespace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const GRACE = '1b079f42-235e-41e5-989d-946302993851';
const APP = 'http://localhost:7016';
const stamp = Date.now().toString(36);

// A room, a phone standing in it and a phone eleven blocks off. The near pair is about 22 m of
// latitude from the room, which is inside a 150 m radius; the far pair is about 1.1 km.
const ROOM = { latitude: -25.747, longitude: 28.229 };
const NEAR = { latitude: -25.7472, longitude: 28.229 };
const FAR = { latitude: -25.757, longitude: 28.229 };

const leader = { email: `probe.in.leader.${stamp}@example.com`, password: `Pr0beL!${stamp}Aa`, role: 'leader' };
const member = { email: `probe.in.member.${stamp}@example.com`, password: `Pr0beM!${stamp}Aa`, role: 'member' };
const stranger = { email: `probe.in.stranger.${stamp}@example.com`, password: `Pr0beS!${stamp}Aa`, role: null };
const people = [leader, member, stranger];

const fb = async (path, body, token) => {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const god = async (action, params, token) => {
  // god.js was split into three endpoints by auth tier; this mirrors how callGod picks the door.
  const door =
    { user: 'self', attendance: 'leader', event: 'self' }[action] ||
    (action === 'community' ? (params.function === 'find' ? 'admin' : 'self') : null) ||
    (action === 'member' ? (params.function === 'remove' ? 'admin' : 'self') : null) ||
    (action === 'admin' ? (params.function === 'roster' ? 'leader' : 'admin') : null) ||
    (action === 'session' ? (params.function === 'open' ? 'self' : 'leader') : null);
  const res = await fetch(`${APP}/api/${door}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, params }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
// The short form every assertion below reads: what the server answered, and nothing else.
const say = async (promise) => {
  const { status, body } = await promise;
  return { status, error: body.error || null, data: body.data ? summarize(body.data) : null };
};
const summarize = (row) => ({
  attend: row.attend,
  reason: row.reason ?? null,
  event_name: row.event_name,
  session_id: row.session_id ? 'set' : null,
  checked_in_at: row.checked_in_at || null,
  checkin_latitude: row.checkin_latitude ?? null,
  latitude: row.latitude ?? null,
  already: row.already ?? null,
  metres: row.metres ?? null,
  pin: row.pin ?? null,
  radius: row.radius ?? null,
});

const report = {};
let failure = null;
const opened = [];
const minutes = (n) => new Date(Date.now() + n * 60000).toISOString();

try {
  for (const one of people) {
    const signed = await fb('signUp', { email: one.email, password: one.password, returnSecureToken: true });
    if (!signed.json.idToken) throw new Error(`firebase signUp ${one.email}: ${JSON.stringify(signed.json)}`);
    one.token = signed.json.idToken;
    const { error: uErr } = await db.from('users').insert({ email: one.email, name: 'Probe', surname: one.role || 'Stranger' });
    if (uErr) throw new Error(`users: ${uErr.message}`);
    if (one.role) {
      const { error: lErr } = await db.from('community_members').insert({ email: one.email, community_id: GRACE, role: one.role });
      if (lErr) throw new Error(`link: ${lErr.message}`);
    }
  }

  // A PIN this community has never used, so the wrong-PIN test cannot land on a row from another
  // day: the branch below reads every session carrying those four digits before it says no.
  const today = new Date().toISOString().slice(0, 10);
  const { data: usedPins } = await db.from('session').select('pin').eq('community_id', GRACE);
  const taken = new Set((usedPins || []).map((one) => one.pin));
  const draw = () => {
    for (let n = 0; n < 10000; n += 1) {
      const candidate = String(n).padStart(4, '0');
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
    throw new Error('every four-digit PIN is already in use today');
  };

  const openSession = async (token, { pin, event_name, radius, allow_any_radius, start, end }) => {
    const answer = await god(
      'session',
      {
        function: 'create',
        community_id: GRACE,
        pin,
        event_name,
        started_at: minutes(start),
        ended_at: minutes(end),
        latitude: ROOM.latitude,
        longitude: ROOM.longitude,
        radius,
        allow_any_radius,
      },
      token,
    );
    if (answer.status !== 200) throw new Error(`${event_name}: ${JSON.stringify(answer.body)}`);
    opened.push(answer.body.data.session_id);
    return answer.body.data;
  };

  const checkIn = (token, pin, at) =>
    say(
      god(
        'event',
        { function: 'checkin', community_id: GRACE, pin, latitude: at?.latitude ?? null, longitude: at?.longitude ?? null },
        token,
      ),
    );

  // 0 · The tier a session belongs to.
  report.memberCannotDrawAPin = await say(god('session', { function: 'pin', community_id: GRACE }, member.token));

  // 1 · Three sessions: one with a distance on it, one with the rule turned off, one shut.
  const alphaPin = draw();
  const betaPin = draw();
  const gammaPin = draw();
  report.alpha = await openSession(leader.token, {
    pin: alphaPin,
    event_name: 'Probe Alpha',
    radius: 150,
    allow_any_radius: false,
    start: -5,
    end: 40,
  });
  report.beta = await openSession(leader.token, {
    pin: betaPin,
    event_name: 'Probe Beta',
    radius: 150,
    allow_any_radius: true,
    start: -5,
    end: 40,
  });
  await openSession(leader.token, {
    pin: gammaPin,
    event_name: 'Probe Gamma',
    radius: 150,
    allow_any_radius: false,
    start: -90,
    end: -10,
  });
  report.sessionRow = summarize(report.alpha);

  // 2 · The leader's own row came with the session they opened.
  const { data: leaderRows } = await db
    .from('event')
    .select('event_name,attend,reason,session_id,checked_in_at,latitude,longitude,user_email')
    .eq('community_id', GRACE)
    .eq('user_email', leader.email);
  report.leaderRows = leaderRows;

  // 3 · The bounds and the refusals, all through the API.
  report.tooWideRadius = await say(
    god(
      'session',
      {
        function: 'create',
        community_id: GRACE,
        pin: draw(),
        event_name: 'Probe Wide',
        started_at: minutes(-5),
        ended_at: minutes(40),
        latitude: ROOM.latitude,
        longitude: ROOM.longitude,
        radius: 50000,
        allow_any_radius: false,
      },
      leader.token,
    ),
  );
  report.wrongPin = await checkIn(member.token, draw(), NEAR);
  report.strangerRefused = await checkIn(stranger.token, alphaPin, NEAR);
  report.outsideWindow = await checkIn(member.token, gammaPin, NEAR);
  report.noPositionWanted = await checkIn(member.token, alphaPin, null);
  report.tooFar = await checkIn(member.token, alphaPin, FAR);
  report.near = await checkIn(member.token, alphaPin, NEAR);
  report.nearAgain = await checkIn(member.token, alphaPin, NEAR);
  const { data: afterTwo } = await db
    .from('event')
    .select('event_name,attend,checked_in_at,checkin_latitude,session_id,reason')
    .eq('community_id', GRACE)
    .eq('user_email', member.email)
    .eq('event_name', 'Probe Alpha');
  report.alphaRowsAfterTwoTaps = afterTwo;

  // 4 · The distance turned off is the leader's own choice, and it lets a phone with no fix in.
  report.anywhereNoPosition = await checkIn(member.token, betaPin, null);
  report.anywhereFar = await checkIn(member.token, betaPin, FAR);

  // 5 · An apology sent before the arrival is overwritten by it, and never the other way round.
  report.absenceFirst = await say(
    god('event', { function: 'record', community_id: GRACE, event_date: today, event_name: 'Probe Beta', reason: 'Transport' }, member.token),
  );
  const { data: beforeFlip } = await db
    .from('event')
    .select('attend,reason,checked_in_at')
    .eq('community_id', GRACE)
    .eq('user_email', member.email)
    .eq('event_name', 'Probe Beta')
    .maybeSingle();
  report.betaRowFromAbsence = beforeFlip;
  report.checkinOverApology = await checkIn(member.token, betaPin, NEAR);
  report.apologyAfterPresent = await say(
    god('event', { function: 'record', community_id: GRACE, event_date: today, event_name: 'Probe Alpha', reason: 'Sick' }, member.token),
  );
  const { data: betaRow } = await db
    .from('event')
    .select('attend,reason,checked_in_at,checkin_latitude,latitude,session_id')
    .eq('community_id', GRACE)
    .eq('user_email', member.email)
    .eq('event_name', 'Probe Beta')
    .maybeSingle();
  report.betaRowFinal = betaRow;

  // 6 · The box on the member's own page, driven for real, near and far.
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['geolocation'],
    geolocation: FAR,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', member.email);
  await page.fill('#password', member.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/community', { timeout: 20000 });
  await page.waitForSelector('.card');
  await page.click('.card:has-text("Grace Fellowship")');
  await page.waitForURL('**/member-dashboard', { timeout: 20000 });
  await page.waitForSelector('.kc');
  report.boxMounted = await page.textContent('.kc .what');
  report.boxCopy = (await page.textContent('.kc .why')).replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: '/tmp/checkin-1-box.png', fullPage: true });

  await page.fill('#checkin-pin', alphaPin);
  report.pinBoxHolds = await page.inputValue('#checkin-pin');
  await page.click('.kc .go');
  await page.waitForSelector('.kc .say.bad', { timeout: 20000 });
  report.boxFar = (await page.textContent('.kc .say.bad')).replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: '/tmp/checkin-2-far.png', fullPage: true });

  // Standing in the room now. This PIN was already spent by the API above, so the box should say
  // the arrival stands rather than write a second one.
  await context.overrideGeolocation(NEAR);
  await page.fill('#checkin-pin', betaPin);
  await page.click('.kc .go');
  await page.waitForSelector('.kc .say:not(.bad)', { timeout: 20000 });
  report.boxAlready = (await page.textContent('.kc .say:not(.bad)')).replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: '/tmp/checkin-3-already.png', fullPage: true });

  // A PIN with four digits missing is refused before anything is asked of the device.
  await page.fill('#checkin-pin', '12');
  await page.click('.kc .go');
  await page.waitForSelector('.kc .say.bad', { timeout: 20000 });
  report.boxShortPin = (await page.textContent('.kc .say.bad')).replace(/\s+/g, ' ').trim();

  // And the fresh arrival, in the box, from the room, for a session nobody has spent.
  const deltaPin = draw();
  await openSession(leader.token, {
    pin: deltaPin,
    event_name: 'Probe Delta',
    radius: 150,
    allow_any_radius: false,
    start: -2,
    end: 40,
  });
  await context.overrideGeolocation(NEAR);
  await page.fill('#checkin-pin', deltaPin);
  await page.click('.kc .go');
  await page.waitForSelector('.kc .say:not(.bad)', { timeout: 20000 });
  report.boxPresent = (await page.textContent('.kc .say:not(.bad)')).replace(/\s+/g, ' ').trim();
  report.digitsCleared = await page.inputValue('#checkin-pin');
  await page.screenshot({ path: '/tmp/checkin-4-present.png', fullPage: true });
  const { data: deltaRow } = await db
    .from('event')
    .select('attend,checked_in_at,checkin_latitude,checkin_longitude,latitude,longitude,session_id,reason')
    .eq('community_id', GRACE)
    .eq('user_email', member.email)
    .eq('event_name', 'Probe Delta')
    .maybeSingle();
  report.deltaRow = deltaRow;

  // The leader's own page: their box, and the radius they set for the room.
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', leader.email);
  await page.fill('#password', leader.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/community', { timeout: 20000 });
  await page.click('.card:has-text("Grace Fellowship")');
  await page.waitForURL('**/leader-dashboard', { timeout: 20000 });
  report.leaderHasCheckIn = Boolean(await page.$('.kc'));
  await page.click('.au .links button:has-text("Take attendance")');
  await page.waitForURL('**/take-attendance', { timeout: 20000 });
  await context.overrideGeolocation(ROOM);
  await page.waitForSelector('#session-radius', { timeout: 20000 });
  report.leaderHasRadiusBox = Boolean(await page.$('#session-radius'));
  report.leaderRadiusDefault = await page.inputValue('#session-radius');
  report.leaderAnywhere = await page.textContent('.ta .near');
  await page.fill('#session-name', 'Probe Echo');
  await page.screenshot({ path: '/tmp/checkin-5-leader.png', fullPage: true });

  await browser.close();
  report.errors = errors;
} catch (e) {
  failure = `${e.message}\n${(e.stack || '').split('\n').slice(1, 3).join('\n')}`;
} finally {
  const emails = people.map((one) => one.email);
  const { error: delEvents } = await db.from('event').delete().in('user_email', emails);
  const { error: delRecorded } = await db.from('event').delete().in('recorded_by', emails);
  const { error: delSessions } = await db.from('session').delete().in('session_id', opened);
  const { error: delLinks } = await db.from('community_members').delete().in('email', emails);
  const { error: delUsers } = await db.from('users').delete().in('email', emails);
  const gone = await Promise.all(people.map((one) => (one.token ? fb('delete', { idToken: one.token }) : { status: 'no token' })));
  const { data: leftEvents } = await db.from('event').select('event_id').eq('community_id', GRACE).in('event_name', [
    'Probe Alpha',
    'Probe Beta',
    'Probe Gamma',
    'Probe Delta',
    'Probe Wide',
  ]);
  const { count: leftSessions } = await db
    .from('session')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', GRACE)
    .in('created_by', emails);
  const { count: leftUsers } = await db.from('users').select('*', { count: 'exact', head: true }).like('email', 'probe.in.%');
  report.cleanup = {
    delEvents: delEvents?.message || 'ok',
    delRecorded: delRecorded?.message || 'ok',
    delSessions: delSessions?.message || 'ok',
    delLinks: delLinks?.message || 'ok',
    delUsers: delUsers?.message || 'ok',
    firebaseDeleted: gone.map((one) => one.status),
    leftProbeEvents: leftEvents?.length ?? null,
    leftProbeSessions: leftSessions,
    leftProbeUsers: leftUsers,
  };
}

console.log(JSON.stringify({ failure, ...report }, null, 2));
