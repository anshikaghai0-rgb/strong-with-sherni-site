// Sugar Break reminders: 3 emails a day to members whose challenge is running.
// Vercel Cron calls this 3 times a day (see vercel.json). On the free Vercel plan a job can run
// any time within its hour, so each one is set at the start of the hour it should arrive in.
//   ?slot=morning   ~7:30 AM IST -> today's day is open + today's task + how to unlock
//   ?slot=afternoon ~5:30 PM IST (evening) -> only if steps are left: points so far + what's left
//   ?slot=evening   ~8:30 PM IST (night)   -> only if not unlocked: finish + sugar-free check before bed
// Nobody who has already unlocked today gets the evening/night email.
// Every reminder also goes out as a free phone notification to anyone who turned them on in the app.
//   ?slot=standings ~10:00 PM IST -> fun batch leaderboard: top 3, your rank, gap to the person above
//                                      (the last person is never named to others, only told privately)
// Coach alert (with the morning run): anyone with no activity for 2 days is sent to the coach by
// email (REMINDER_EMAIL) with a one-tap WhatsApp button, and optionally to her WhatsApp via
// CallMeBot (COACH_WHATSAPP_PHONE + COACH_WHATSAPP_APIKEY).
import { progress, rows, loginLink } from './challenge.js';
import { sendPush } from './_push.js';

const TITLES = ["Clear the kitchen","Protein breakfast","Plain chai day","Plan the 4 PM snack","Water first","Label detective","Week 1 check-in","Sleep 7+ hours","Fibre at every meal","Craving rescue","Move after meals","Sugar-free dessert","Eat out smart","Week 2 check-in","Your 3 favourite swaps","Stress without sugar","Party plan","Sugar-free cooking","Learn to say no","Share your win","Your sugar rule"];
const STEPS = [
  { key: 'task_done', label: "Today's task", pts: 25 },
  { key: 'learned', label: "Today's learning", pts: 10 },
  { key: 'quiz', label: 'Sugar quiz', pts: 15 },
  { key: 'craving', label: 'Cravings check', pts: 10 },
  { key: 'sugar_free', label: 'Sugar-free check (before bed)', pts: 40 }
];
// A different line each day so the emails don't feel repeated.
const LINES = {
  morning: ['Small habits. Big life. Today is one more brick.', 'Your taste buds are resetting every single day you stay sugar-free.', 'Strong mornings make strong days. Start with protein.', 'You don\'t need motivation, you need the next small step.', 'Every sugar-free day is a vote for the person you\'re becoming.', 'Drink a glass of water before your chai today.', 'Progress, not perfection. Just today.'],
  afternoon: ['The 4 PM craving is real. Keep your snack ready: fruit with nuts or roasted chana.', 'Craving something sweet? Water first, wait 10 minutes, then decide.', 'Evenings are where most people slip. You\'re not most people.', 'A 10-minute walk after your evening snack cuts cravings.', 'Your batch is checking in too. You\'re not doing this alone.', 'Tea time? Make it plain chai with elaichi or cinnamon.', 'You\'re closer than you think. A few taps and today is done.'],
  evening: ['Two minutes before bed, that\'s all today needs.', 'Be honest with yourself. That\'s what makes this work.', 'Sleep well tonight. Good sleep means fewer cravings tomorrow.', 'Every day you mark is a day your future self thanks you for.', 'Don\'t let today go unmarked. You showed up, now count it.', 'Tomorrow\'s day unlocks the moment you finish tonight.', 'Strong With Sherni means finishing what you start.']
};
const done = (a, k) => !a ? false : k === 'quiz' ? a.quiz_answer != null : k === 'sugar_free' ? a.sugar_free != null : !!a[k];
const todayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

function emailFor(slot, m, pr) {
  const first = shortName(m.name).split(' ')[0];
  const d = pr.currentDay, a = pr.todayAttempt, pts = (a && a.points) || 0;
  const left = STEPS.filter(s => !done(a, s.key));
  const next = d < 21 ? `Day ${d + 1}` : 'your finish line';
  const list = (items, tick) => '<table style="width:100%;border-collapse:collapse;margin:12px 0">' + items.map(s => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${tick && done(a, s.key) ? '&#10003; ' : '&#9675; '}${s.label}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#7C3AED">${s.pts} pts</td></tr>`).join('') + '</table>';
  let subject, intro, body;
  if (slot === 'morning') {
    subject = `Day ${d} is open: ${TITLES[d - 1]}`;
    intro = `Good morning ${first}! Day ${d} of Sugar Break is open.`;
    body = `<p style="margin:0 0 6px"><b>Today's task:</b> ${TITLES[d - 1]}</p><p style="margin:0">Score <b>70 points</b> and stay sugar-free to unlock <b>${next}</b>. Here's today:</p>${list(STEPS, false)}<p style="margin:0;color:#6B6459">Tip: do the task, learning and quiz this morning. That's 50 points done before lunch.</p>`;
  } else if (slot === 'afternoon') {
    subject = `You're at ${pts}/100 points today`;
    intro = `Hi ${first}, quick check-in on Day ${d}.`;
    body = `<p style="margin:0">You have <b>${pts} points</b> so far. You need <b>70</b> and a sugar-free day to unlock <b>${next}</b>. Still left:</p>${list(left, false)}<p style="margin:0;color:#6B6459">Feeling a 4 PM craving? Open the app and tap SOS for quick help.</p>`;
  } else {
    subject = `Before bed: unlock ${next}`;
    intro = `Hi ${first}, Day ${d} isn't unlocked yet.`;
    body = `<p style="margin:0">You're at <b>${pts}/100</b>. Finish these before you sleep to unlock <b>${next}</b> tomorrow morning:</p>${list(left, false)}<p style="margin:0;color:#6B6459">Had sugar today? No stress. Mark it honestly and you'll simply repeat Day ${d} tomorrow.</p>`;
  }
  const line = LINES[slot][(d - 1) % 7];
  body = `<p style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#F1E9FF;color:#5B21B6;font-weight:bold">${line}</p>` + body;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1424;background:#FAF9F3;padding:26px 22px;border-radius:14px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#C026D3;font-weight:bold">SUGAR BREAK · DAY ${d} OF 21</p>
  <h2 style="font-family:Georgia,serif;margin:0 0 14px;color:#1a1424">${intro}</h2>${body}
  <p style="margin:20px 0 0"><a href="${loginLink(m)}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 24px;border-radius:24px;text-decoration:none;font-weight:bold">Open my app</a></p>
  <p style="margin:20px 0 0">Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni · Small habits. Big life.</span></p></div>`;
  const left2 = left.map(s => s.label.replace(' (before bed)', '').toLowerCase()).join(', ');
  const push = slot === 'morning' ? { title: `Day ${d} is open: ${TITLES[d - 1]}`, body: `Score 70 points and stay sugar-free to unlock ${next}. Tap to start.` }
    : slot === 'afternoon' ? { title: `You're at ${pts}/100 points today`, body: `Still left: ${left2}. A few taps and you're there!` }
    : { title: `Before bed: unlock ${next}`, body: `You're at ${pts}/100. Mark your sugar-free check before you sleep.` };
  return { to: [m.email], subject, html, mid: m.id, push: { ...push, url: '/app.html', tag: 'sws-' + slot } };
}

async function sendBatch(emails) {
  const key = String(process.env.RESEND_API_KEY || '').trim() || String(process.env.CHALLENGE_RESEND_KEY || '').trim();
  if (!key) return { sent: 0, errors: ['No email key set (RESEND_API_KEY).'] };
  const from = String(process.env.EMAIL_FROM || '').trim() || 'Strong With Sherni <hello@strongwithsherni.com>';
  let sent = 0; const errors = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100).map(({ to, subject, html }) => ({ from, to, subject, html }));
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(chunk) });
    if (r.ok) sent += chunk.length; else errors.push((await r.text()).slice(0, 200));
  }
  return { sent, errors };
}

const shortName = n => { const p = String(n || 'Sherni').trim().split(/\s+/); const f = p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase(); return f + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : ''); };
function rankLine(rank, size, gap, above) {
  const chase = above && gap > 0 ? ` You're just <b>${gap} points</b> behind ${above.replace(/\.$/, "")}. Just saying.` : '';
  if (rank === 1) return `You're <b>#1</b>. The crown is heavy, but so is your discipline. Everyone is coming for it tomorrow, so guard it like the last laddoo at a wedding (that you won't eat).`;
  if (rank <= 3) return `You're <b>#${rank}</b>. So close to the top you can smell the (sugar-free) victory.${chase}`;
  if (rank === size) return `You're holding the last spot so firmly, honestly impressive. Plot twist time: one full day tomorrow and that spot belongs to someone else.${chase}`;
  if (rank <= Math.ceil(size / 2)) return `You're <b>#${rank} of ${size}</b>. Comfortably in the middle, like dal in a thali: essential, but not the star yet.${chase}`;
  return `You're <b>#${rank} of ${size}</b>. The top of the leaderboard misses you. Even 70 points tomorrow moves you up.${chase}`;
}
const HEADS = ['The Sherni standings are in!', 'Leaderboard drama, live from your batch', 'Who ruled today? Let\'s spill the (sugar-free) chai', 'Tonight\'s rankings just dropped', 'Breaking news from the sugar-free arena', 'The scoreboard has spoken', 'Plot twists in tonight\'s leaderboard'];

async function standings(members, atts, today) {
  const batches = {};
  members.forEach(m => (batches[m.start_date] = batches[m.start_date] || []).push(m));
  const emails = [];
  for (const [start, list] of Object.entries(batches)) {
    if (list.length < 2) continue;
    const day = Math.round((new Date(today + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 86400000) + 1;
    const board = list.map(m => { const p = atts.filter(a => a.member_id === m.id && a.passed); return { m, name: shortName(m.name), points: p.reduce((s, a) => s + (a.points || 0), 0), days: p.length }; })
      .sort((a, b) => b.points - a.points || b.days - a.days || a.name.localeCompare(b.name));
    board.forEach((x, i) => x.rank = i + 1);
    const medal = ['&#129351;', '&#129352;', '&#129353;'];
    const top = board.slice(0, 3).map((x, i) => `<tr><td style="padding:9px 0;border-bottom:1px solid #eee;font-size:16px">${medal[i]} <b>${x.name}</b></td><td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#7C3AED">${x.points} pts</td></tr>`).join('');
    const head = HEADS[(day - 1) % HEADS.length];
    for (const x of board) {
      const above = x.rank > 1 ? board[x.rank - 2] : null;
      const first = shortName(x.m.name).split(' ')[0];
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1424;background:#FAF9F3;padding:26px 22px;border-radius:14px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#C026D3;font-weight:bold">SUGAR BREAK · BATCH LEADERBOARD</p>
  <h2 style="font-family:Georgia,serif;margin:0 0 14px">${head}</h2>
  <table style="width:100%;border-collapse:collapse;margin:0 0 14px">${top}</table>
  <p style="margin:0 0 6px">Hey ${first}, you have <b>${x.points} points</b>.</p>
  <p style="margin:0;padding:12px;border-radius:10px;background:#F1E9FF;color:#3B1A6E">${rankLine(x.rank, board.length, above ? above.points - x.points : 0, above ? above.name : '')}</p>
  <p style="margin:20px 0 0"><a href="${loginLink(x.m)}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 24px;border-radius:24px;text-decoration:none;font-weight:bold">See the full leaderboard</a></p>
  <p style="margin:20px 0 0">Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni · Small habits. Big life.</span></p></div>`;
      const pbody = x.rank === 1 ? `You're leading with ${x.points} points. Guard that crown!` : `Top: ${board[0].name} (${board[0].points}). You're #${x.rank}` + (above && above.points > x.points ? `, ${above.points - x.points} pts behind ${above.name.replace(/\.$/, '')}.` : '.');
      emails.push({ to: [x.m.email], subject: x.rank === 1 ? `You're #1 tonight, ${first}!` : `${head} (you're #${x.rank})`, html, mid: x.m.id, push: { title: x.rank === 1 ? `You're #1 tonight, ${first}!` : head, body: pbody, url: '/app.html', tag: 'sws-standings' } });
    }
  }
  return emails;
}

async function sendPushes(items) {
  const ids = [...new Set(items.filter(x => x.mid && x.push).map(x => x.mid))];
  if (!ids.length) return { pushed: 0 };
  const subs = await rows(`challenge_push?member_id=in.(${ids.join(',')})&select=endpoint,member_id,p256dh,auth`).catch(() => []);
  let pushed = 0;
  for (const x of items) {
    for (const s of subs.filter(s => s.member_id === x.mid)) {
      const r = await sendPush(s, x.push);
      if (r.ok) pushed++;
      else if (r.gone) await fetch(`${String(process.env.CHALLENGE_SUPABASE_URL || process.env.SUPABASE_URL).trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')}/rest/v1/challenge_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: { apikey: String(process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY).trim(), Authorization: `Bearer ${String(process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY).trim()}` } }).catch(() => {});
    }
  }
  return { pushed };
}

const waLink = (phone, msg) => { const dg = String(phone || '').replace(/\D/g, ''); if (!dg) return null; return `https://wa.me/${dg.length === 10 ? '91' + dg : dg}?text=${encodeURIComponent(msg)}`; };

async function coachAlert(inactive, today) {
  if (!inactive.length) return { coach: 'nobody inactive' };
  const out = {};
  if (process.env.REMINDER_EMAIL) {
    const rowsHtml = inactive.map(x => {
      const first = String(x.m.name || '').split(' ')[0] || 'there';
      const wa = waLink(x.m.phone, `Hi ${first}! Coach Sherni here. Missed you in Sugar Break the last couple of days. Everything okay? You're on Day ${x.day}, let's get you back on track today.`);
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><b>${x.m.name}</b><br><span style="color:#6B6459;font-size:13px">Day ${x.day} · last active ${x.last || 'never'} · ${x.m.phone || 'no phone'}</span></td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${wa ? `<a href="${wa}" style="background:#25D366;color:#fff;padding:8px 14px;border-radius:18px;text-decoration:none;font-weight:bold;font-size:13px">WhatsApp</a>` : ''}</td></tr>`;
    }).join('');
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="margin:0 0 6px">${inactive.length} Sugar Break member${inactive.length > 1 ? 's' : ''} inactive for 2+ days</h2><p style="color:#6B6459;margin:0 0 12px">${today}. Tap WhatsApp to send a ready-made check-in message.</p><table style="width:100%;border-collapse:collapse">${rowsHtml}</table></div>`;
    const r = await sendBatch([{ to: [process.env.REMINDER_EMAIL], subject: `Check in: ${inactive.length} inactive in Sugar Break`, html }]);
    out.coachEmail = r.sent ? 'sent' : r.errors;
  }
  const ph = process.env.COACH_WHATSAPP_PHONE, key = process.env.COACH_WHATSAPP_APIKEY;
  if (ph && key) {
    const text = `Sugar Break check-in needed (${inactive.length}):\n` + inactive.map(x => `- ${x.m.name}, Day ${x.day}, last active ${x.last || 'never'}, ${x.m.phone || ''}`).join('\n');
    const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(ph)}&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}`);
    out.coachWhatsApp = r.ok ? 'sent' : `failed ${r.status}`;
  }
  return out;
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  const slot = ['morning', 'afternoon', 'evening', 'standings'].includes(req.query.slot) ? req.query.slot : null;
  if (!slot) return res.status(400).json({ error: 'slot must be morning, afternoon, evening or standings' });
  try {
    const today = todayIST();
    const members = await rows(`challenge_members?challenge=eq.sugar-break&start_date=lte.${today}&start_date=gt.${addDays(today, -42)}&select=id,name,email,phone,access_code,start_date`);
    if (!members.length) return res.status(200).json({ slot, sent: 0, note: 'No active members' });
    const atts = await rows(`challenge_attempts?member_id=in.(${members.map(m => m.id).join(',')})&select=member_id,attempt_date,day,sugar_free,task_done,quiz_answer,quiz_correct,learned,craving,points,passed`);
    if (slot === 'standings') {
      const live = members.filter(m => progress(m, atts.filter(a => a.member_id === m.id), today).status !== 'expired');
      const em = await standings(live, atts, today);
      const out = em.length ? await sendBatch(em) : { sent: 0, errors: [] };
      const p = await sendPushes(em);
      return res.status(200).json({ slot, today, eligible: em.length, ...out, ...p });
    }
    const emails = [], inactive = [];
    const touched = a => a.points > 0 || a.task_done || a.learned || a.quiz_answer != null || a.craving || a.sugar_free != null;
    for (const m of members) {
      const mine = atts.filter(a => a.member_id === m.id);
      const pr = progress(m, mine, today);
      if (pr.status !== 'active') continue;
      if (slot === 'morning') {
        const started = Math.round((new Date(today + 'T00:00:00Z') - new Date(m.start_date + 'T00:00:00Z')) / 86400000);
        const recent = mine.filter(a => a.attempt_date >= addDays(today, -2) && a.attempt_date < today && touched(a));
        if (started >= 2 && !recent.length) {
          const lastA = mine.filter(touched).map(a => a.attempt_date).sort().pop();
          inactive.push({ m, day: pr.currentDay, last: lastA });
        }
      }
      const a = pr.todayAttempt;
      if (a && a.passed) continue; // already unlocked today
      if (slot === 'afternoon' && a && done(a, 'task_done') && done(a, 'learned') && done(a, 'quiz') && done(a, 'craving')) continue; // only the bedtime check left
      emails.push(emailFor(slot, m, pr));
    }
    const out = emails.length ? await sendBatch(emails) : { sent: 0, errors: [] };
    Object.assign(out, await sendPushes(emails));
    const coach = slot === 'morning' ? await coachAlert(inactive, today) : undefined;
    return res.status(200).json({ slot, today, eligible: emails.length, ...out, inactive: inactive.length, coach });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
