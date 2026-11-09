import crypto from 'crypto';

// Challenge app backend (unlock system). One endpoint, four actions:
//   login   { email, code }  -> { token }
//   forgot  { email }        -> emails the login code again
//   state   { token }        -> progress, today's attempt, scorecard
//   update  { token, sugar_free?, task_done?, quiz_answer?, quiz_correct?, craving? }
//
// Rules:
//   - One attempt per calendar day (India time). Today's attempt is always the next locked day.
//   - Points: sugar-free 40, task 30, quiz 20 (10 if wrong), craving level 10.
//   - A day is PASSED with 70+ points AND sugar-free = yes. The next day unlocks the next morning.
//   - Ate sugar / under 70 points -> the same day repeats tomorrow.
//   - 42-day window from start_date to finish all 21 days, after that the challenge expires.

const DAY = 86400000;
const TOTAL_DAYS = 21, WINDOW = 42;
const P = { sugarFree: 40, task: 30, quizRight: 20, quizWrong: 10, craving: 10, unlock: 70 };
const TOKEN_DAYS = 60;

const secret = () => process.env.CHALLENGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
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
  if (a.craving) pts += P.craving;
  return { points: pts, passed: a.sugar_free === true && pts >= P.unlock };
}

export function progress(member, attempts, today = todayIST()) {
  const past = attempts.filter(a => a.attempt_date < today);
  const passedBefore = past.filter(a => a.passed).length;
  const todayAttempt = attempts.find(a => a.attempt_date === today) || null;
  const passedTotal = passedBefore + (todayAttempt && todayAttempt.passed ? 1 : 0);
  const dayIdx = daysBetween(member.start_date, today); // 0 on start day
  const windowLeft = WINDOW - dayIdx; // days left including today
  let status = 'active';
  if (dayIdx < 0) status = 'pre';
  else if (passedBefore >= TOTAL_DAYS) status = 'complete';
  else if (dayIdx >= WINDOW) status = 'expired';
  // streak: consecutive passed calendar days ending today (if passed) or yesterday
  const byDate = Object.fromEntries(attempts.map(a => [a.attempt_date, a]));
  let streak = 0, d = todayAttempt && todayAttempt.passed ? today : addDays(today, -1);
  while (byDate[d] && byDate[d].passed) { streak++; d = addDays(d, -1); }
  const passedList = attempts.filter(a => a.passed);
  return {
    status,
    currentDay: Math.min(TOTAL_DAYS, passedBefore + 1),
    todayAttempt,
    startsIn: dayIdx < 0 ? -dayIdx : 0,
    windowLeft: Math.max(0, windowLeft),
    windowEnd: addDays(member.start_date, WINDOW - 1),
    score: {
      points: passedList.reduce((s, a) => s + (a.points || 0), 0),
      maxPoints: TOTAL_DAYS * 100,
      daysCompleted: passedTotal,
      repeats: past.filter(a => !a.passed).length,
      streak
    }
  };
}

function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
}
async function rows(path) { const r = await sb(path); return r.ok ? r.json() : []; }

async function fullState(member) {
  const attempts = await rows(`challenge_attempts?member_id=eq.${member.id}&select=attempt_date,day,sugar_free,task_done,quiz_answer,quiz_correct,craving,points,passed&order=attempt_date.asc`);
  return {
    member: { name: member.name, email: member.email, challenge: member.challenge, start_date: member.start_date },
    attempts,
    today: todayIST(),
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
      if (found.length && process.env.RESEND_API_KEY) {
        const m = found[0];
        const link = `https://www.strongwithsherni.com/app.html?login=${Buffer.from(`${email}:${m.access_code}`).toString('base64url')}`;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Strong With Sherni <onboarding@resend.dev>',
            to: [email],
            subject: `Your Strong With Sherni login code: ${m.access_code}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px"><p>Hi ${String(m.name || '').split(' ')[0]},</p><p>Tap below to open your challenge app:</p><p><a href="${link}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p><p>Your code: <b style="font-size:20px;letter-spacing:4px">${m.access_code}</b></p><p>Coach Sherni</p></div>`
          })
        });
      }
      return res.status(200).json({ ok: true }); // same answer either way
    }

    const memberId = verify(req.body.token);
    if (!memberId) return res.status(401).json({ error: 'Please log in again.' });
    const found = await rows(`challenge_members?id=eq.${encodeURIComponent(memberId)}&select=*`);
    const member = found[0];
    if (!member) return res.status(401).json({ error: 'Please log in again.' });

    if (action === 'state') return res.status(200).json(await fullState(member));

    if (action === 'update') {
      const today = todayIST();
      const attempts = await rows(`challenge_attempts?member_id=eq.${member.id}&select=*&order=attempt_date.asc`);
      const pr = progress(member, attempts, today);
      if (pr.status !== 'active') return res.status(400).json({ error: pr.status === 'pre' ? 'Your challenge hasn\'t started yet.' : 'This challenge is no longer active.' });
      const cur = pr.todayAttempt || { sugar_free: null, task_done: false, quiz_answer: null, quiz_correct: null, craving: null };
      const b = req.body;
      const next = { ...cur };
      if (typeof b.sugar_free === 'boolean') next.sugar_free = b.sugar_free;
      if (typeof b.task_done === 'boolean') next.task_done = b.task_done;
      if (cur.quiz_answer == null && Number.isInteger(b.quiz_answer) && typeof b.quiz_correct === 'boolean') { next.quiz_answer = b.quiz_answer; next.quiz_correct = b.quiz_correct; } // quiz locks after first answer
      if (Number.isInteger(b.craving) && b.craving >= 1 && b.craving <= 5) next.craving = b.craving;
      const sc = scoreOf(next);
      const row = {
        member_id: member.id, attempt_date: today, day: pr.currentDay,
        sugar_free: next.sugar_free, task_done: !!next.task_done, quiz_answer: next.quiz_answer, quiz_correct: next.quiz_correct, craving: next.craving,
        points: sc.points, passed: sc.passed, updated_at: new Date().toISOString()
      };
      const r = await sb('challenge_attempts?on_conflict=member_id,attempt_date', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row)
      });
      if (!r.ok) return res.status(500).json({ error: 'Could not save. Please try again.', details: await r.text() });
      return res.status(200).json(await fullState(member));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
