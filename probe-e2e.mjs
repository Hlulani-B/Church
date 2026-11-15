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
const email = `probe.member.${stamp}@example.com`;
const password = `Pr0be!${stamp}Aa`;

const fb = async (path, body, token) => {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const god = async (action, params, token) => {
  const res = await fetch(`${APP}/api/god`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, params }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const report = {};
let idToken = null;
let created = { user: false, link: false, account: false };
let failure = null;

try {
  const { data: before } = await db.from('event').select('event_id').eq('community_id', GRACE);
  report.eventsBefore = before.length;

  const signUp = await fb('signUp', { email, password, returnSecureToken: true });
  if (!signUp.json.idToken) throw new Error(`firebase signUp ${signUp.status}: ${JSON.stringify(signUp.json)}`);
  idToken = signUp.json.idToken;
  created.account = true;

  const { error: uErr } = await db.from('users').insert({ email, name: 'Probe', surname: 'Member' });
  if (uErr) throw new Error(`users: ${uErr.message}`);
  created.user = true;
  const { error: lErr } = await db.from('community_members').insert({ email, community_id: GRACE, role: 'member' });
  if (lErr) throw new Error(`link: ${lErr.message}`);
  created.link = true;

  // 1. A member's own notice, with a spoofed email and attend=true alongside it.
  const write = await god(
    'event',
    {
      function: 'record',
      community_id: GRACE,
      event_date: '2026-11-22',
      event_name: 'Sunday Fellowship',
      reason: 'Transport',
      user_email: 'baloyihlulani91@gmail.com',
      attend: true,
      recorded_by: 'baloyihlulani91@gmail.com',
    },
    idToken,
  );
  report.write = { status: write.status, body: write.body };
  const { data: row } = await db
    .from('event')
    .select('user_email, attend, reason, recorded_by, session_id, event_date, event_name')
    .eq('community_id', GRACE)
    .eq('event_date', '2026-11-22')
    .maybeSingle();
  report.writtenRow = row;

  // 2. A member may not read the gatherings of the community.
  const read = await god('attendance', { function: 'services', community_id: GRACE }, idToken);
  report.memberReadsServices = { status: read.status, error: read.body.error };

  // 3. A notice against a gathering the member is already present at must refuse.
  const { data: present } = await db
    .from('event')
    .select('event_date, event_name')
    .eq('community_id', GRACE)
    .eq('user_email', email)
    .eq('attend', true)
    .limit(1);
  if (present?.length) {
    const clash = await god(
      'event',
      { function: 'record', community_id: GRACE, event_date: present[0].event_date, event_name: present[0].event_name, reason: 'Work' },
      idToken,
    );
    report.refusesAYes = { status: clash.status, error: clash.body.error };
  }

  // 4. The same pages, driven for real.
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/community', { timeout: 20000 });
  await page.waitForSelector('.card');
  await page.screenshot({ path: '/tmp/member-1-cards.png', fullPage: true });

  // Grace Fellowship is the one this address is a plain member of.
  await page.click('.card:has-text("Grace Fellowship")');
  await page.waitForURL('**/member-dashboard', { timeout: 20000 });
  await page.waitForSelector('.au .absent');
  report.landedOn = page.url();
  report.heading = await page.textContent('.au h1');
  report.sub = await page.textContent('.au .sub');
  report.hasBackLink = Boolean(await page.$('.kp-back'));
  await page.screenshot({ path: '/tmp/member-2-dashboard.png', fullPage: true });

  // Fill the notice box and send it.
  await page.fill('.au .absent input[type="date"]', '2026-11-29');
  await page.fill('.au .absent .fields label:nth-child(2) input', 'Sunday Fellowship');
  await page.fill('input[list="absence-reasons"]', 'Family');
  await page.click('.au .absent .go');
  await page.waitForSelector('.au .absent .note', { timeout: 20000 });
  report.noticeNote = (await page.textContent('.au .absent .note')).trim();
  await page.screenshot({ path: '/tmp/member-3-notice.png', fullPage: true });

  const { data: noticeRow } = await db
    .from('event')
    .select('user_email, attend, reason, recorded_by, event_date, event_name')
    .eq('community_id', GRACE)
    .eq('event_date', '2026-11-29')
    .maybeSingle();
  report.noticeRow = noticeRow;

  // The testimonies page, and whether any name leaks onto it.
  await page.click('.au .links button');
  await page.waitForURL('**/member-testimonies', { timeout: 20000 });
  await page.waitForSelector('.au .item, .au .tally');
  await page.waitForTimeout(600);
  report.tally = (await page.textContent('.au .tally')).trim();
  const bodies = await page.$$eval('.au .item', (list) =>
    list.map((one) => one.innerText.replace(/\s+/g, ' ').trim()),
  );
  report.cards = bodies.length;
  report.firstCard = bodies[0];
  const pageText = await page.evaluate(() => document.body.innerText);
  const names = ['Anel', 'Rapulane', 'Zinhle', 'Katlego', 'Boitumelo', 'Refilwe', 'Sabelo', 'Thandeka', 'Kefilwe', 'Ntsiki', 'Hlulani', 'Baloyi', 'Mokoena', '@example.com', '@gmail.com'];
  report.leaks = names.filter((one) => pageText.includes(one));
  report.hasAvatarOrWho = Boolean(await page.$('.au .avatar, .au .who'));
  await page.screenshot({ path: '/tmp/member-4-testimonies.png', fullPage: true });

  // Back to the dashboard from the testimonies page.
  await page.click('.au .back');
  await page.waitForURL('**/member-dashboard', { timeout: 20000 });
  report.backWorks = page.url().endsWith('/member-dashboard');
  await browser.close();
  report.errors = errors;
} catch (e) {
  failure = `${e.message}\n${(e.stack || '').split('\n').slice(1, 3).join('\n')}`;
} finally {
  // Everything the probe touched, gone again.
  const { error: delEvents } = await db.from('event').delete().eq('user_email', email);
  const { error: delRecorded } = await db.from('event').delete().eq('recorded_by', email);
  const { error: delLink } = await db.from('community_members').delete().eq('email', email);
  const { error: delUser } = await db.from('users').delete().eq('email', email);
  const gone = idToken ? await fb('delete', { idToken }) : { status: 'not signed up' };
  const { data: after } = await db.from('event').select('event_id').eq('community_id', GRACE);
  const { count: links } = await db.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', GRACE);
  const { count: strayUsers } = await db.from('users').select('*', { count: 'exact', head: true }).like('email', 'probe.member.%');
  report.cleanup = {
    delEvents: delEvents?.message || 'ok',
    delRecorded: delRecorded?.message || 'ok',
    delLink: delLink?.message || 'ok',
    delUser: delUser?.message || 'ok',
    firebaseDelete: gone.status,
    eventsAfter: after.length,
    linksAfter: links,
    strayProbeUsers: strayUsers,
  };
}

console.log(JSON.stringify({ failure, ...report }, null, 2));
