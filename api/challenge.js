import crypto from 'crypto';
import { vapidKeys, sendPush } from './_push.js';

// Challenge app backend (unlock system). One endpoint, four actions:
//   login   { email, code }  -> { token }
//   forgot  { email }        -> emails the login code again
//   state   { token }        -> progress, today's attempt, scorecard
//   update  { token, sugar_free?, task_done?, quiz_answer?, quiz_correct?, learned?, craving? }
//   diet    { token, diet: 'veg' | 'nonveg' } -> saves food preference (meals shown in the app)
//   emailme { token }        -> emails the member their login link (also a quick email test)
//   mine    { token }        -> every challenge this email has joined (for the app's home screen)
//   pushkey {}               -> public key for phone notifications
//   pushsub { token, sub }   -> saves this phone for notifications
//   pushtest { token }       -> sends a test notification to this member's phones
//
// Rules:
//   - One attempt per calendar day (India time). Today's attempt is always the next locked day.
//   - Points: sugar-free 40, task 25, quiz 15 (10 if wrong), today's learning 10, craving level 10.
//   - A day is PASSED with 70+ points AND sugar-free = yes. The next day unlocks the next morning.
//   - Ate sugar / under 70 points -> the same day repeats tomorrow.
//   - 42-day window from start_date to finish all 21 days, after that the challenge expires.

const DAY = 86400000;
const TOTAL_DAYS = 21, WINDOW = 42;
// Challenges that aren't 21 days. The window to finish is always double the length.
const DAYS_BY_CHALLENGE = { 'new-year-kickstart': 30, 'water-sleep-reset': 7 };
const daysOf = m => DAYS_BY_CHALLENGE[m && m.challenge] || TOTAL_DAYS;
const P = { sugarFree: 40, task: 25, quizRight: 15, quizWrong: 10, learn: 10, craving: 10, unlock: 70 };
const TOKEN_DAYS = 60;

const secret = () => process.env.CHALLENGE_SECRET || process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
const b64u = s => Buffer.from(s).toString('base64url');
function sign(memberId) {
  const body = b64u(JSON.stringify({ m: memberId, e: Date.now() + TOKEN_DAYS * DAY }));
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.e > Date.now() ? p.m : null;
}

const todayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / DAY);
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);

export function scoreOf(a) {
  let pts = 0;
  if (a.sugar_free === true) pts += P.sugarFree;
  if (a.task_done) pts += P.task;
  if (a.quiz_correct === true) pts += P.quizRight; else if (a.quiz_correct === false) pts += P.quizWrong;
  if (a.learned) pts += P.learn;
  if (a.craving) pts += P.craving;
  return { points: pts, passed: a.sugar_free === true && pts >= P.unlock };
}

export function progress(member, attempts, today = todayIST()) {
  const TD = daysOf(member), WIN = TD * 2;
  const past = attempts.filter(a => a.attempt_date < today);
  const passedBefore = past.filter(a => a.passed).length;
  const todayAttempt = attempts.find(a => a.attempt_date === today) || null;
  const passedTotal = passedBefore + (todayAttempt && todayAttempt.passed ? 1 : 0);
  const dayIdx = daysBetween(member.start_date, today); // 0 on start day
  const windowLeft = WIN - dayIdx; // days left including today
  let status = 'active';
  if (dayIdx < 0) status = 'pre';
  else if (passedBefore >= TD) status = 'complete';
  else if (dayIdx >= WIN) status = 'expired';
  // streak: consecutive passed calendar days ending today (if passed) or yesterday
  const byDate = Object.fromEntries(attempts.map(a => [a.attempt_date, a]));
  let streak = 0, d = todayAttempt && todayAttempt.passed ? today : addDays(today, -1);
  while (byDate[d] && byDate[d].passed) { streak++; d = addDays(d, -1); }
  const passedList = attempts.filter(a => a.passed);
  return {
    status,
    currentDay: Math.min(TD, passedBefore + 1),
    todayAttempt,
    startsIn: dayIdx < 0 ? -dayIdx : 0,
    windowLeft: Math.max(0, windowLeft),
    windowEnd: addDays(member.start_date, WIN - 1),
    score: {
      points: passedList.reduce((s, a) => s + (a.points || 0), 0),
      maxPoints: TD * 100,
      daysCompleted: passedTotal,
      repeats: past.filter(a => !a.passed).length,
      streak
    }
  };
}

// The challenge app can use its own Supabase project (CHALLENGE_SUPABASE_URL / CHALLENGE_SUPABASE_KEY).
// If those aren't set, it falls back to the website's main Supabase project.
const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
const SB_URL = () => cleanUrl(process.env.CHALLENGE_SUPABASE_URL || process.env.SUPABASE_URL);
const SB_KEY = () => String(process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
function sb(path, opts = {}) {
  const key = SB_KEY();
  return fetch(`${SB_URL()}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
}
export async function rows(path) {
  if (!SB_URL() || !SB_KEY()) throw new Error('Database settings missing in Vercel (CHALLENGE_SUPABASE_URL / CHALLENGE_SUPABASE_KEY).');
  const r = await sb(path);
  if (!r.ok) throw new Error(`Database error ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// Email (same settings as api/verify-payment.js): RESEND_API_KEY (or older CHALLENGE_RESEND_KEY) + EMAIL_FROM.
export async function sendMail(to, subject, html) {
  const key = String(process.env.RESEND_API_KEY || '').trim() || String(process.env.CHALLENGE_RESEND_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim() || 'Strong With Sherni <hello@strongwithsherni.com>';
  if (!key) { console.error('[email] RESEND_API_KEY not set'); return { ok: false, error: 'No email key set in Vercel (RESEND_API_KEY).' }; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html })
    });
    const error = r.ok ? null : (await r.text()).slice(0, 300);
    if (error) console.error(`[email] Resend error ${r.status} sending "${subject}" from ${from}:`, error);
    return { ok: r.ok, error };
  } catch (err) { console.error('[email] Could not reach Resend:', err.message); return { ok: false, error: err.message }; }
}
export const loginLink = m => `https://www.strongwithsherni.com/app.html?login=${Buffer.from(`${String(m.email).trim().toLowerCase()}:${m.access_code}`).toString('base64url')}`;
function loginEmailHtml(m) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px"><p>Hi ${String(m.name || '').split(' ')[0] || 'there'},</p><p>Tap below to open your challenge app:</p><p><a href="${loginLink(m)}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p><p>Your code: <b style="font-size:20px;letter-spacing:4px">${m.access_code}</b></p><p>Coach Sherni</p></div>`;
}

const shortName = n => { const p = String(n || 'Sherni').trim().split(/\s+/); const f = p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase(); return f + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : ''); };

// Everyone with the same challenge + start_date is one batch. Ranked by points (then days done).
async function leaderboard(member) {
  const mates = await rows(`challenge_members?challenge=eq.${encodeURIComponent(member.challenge)}&start_date=eq.${member.start_date}&select=id,name`);
  if (!mates.length) return { size: 0, rank: null, top: [] };
  const ids = mates.map(m => m.id).join(',');
  const done = await rows(`challenge_attempts?member_id=in.(${ids})&passed=eq.true&select=member_id,points`);
  const tally = Object.fromEntries(mates.map(m => [m.id, { name: shortName(m.name), points: 0, days: 0, me: m.id === member.id }]));
  done.forEach(a => { if (tally[a.member_id]) { tally[a.member_id].points += a.points || 0; tally[a.member_id].days += 1; } });
  const list = Object.values(tally).sort((a, b) => b.points - a.points || b.days - a.days || a.name.localeCompare(b.name));
  list.forEach((x, i) => x.rank = i + 1);
  const meRow = list.find(x => x.me);
  return { size: list.length, rank: meRow ? meRow.rank : null, top: list.slice(0, 10), me: meRow };
}

async function fullState(member, known) {
  // run both lookups at the same time (faster); after a save we already know the attempts
  const [attempts, lb] = await Promise.all([
    known || rows(`challenge_attempts?member_id=eq.${member.id}&select=attempt_date,day,sugar_free,task_done,quiz_answer,quiz_correct,learned,craving,points,passed&order=attempt_date.asc`),
    leaderboard(member)
  ]);
  return {
    member: { name: member.name, email: member.email, challenge: member.challenge, start_date: member.start_date, diet: member.diet || null, access_code: member.access_code },
    attempts,
    today: todayIST(),
    leaderboard: lb,
    ...progress(member, attempts)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { action } = req.body || {};

    if (action === 'login') {
      const email = String(req.body.email || '').trim().toLowerCase();
      const code = String(req.body.code || '').trim();
      if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Please enter your email and the 6-digit code.' });
      const found = await rows(`challenge_members?email=eq.${encodeURIComponent(email)}&access_code=eq.${code}&select=*&order=created_at.desc&limit=1`);
      if (!found.length) return res.status(401).json({ error: 'That email and code don\'t match. Check your welcome email.' });
      return res.status(200).json({ token: sign(found[0].id) });
    }

    if (action === 'forgot') {
      const email = String(req.body.email || '').trim().toLowerCase();
      const found = await rows(`challenge_members?email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=1`);
      if (found.length) await sendMail(email, `Your Strong With Sherni login code: ${found[0].access_code}`, loginEmailHtml(found[0]));
      return res.status(200).json({ ok: true }); // same answer either way
    }

    if (action === 'pushkey') return res.status(200).json({ publicKey: vapidKeys().publicKey });

    const memberId = verify(req.body.token);
    if (!memberId) return res.status(401).json({ error: 'Please log in again.' });
    const found = await rows(`challenge_members?id=eq.${encodeURIComponent(memberId)}&select=*`);
    const member = found[0];
    if (!member) return res.status(401).json({ error: 'Please log in again.' });

    if (action === 'state') return res.status(200).json(await fullState(member));

    if (action === 'mine') {
      const list = await rows(`challenge_members?email=eq.${encodeURIComponent(String(member.email).trim().toLowerCase())}&select=id,name,challenge,start_date,created_at&order=created_at.desc`);
      const ids = list.map(m => m.id);
      const atts = ids.length ? await rows(`challenge_attempts?member_id=in.(${ids.join(',')})&select=member_id,attempt_date,day,sugar_free,passed,points`) : [];
      const seen = new Set(); const out = [];
      for (const m of list) {
        if (seen.has(m.challenge)) continue; seen.add(m.challenge); // newest membership per challenge
        const pr = progress(m, atts.filter(a => a.member_id === m.id));
        out.push({ token: sign(m.id), challenge: m.challenge, start_date: m.start_date, status: pr.status, currentDay: pr.currentDay, startsIn: pr.startsIn, daysCompleted: pr.score.daysCompleted, passedToday: !!(pr.todayAttempt && pr.todayAttempt.passed) });
      }
      return res.status(200).json({ name: member.name, list: out });
    }

    if (action === 'diet') {
      const diet = req.body.diet === 'veg' ? 'veg' : req.body.diet === 'nonveg' ? 'nonveg' : null;
      if (!diet) return res.status(400).json({ error: 'Please choose vegetarian or non-vegetarian.' });
      const r = await sb(`challenge_members?id=eq.${member.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ diet }) });
      if (!r.ok) return res.status(500).json({ error: 'Could not save your food preference. ' + (await r.text()).slice(0, 120) });
      return res.status(200).json(await fullState({ ...member, diet }));
    }

    if (action === 'pushsub') {
      const sub = req.body.sub || {};
      const endpoint = String(sub.endpoint || ''), p256dh = sub.keys && sub.keys.p256dh, auth = sub.keys && sub.keys.auth;
      if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return res.status(400).json({ error: 'This phone could not be set up for notifications.' });
      const r = await sb('challenge_push?on_conflict=endpoint', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ endpoint, member_id: member.id, p256dh, auth }) });
      if (!r.ok) return res.status(500).json({ error: 'Could not save notifications. ' + (await r.text()).slice(0, 120) });
      const first = String(member.name || '').split(' ')[0] || 'Sherni';
      await sendPush({ endpoint, p256dh, auth }, { title: 'Reminders are on!', body: `Nice, ${first}! You'll get your daily Sugar Break reminders here.`, tag: 'welcome' });
      return res.status(200).json({ ok: true });
    }

    if (action === 'pushtest') {
      const subs = await rows(`challenge_push?member_id=eq.${member.id}&select=endpoint,p256dh,auth`);
      if (!subs.length) return res.status(400).json({ error: 'Reminders are not turned on for this phone yet.' });
      let sent = 0;
      for (const s of subs) { const r = await sendPush(s, { title: 'Test reminder', body: 'This is how your Sugar Break reminders will look.', tag: 'test' }); if (r.ok) sent++; else if (r.gone) await sb(`challenge_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }); }
      return res.status(200).json({ ok: true, sent });
    }

    if (action === 'emailme') {
      const out = await sendMail(member.email, `Your Strong With Sherni login code: ${member.access_code}`, loginEmailHtml(member));
      if (!out.ok) return res.status(500).json({ error: 'Email could not be sent: ' + out.error });
      return res.status(200).json({ ok: true, sentTo: member.email });
    }

    if (action === 'update') {
      const today = todayIST();
      const attempts = await rows(`challenge_attempts?member_id=eq.${member.id}&select=*&order=attempt_date.asc`);
      const pr = progress(member, attempts, today);
      if (pr.status !== 'active') return res.status(400).json({ error: pr.status === 'pre' ? 'Your challenge hasn\'t started yet.' : 'This challenge is no longer active.' });
      const cur = pr.todayAttempt || { sugar_free: null, task_done: false, quiz_answer: null, quiz_correct: null, learned: false, craving: null };
      const b = req.body;
      const next = { ...cur };
      if (typeof b.sugar_free === 'boolean') next.sugar_free = b.sugar_free;
      if (typeof b.task_done === 'boolean') next.task_done = b.task_done;
      if (typeof b.learned === 'boolean') next.learned = b.learned;
      if (cur.quiz_answer == null && Number.isInteger(b.quiz_answer) && typeof b.quiz_correct === 'boolean') { next.quiz_answer = b.quiz_answer; next.quiz_correct = b.quiz_correct; } // quiz locks after first answer
      if (Number.isInteger(b.craving) && b.craving >= 1 && b.craving <= 5) next.craving = b.craving;
      const sc = scoreOf(next);
      const row = {
        member_id: member.id, attempt_date: today, day: pr.currentDay,
        sugar_free: next.sugar_free, task_done: !!next.task_done, quiz_answer: next.quiz_answer, quiz_correct: next.quiz_correct, learned: !!next.learned, craving: next.craving,
        points: sc.points, passed: sc.passed, updated_at: new Date().toISOString()
      };
      const r = await sb('challenge_attempts?on_conflict=member_id,attempt_date', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row)
      });
      if (!r.ok) return res.status(500).json({ error: 'Could not save. Please try again.', details: await r.text() });
      const pick = ({ attempt_date, day, sugar_free, task_done, quiz_answer, quiz_correct, learned, craving, points, passed }) => ({ attempt_date, day, sugar_free, task_done, quiz_answer, quiz_correct, learned, craving, points, passed });
      const known = [...attempts.filter(a => a.attempt_date !== today).map(pick), pick(row)].sort((x, y) => x.attempt_date < y.attempt_date ? -1 : 1);
      return res.status(200).json(await fullState(member, known));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
