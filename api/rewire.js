// REWIRE outreach: personal report links + private dashboard (POST JSON { action, ... }).
// PUBLIC (needs the personal code c):  opened { c } | vote { c, v:'yes'|'no' }
// ADMIN: login { password } -> { token } (same password as admin.html) | list { token } | sent { token, c } | update { token, c, call_status?, notes? }
import crypto from 'crypto';
import { checkAdminPassword, pushAdmins, sendMail } from './clients.js';

const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SBU = () => cleanUrl(process.env.SUPABASE_URL || process.env.CHALLENGE_SUPABASE_URL);
const SBK = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CHALLENGE_SUPABASE_KEY || '').trim();
const db = (path, opts = {}) => fetch(`${SBU()}/rest/v1/${path}`, { ...opts, headers: { apikey: SBK(), Authorization: `Bearer ${SBK()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
const secret = () => process.env.CHALLENGE_SECRET || SBK() || 'dev-secret';
const hmac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const token = () => { const b = Buffer.from(JSON.stringify({ e: Date.now() + 30 * 86400000 })).toString('base64url'); return `${b}.${hmac('rewire:' + b)}`; };
function tokenOk(t) {
  if (!t || typeof t !== 'string' || !t.includes('.')) return false;
  const [b, s] = t.split('.'); const g = hmac('rewire:' + b);
  if (!s || s.length !== g.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(g))) return false;
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()).e > Date.now(); } catch (e) { return false; }
}
const codeOk = c => typeof c === 'string' && /^[a-z0-9]{8}$/.test(c);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  try {
    if (b.action === 'opened' && codeOk(b.c)) {
      const r = await db(`rewire_leads?code=eq.${b.c}&select=open_count,opened_at`); const x = (await r.json())[0];
      if (!x) return res.status(404).json({ error: 'Not found' });
      const now = new Date().toISOString();
      await db(`rewire_leads?code=eq.${b.c}`, { method: 'PATCH', body: JSON.stringify({ open_count: (x.open_count || 0) + 1, opened_at: x.opened_at || now, last_open_at: now }) });
      return res.json({ ok: true });
    }
    if (b.action === 'vote' && codeOk(b.c) && (b.v === 'yes' || b.v === 'no')) {
      await db(`rewire_leads?code=eq.${b.c}`, { method: 'PATCH', body: JSON.stringify({ vote: b.v, voted_at: new Date().toISOString() }) });
      if (b.v === 'yes') {
        try {
          const p = (await (await db(`rewire_leads?code=eq.${b.c}&select=name,phone,tier,score,grp`)).json())[0] || {};
          const text = `${p.name || 'Someone'} (${p.tier || ''}) tapped YES on their REWIRE report. Call them now: ${p.phone || ''}`;
          await pushAdmins({ title: '🔥 REWIRE: someone said YES', body: text, url: '/rewire-dashboard.html' }).catch(() => {});
          if (process.env.REMINDER_EMAIL) await sendMail(process.env.REMINDER_EMAIL, `REWIRE YES: ${p.name || ''}`,
            `<p><b>${p.name || ''}</b> tapped <b>YES</b> on their REWIRE report.</p><p>Group: ${p.tier || ''} · Main problem: ${p.grp || ''}${p.score != null ? ' · Score ' + p.score : ''}</p><p>Phone: <b>${p.phone || ''}</b></p><p><a href="https://www.strongwithsherni.com/rewire-dashboard.html">Open REWIRE Calls</a></p>`).catch(() => {});
        } catch (e) {}
      }
      return res.json({ ok: true });
    }
    if (b.action === 'login') {
      const ok = await checkAdminPassword(b.password);
      if (!ok) return res.status(401).json({ error: 'Wrong password' });
      return res.json({ token: token() });
    }
    if (!tokenOk(b.token)) return res.status(401).json({ error: 'Please log in again' });
    if (b.action === 'list') {
      const r = await db('rewire_leads?select=code,name,first,phone,email,wa_ok,priority,tier,region,rewire_answer,age,score,grp,weak_txt,good_txt,ask,pitch,keep,script,sent_at,opened_at,open_count,vote,voted_at,call_status,notes&order=name.asc');
      return res.json({ leads: await r.json() });
    }
    if (b.action === 'sent' && codeOk(b.c)) {
      await db(`rewire_leads?code=eq.${b.c}&sent_at=is.null`, { method: 'PATCH', body: JSON.stringify({ sent_at: new Date().toISOString() }) });
      return res.json({ ok: true });
    }
    if (b.action === 'update' && codeOk(b.c)) {
      const patch = {};
      if (typeof b.call_status === 'string') patch.call_status = b.call_status.slice(0, 40);
      if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 2000);
      await db(`rewire_leads?code=eq.${b.c}`, { method: 'PATCH', body: JSON.stringify(patch) });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
}
