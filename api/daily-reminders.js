// Runs every morning (03:30 UTC = 9:00 AM IST) via Vercel Cron (see vercel.json).
//  1. Plan-ending alerts to Anshika: email (app_settings.alert_email, else REMINDER_EMAIL) + phone notification,
//     when a client reaches 15, 7 or 3 days left (each alert sent once per end date).
//  2. Phase-change message to the client: "Congrats, you're now in Phase N!" (email with their portal link).
//  3. Referral thank-you emails that weren't sent yet.
//  It also reads Supabase daily, which keeps the free project from pausing.
import { rows, db, sendMail, pushAdmins, notifyReferral, portalLink, setting, mailWrap } from './clients.js';

const DURATIONS = { '3 months': 90, '4 months': 120, '6 months': 180, '12 months': 365, '1 hour': 1, '7 days': 7, '10 days': 10, '14 days': 14, '21 days': 21, '30 days': 30 };
const DAY = 86400000;
const ALERT_AT = [15, 7, 3];
const fmt = d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';
const startOfDay = d => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const isTrial = c => c.phase === 'Trial' || c.phase === 'Challenge' || c.duration === '1 hour';
function phaseNow(c, now) {
  const len = (Number(c.phase_weeks) || 4) * 7;
  const m = /Phase (\d)/.exec(c.phase_override || '');
  const manual = !!(m && c.phase_override_date);
  const n0 = manual ? Number(m[1]) : 1;
  const start = manual ? startOfDay(c.phase_override_date).getTime() : startOfDay(c.join_date).getTime() + Number(c.pause_days || 0) * DAY;
  return Math.min(4, n0 + Math.floor(Math.max(0, Math.floor((now - start) / DAY)) / len));
}
const endDate = c => new Date(startOfDay(c.join_date).getTime() + ((DURATIONS[c.duration] || 0) + Number(c.pause_days || 0) + Number(c.extension_days || 0) + Number(c.referral_days || 0)) * DAY);
function wa(c, msg) {
  if (!c.phone) return null;
  const d = String(c.phone).replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(msg)}`;
}
const patch = (id, body) => db(`clients?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const clients = await rows('clients?select=*');
    const now = new Date();
    const alertTo = await setting('alert_email', process.env.REMINDER_EMAIL);
    const due = [], soon = [], phaseMsgs = [];

    for (const c of clients) {
      if (!c.join_date) continue;
      if (c.referred_by && !c.referral_notified) await notifyReferral(c).catch(() => {});
      if (isTrial(c)) continue;
      const end = endDate(c), left = Math.ceil((end - now) / DAY);
      if (left < 0) continue;

      // 1. plan-ending alerts at 15 / 7 / 3 days (once each, per end date)
      const endKey = end.toISOString().slice(0, 10);
      const sent = String(c.alerts_sent || '').startsWith(endKey + ':') ? String(c.alerts_sent).split(':')[1].split(',').filter(Boolean) : [];
      const hit = ALERT_AT.filter(t => left <= t && !sent.includes(String(t)));
      const msg = `Hi ${first(c.name)}! 👋 Your Strong With Sherni plan ends on ${fmt(end)} (${left} day${left === 1 ? '' : 's'} left). Let's talk about your next steps! 💪\n\nSee your plan: ${portalLink(c.id)}`;
      if (hit.length) {
        due.push({ c, left, end, link: wa(c, msg) });
        await patch(c.id, { alerts_sent: `${endKey}:${[...sent, ...hit.map(String)].join(',')}` });
      } else if (left <= 15) soon.push({ c, left, end, link: wa(c, msg) });

      // 2. phase change message to the client
      const n = phaseNow(c, now);
      if (c.last_phase_notified == null) await patch(c.id, { last_phase_notified: n }); // first run: remember only
      else if (n > c.last_phase_notified) {
        const r = await sendMail(c.email, `🎉 Congrats ${first(c.name)}, you're now in Phase ${n}!`, mailWrap(
          `<p>Hi ${first(c.name)},</p><p>You've just moved into <b>Phase ${n}</b> of your Strong With Sherni programme. That's real progress, and we're so proud of you! 💛</p>
           <p>Keep showing up. Phase ${n} is where it gets even better.</p>
           <p><a href="${portalLink(c.id)}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">See my progress</a></p>`));
        await patch(c.id, { last_phase_notified: n });
        phaseMsgs.push({ c, n, emailed: r.ok });
      }
    }

    if (due.length) {
      const li = x => `<li style="margin:6px 0"><b>${x.c.name}</b>: ${x.left} day${x.left === 1 ? '' : 's'} left (ends ${fmt(x.end)})${x.link ? ` · <a href="${x.link}">WhatsApp</a>` : ' · no phone'}</li>`;
      const html = mailWrap(`<h2 style="color:#7B0237;margin:0 0 8px">🔔 Reach out today (${due.length})</h2><ul>${due.map(li).join('')}</ul>
        ${soon.length ? `<h3 style="margin:18px 0 6px">Also ending within 15 days</h3><ul>${soon.map(li).join('')}</ul>` : ''}
        ${phaseMsgs.length ? `<h3 style="margin:18px 0 6px">🎉 Phase changes today (client emailed)</h3><ul>${phaseMsgs.map(p => `<li>${p.c.name} → Phase ${p.n}</li>`).join('')}</ul>` : ''}
        <p><a href="https://www.strongwithsherni.com/admin.html">Open the tracker</a></p>`);
      await sendMail(alertTo, `🔔 ${due.length} client${due.length > 1 ? 's' : ''} to reach out to today: ${due.map(x => first(x.c.name)).join(', ')}`, html);
      await pushAdmins({ title: `🔔 ${due.length} plan${due.length > 1 ? 's' : ''} ending soon`, body: due.map(x => `${first(x.c.name)} (${x.left}d)`).join(', ') + '. Tap to reach out.', url: '/admin.html', tag: 'sws-renewals' });
    }
    return res.status(200).json({ ok: true, alerts: due.length, soon: soon.length, phaseMessages: phaseMsgs.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
