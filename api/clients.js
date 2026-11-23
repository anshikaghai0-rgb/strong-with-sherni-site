// Client tracker + client portal (one serverless function, POST JSON { action, ... }).
//
// ADMIN (needs token from admin_login):
//   admin_login { password }                 -> { token }   password = app_settings.admin_password_hash (sha256) or ADMIN_PASSWORD env
//   list   { token }                         -> { clients:[...], site }
//   save   { token, id?, data }              -> insert / update a client (referral +10 days happens in the database trigger)
//   delete { token, id }
//   pushkey {} / pushsub { token, sub }       -> phone notifications for the admin
// CLIENT PORTAL (needs the personal link key k):
//   me       { k }                           -> the client's own plan, phase info, referrals, measurements
//   measure  { k, date, weight, waist, ... } -> add a measurement
//   measure_del { k, id }
// JOIN FORM (public, join.html — for clients who pay by UPI / bank transfer):
//   ref_check { code }                       -> { ok, referrer }  checks a friend's referral code
//   join { name, phone, ref }               -> the friend who referred gets +10 days straight away (once per phone number)
//   ADMIN: list also returns the last 30 days of form referrals; signup_undo { token, id } takes the 10 days back
import crypto from 'crypto';
import { vapidKeys, sendPush } from './_push.js';

const SITE = 'https://www.strongwithsherni.com';
const COACH_WA = '919036147675';
const MEASURES = ['weight', 'waist', 'hips', 'chest', 'arms', 'thighs'];
const EDITABLE = ['name', 'email', 'phone', 'password', 'join_date', 'payment_date', 'onboarding_date', 'duration', 'phase', 'phase_weeks',
  'pause_days', 'extension_days', 'referral_days', 'payment_status', 'intro_done', 'onboarding_done', 'notes', 'phase_override',
  'phase_override_date', 'referred_by', 'coach_note', 'amount', 'renewal_status', 'renewal_note', 'renewal_date'];

const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SBU = () => cleanUrl(process.env.SUPABASE_URL || process.env.CHALLENGE_SUPABASE_URL);
const SBK = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CHALLENGE_SUPABASE_KEY || '').trim();
export function db(path, opts = {}) {
  return fetch(`${SBU()}/rest/v1/${path}`, { ...opts, headers: { apikey: SBK(), Authorization: `Bearer ${SBK()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}
export async function rows(path) {
  const r = await db(path);
  if (!r.ok) throw new Error(`Database ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---- tokens ----
const secret = () => process.env.CHALLENGE_SECRET || SBK() || 'dev-secret';
const hmac = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
export const portalKey = id => `${Buffer.from(String(id)).toString('base64url')}.${hmac('client:' + id).slice(0, 22)}`;
export const portalLink = id => `${SITE}/my-plan.html?k=${portalKey(id)}`;
function clientFromKey(k) {
  if (!k || typeof k !== 'string' || !k.includes('.')) return null;
  const [b, sig] = k.split('.');
  let id; try { id = Buffer.from(b, 'base64url').toString(); } catch (e) { return null; }
  const good = hmac('client:' + id).slice(0, 22);
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
function adminToken() { const body = Buffer.from(JSON.stringify({ a: 1, e: Date.now() + 30 * 86400000 })).toString('base64url'); return `${body}.${hmac('admin:' + body)}`; }
function adminOk(t) {
  if (!t || typeof t !== 'string' || !t.includes('.')) return false;
  const [body, sig] = t.split('.'); const good = hmac('admin:' + body);
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).e > Date.now(); } catch (e) { return false; }
}
export async function checkAdminPassword(pw) {
  const got = crypto.createHash('sha256').update(String(pw || '')).digest('hex');
  let want = null;
  try { const s = await rows(`app_settings?key=eq.admin_password_hash&select=value`); want = s[0] && s[0].value; } catch (e) {}
  if (!want && process.env.ADMIN_PASSWORD) want = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest('hex');
  if (!want) return null;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(String(want).toLowerCase().padEnd(64).slice(0, 64)));
}
export async function setting(key, fallback) {
  try { const s = await rows(`app_settings?key=eq.${encodeURIComponent(key)}&select=value`); if (s[0] && s[0].value) return s[0].value; } catch (e) {}
  return fallback;
}

// ---- email + push ----
export async function sendMail(to, subject, html) {
  const key = process.env.RESEND_API_KEY || process.env.CHALLENGE_RESEND_KEY;
  if (!key || !to) return { ok: false };
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Strong With Sherni <hello@strongwithsherni.com>', to: [to], subject, html }) });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}
export async function pushAdmins(msg) {
  let subs = []; try { subs = await rows('admin_push?select=*'); } catch (e) { return 0; }
  let n = 0;
  for (const s of subs) {
    const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, msg).catch(() => ({}));
    if (r.ok) n++; else if (r.gone) await db(`admin_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' });
  }
  return n;
}
const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';
export const mailWrap = (inner) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2D322C;line-height:1.55">${inner}<p style="margin-top:22px">With love,<br><b>Coach Sherni</b> 🦁</p></div>`;
const btn = (href, label) => `<p><a href="${href}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">${label}</a></p>`;

// Referral thank-you to the person who referred (once).
export async function notifyReferral(friend) {
  if (!friend || !friend.referred_by || friend.referral_notified) return;
  const ref = (await rows(`clients?id=eq.${friend.referred_by}&select=id,name,email,referral_days`))[0];
  if (ref) {
    await sendMail(ref.email, `🎁 ${first(friend.name)} joined with your code! +10 days added to your plan`, mailWrap(
      `<p>Hi ${first(ref.name)},</p><p><b>${first(friend.name)}</b> just joined Strong With Sherni with your referral code. Thank you for spreading the love! 💛</p>
       <p>We've added <b>10 extra days</b> to your plan. You now have <b>${ref.referral_days || 10} referral days</b> in total.</p>${btn(portalLink(ref.id), 'See my plan')}`));
    await pushAdmins({ title: '🎁 New referral', body: `${first(friend.name)} joined with ${first(ref.name)}'s code. +10 days added to ${first(ref.name)}.`, url: '/admin.html' });
  }
  await db(`clients?id=eq.${friend.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ referral_notified: true }) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {}; const action = b.action;
  try {
    // ---------- client portal ----------
    if (action === 'me' || action === 'measure' || action === 'measure_del') {
      const id = clientFromKey(b.k);
      if (!id) return res.status(401).json({ error: 'This link is not valid. Please ask Coach Sherni for your personal link.' });
      const c = (await rows(`clients?id=eq.${id}&select=id,name,join_date,duration,phase,phase_weeks,pause_days,extension_days,referral_days,phase_override,phase_override_date,ref_code,coach_note,renewal_status`))[0];
      if (!c) return res.status(404).json({ error: 'We could not find your plan. Please message Coach Sherni.' });
      if (action === 'measure') {
        const row = { client_id: id, date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : new Date().toISOString().slice(0, 10) };
        let any = false;
        for (const m of MEASURES) { const v = Number(b[m]); if (b[m] !== '' && b[m] != null && isFinite(v) && v > 0 && v < 1000) { row[m] = v; any = true; } }
        if (!any) return res.status(400).json({ error: 'Add at least one measurement.' });
        const r = await db('client_measurements', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
        if (!r.ok) return res.status(500).json({ error: 'Could not save. Please try again.' });
      }
      if (action === 'measure_del' && /^[0-9a-f-]{36}$/i.test(b.id || '')) {
        await db(`client_measurements?id=eq.${b.id}&client_id=eq.${id}`, { method: 'DELETE' });
      }
      const [friends, ms] = await Promise.all([
        rows(`clients?referred_by=eq.${id}&select=name,join_date&order=join_date.asc`),
        rows(`client_measurements?client_id=eq.${id}&select=id,date,${MEASURES.join(',')}&order=date.asc`)
      ]);
      return res.status(200).json({ client: c, friends: friends.map(f => ({ name: first(f.name), date: f.join_date })), measurements: ms,
        shareUrl: `${SITE}/individual-coaching.html?ref=${encodeURIComponent(c.ref_code || '')}`, coachWa: COACH_WA });
    }

    // ---------- join form (UPI / bank transfer clients): name + phone + referral code ----------
    if (action === 'ref_check' || action === 'join') {
      const code = String(b.ref || b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
      const owner = code ? (await rows(`clients?ref_code=eq.${code}&select=id,name,email,phone,referral_days&limit=1`))[0] : null;
      if (action === 'ref_check') return res.status(200).json(owner ? { ok: true, referrer: first(owner.name) } : { ok: false });
      if (b.website) return res.status(200).json({ ok: true }); // spam bots fill this hidden field
      const name = String(b.name || '').trim().slice(0, 80), phone = String(b.phone || '').trim().slice(0, 20);
      const d10 = x => String(x || '').replace(/\D/g, '').slice(-10);
      if (!name || d10(phone).length < 10) return res.status(400).json({ error: 'Please add your name and WhatsApp number.' });
      if (!owner) return res.status(400).json({ error: "This referral code wasn't found. Please check the spelling." });
      if (d10(owner.phone) === d10(phone)) return res.status(400).json({ error: "You can't use your own referral code." });
      // one referral per phone number, ever
      const used = (await rows(`signups?status=in.(credited,added)&select=phone`)).some(r => d10(r.phone) === d10(phone));
      const already = (await rows(`clients?referred_by=not.is.null&select=phone`)).some(r => d10(r.phone) === d10(phone));
      if (used || already) return res.status(200).json({ ok: true, already: true, referrer: first(owner.name) });
      const ins = await db('signups', { method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ name, phone, ref_code: code, referrer_id: owner.id, status: 'credited' }) });
      if (!ins.ok) return res.status(500).json({ error: 'Could not submit right now. Please try again, or message us on WhatsApp.' });
      await db(`clients?id=eq.${owner.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ referral_days: Number(owner.referral_days || 0) + 10 }) });
      if (owner.email) await sendMail(owner.email, `🎁 ${first(name)} joined with your code! +10 days added to your plan`, mailWrap(
        `<p>Hi ${first(owner.name)},</p><p><b>${first(name)}</b> just joined Strong With Sherni with your referral code, so we've added <b>10 extra days</b> to your plan. Thank you for spreading the love! 💛</p>
         <p><a href="${portalLink(owner.id)}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">See my plan</a></p>`)).catch(() => {});
      await pushAdmins({ title: '🎁 Referral added', body: `${name} used ${first(owner.name)}'s code · +10 days added to ${first(owner.name)}`, url: '/admin.html', tag: 'sws-ref' }).catch(() => {});
      return res.status(200).json({ ok: true, referrer: first(owner.name) });
    }

    // ---------- admin ----------
    if (action === 'pushkey') return res.status(200).json({ publicKey: vapidKeys().publicKey });
    if (action === 'admin_login') {
      const ok = await checkAdminPassword(b.password);
      if (ok === null) return res.status(500).json({ error: 'Admin password is not set yet. Run the setup SQL in Supabase.' });
      if (!ok) return res.status(401).json({ error: 'Wrong password.' });
      return res.status(200).json({ token: adminToken() });
    }
    if (!adminOk(b.token)) return res.status(401).json({ error: 'Please log in again.' });

    if (action === 'list') {
      const [cs, su] = await Promise.all([rows('clients?select=*&order=created_at.asc'), rows(`signups?status=in.(credited,added)&created_at=gte.${new Date(Date.now() - 30 * 86400000).toISOString()}&select=*&order=created_at.desc`).catch(() => [])]);
      return res.status(200).json({ clients: cs.map(c => ({ ...c, portal: portalLink(c.id) })), signups: su });
    }
    if (action === 'signup_undo') { // a referral was added by mistake: take the 10 days back
      if (!/^[0-9a-f-]{36}$/i.test(b.id || '')) return res.status(400).json({ error: 'Bad id' });
      const su = (await rows(`signups?id=eq.${b.id}&select=*`))[0];
      if (!su || su.status === 'undone') return res.status(200).json({ ok: true });
      const ref = su.referrer_id && (await rows(`clients?id=eq.${su.referrer_id}&select=referral_days`))[0];
      if (ref) await db(`clients?id=eq.${su.referrer_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ referral_days: Math.max(0, Number(ref.referral_days || 0) - 10) }) });
      await db(`signups?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'undone' }) });
      return res.status(200).json({ ok: true });
    }
    if (action === 'save') {
      const data = {};
      for (const k of EDITABLE) if (b.data && k in b.data) data[k] = b.data[k] === '' ? null : b.data[k];
      if (!data.password && !b.id) data.password = String(crypto.randomInt(100000, 1000000));
      if (data.email) data.email = String(data.email).trim().toLowerCase();
      if (b.id && data.referred_by === b.id) data.referred_by = null;
      let formRef = null;
      if (!b.id && data.phone) { // already credited through the Join form? then link it, don't add 10 days again
        const d10 = x => String(x || '').replace(/\D/g, '').slice(-10);
        formRef = (await rows('signups?status=eq.credited&select=id,phone,referrer_id').catch(() => [])).find(r => d10(r.phone) === d10(data.phone) && d10(data.phone).length === 10);
        if (formRef) { data.referred_by = data.referred_by || formRef.referrer_id; if (data.referred_by === formRef.referrer_id) { data.referral_credited = true; data.referral_notified = true; } }
      }
      const r = b.id
        ? await db(`clients?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data) })
        : await db('clients', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(data) });
      if (!r.ok) return res.status(400).json({ error: (await r.text()).slice(0, 200) });
      const saved = (await r.json())[0];
      if (formRef && saved) await db(`signups?id=eq.${formRef.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'added', client_id: saved.id }) }).catch(() => {});
      if (saved && saved.referred_by && !saved.referral_notified) await notifyReferral(saved).catch(() => {});
      if (saved && !b.id) await pushAdmins({ title: '🦁 New client added', body: `${saved.name} · ${saved.duration || ''}`, url: '/admin.html' }).catch(() => {});
      return res.status(200).json({ ok: true, client: saved && { ...saved, portal: portalLink(saved.id) } });
    }
    if (action === 'delete') {
      if (!/^[0-9a-f-]{36}$/i.test(b.id || '')) return res.status(400).json({ error: 'Bad id' });
      await db(`clients?id=eq.${b.id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    if (action === 'pushsub') {
      const s = b.sub || {}; const keys = s.keys || {};
      if (!s.endpoint || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Bad subscription' });
      await db('admin_push', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ endpoint: s.endpoint, p256dh: keys.p256dh, auth: keys.auth }) });
      const n = await pushAdmins({ title: '✅ Alerts are on', body: 'You will get client alerts on this device.', url: '/admin.html' });
      return res.status(200).json({ ok: true, sent: n });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
