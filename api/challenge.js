import crypto from 'crypto';

// Challenge app backend. One endpoint, four actions:
//   login   { email, code }            -> { token, member }
//   forgot  { email }                  -> emails the login code again
//   state   { token }                  -> { member, checkins, today }
//   checkin { token, day, sugar_free, task_done, craving }
// The Supabase service key never leaves the server.

const DAY = 86400000;
const TOKEN_DAYS = 60;

const secret = () => process.env.CHALLENGE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
const b64u = s => Buffer.from(s).toString('base64url');
function sign(memberId) {
  const body = b64u(JSON.stringify({ m: memberId, e: Date.now() + TOKEN_DAYS * DAY }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.e > Date.now() ? p.m : null;
}

function todayIST() { return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); }
function dayNumber(startDate) {
  return Math.floor((new Date(todayIST() + 'T00:00:00Z') - new Date(startDate + 'T00:00:00Z')) / DAY) + 1;
}

function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
}

const publicMember = m => ({ name: m.name, email: m.email, challenge: m.challenge, start_date: m.start_date, day: dayNumber(m.start_date) });

async function getMember(id) {
  const r = await sb(`challenge_members?id=eq.${encodeURIComponent(id)}&select=*`);
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { action } = req.body || {};

    if (action === 'login') {
      const email = String(req.body.email || '').trim().toLowerCase();
      const code = String(req.body.code || '').trim();
      if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Please enter your email and the 6-digit code.' });
      const r = await sb(`challenge_members?email=eq.${encodeURIComponent(email)}&access_code=eq.${code}&select=*&order=created_at.desc&limit=1`);
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) return res.status(401).json({ error: 'That email and code don\'t match. Check your welcome email.' });
      return res.status(200).json({ token: sign(rows[0].id), member: publicMember(rows[0]) });
    }

    if (action === 'forgot') {
      const email = String(req.body.email || '').trim().toLowerCase();
      const r = await sb(`challenge_members?email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=1`);
      const rows = r.ok ? await r.json() : [];
      if (rows.length && process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Strong With Sherni <onboarding@resend.dev>',
            to: [email],
            subject: `Your Strong With Sherni login code: ${rows[0].access_code}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:480px"><p>Hi ${String(rows[0].name || '').split(' ')[0]},</p><p>Your challenge app login code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#7B0237">${rows[0].access_code}</p><p><a href="https://www.strongwithsherni.com/app.html?login=${Buffer.from(`${email}:${rows[0].access_code}`).toString('base64url')}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p><p>Coach Sherni</p></div>`
          })
        });
      }
      // Same answer either way, so nobody can test which emails are registered.
      return res.status(200).json({ ok: true });
    }

    const memberId = verify(req.body.token);
    if (!memberId) return res.status(401).json({ error: 'Please log in again.' });
    const member = await getMember(memberId);
    if (!member) return res.status(401).json({ error: 'Please log in again.' });

    if (action === 'state') {
      const r = await sb(`challenge_checkins?member_id=eq.${memberId}&select=day,sugar_free,task_done,craving&order=day.asc`);
      return res.status(200).json({ member: publicMember(member), checkins: r.ok ? await r.json() : [], today: todayIST() });
    }

    if (action === 'checkin') {
      const day = Number(req.body.day);
      const current = dayNumber(member.start_date);
      if (!Number.isInteger(day) || day < 1 || day > 21 || day > current) return res.status(400).json({ error: 'You can only check in for today or earlier days.' });
      const row = { member_id: memberId, day, updated_at: new Date().toISOString() };
      if (typeof req.body.sugar_free === 'boolean') row.sugar_free = req.body.sugar_free;
      if (typeof req.body.task_done === 'boolean') row.task_done = req.body.task_done;
      if (Number.isInteger(req.body.craving) && req.body.craving >= 1 && req.body.craving <= 5) row.craving = req.body.craving;
      const r = await sb('challenge_checkins?on_conflict=member_id,day', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      if (!r.ok) return res.status(500).json({ error: 'Could not save. Please try again.', details: await r.text() });
      const saved = await r.json();
      return res.status(200).json({ ok: true, checkin: saved[0] });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
