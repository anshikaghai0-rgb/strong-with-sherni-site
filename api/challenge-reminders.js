// Challenge reminders (Sugar Break, 5 AM Club, ...): emails + phone notifications to members whose challenge is running.
// Vercel Cron calls this 3 times a day (see vercel.json). On the free Vercel plan a job can run
// any time within its hour, so each one is set at the start of the hour it should arrive in.
//   ?slot=morning   ~7:30 AM IST -> today's day is open + today's task + how to unlock
//   ?slot=afternoon ~5:30 PM IST (evening) -> only if steps are left: points so far + what's left
//   ?slot=evening   ~8:30 PM IST (night)   -> only if not unlocked: finish + sugar-free check before bed
// Nobody who has already unlocked today gets the evening/night email.
// Every reminder also goes out as a free phone notification to anyone who turned them on in the app.
//   (5 AM Club: its leaderboard comes with the ~8:30 PM run instead, combined with the bedtime nudge)
//   ?slot=wake      ~5:00 AM IST  -> 5 AM Club only: a wake-up phone notification
//   ?slot=standings ~10:00 PM IST -> fun batch leaderboard: top 3, your rank, gap to the person above
//                                      (the last person is never named to others, only told privately)
// Coach alert (with the morning run): anyone with no activity for 2 days is sent to the coach by
// email (REMINDER_EMAIL) with a one-tap WhatsApp button, and optionally to her WhatsApp via
// CallMeBot (COACH_WHATSAPP_PHONE + COACH_WHATSAPP_APIKEY).
import { progress, rows, loginLink } from './challenge.js';
import { sendPush } from './_push.js';

// Per-challenge wording. Add a new challenge here (same shape) to give it reminders too.
const CFG = {
  'sugar-break': {
    name: 'Sugar Break',
    titles: ["Clear the kitchen","Protein breakfast","Plain chai day","Plan the 4 PM snack","Water first","Label detective","Week 1 check-in","Sleep 7+ hours","Fibre at every meal","Craving rescue","Move after meals","Sugar-free dessert","Eat out smart","Week 2 check-in","Your 3 favourite swaps","Stress without sugar","Party plan","Sugar-free cooking","Learn to say no","Share your win","Your sugar rule"],
    steps: { quiz: 'Sugar quiz', craving: 'Cravings check', main: 'Sugar-free check (before bed)' },
    pass: 'stay sugar-free', mainShort: 'sugar-free check',
    morningTip: "Tip: do the task, learning and quiz this morning. That's 50 points done before lunch.",
    afternoonTip: 'Feeling a 4 PM craving? Open the app and tap SOS for quick help.',
    nightTip: d => `Had sugar today? No stress. Mark it honestly and you'll simply repeat Day ${d} tomorrow.`,
    nightPush: 'Mark your sugar-free check before you sleep.',
    lines: {
      morning: ['Small habits. Big life. Today is one more brick.', 'Your taste buds are resetting every single day you stay sugar-free.', 'Strong mornings make strong days. Start with protein.', "You don't need motivation, you need the next small step.", "Every sugar-free day is a vote for the person you're becoming.", 'Drink a glass of water before your chai today.', 'Progress, not perfection. Just today.'],
      afternoon: ['The 4 PM craving is real. Keep your snack ready: fruit with nuts or roasted chana.', 'Craving something sweet? Water first, wait 10 minutes, then decide.', "Evenings are where most people slip. You're not most people.", 'A 10-minute walk after your evening snack cuts cravings.', "Your batch is checking in too. You're not doing this alone.", 'Tea time? Make it plain chai with elaichi or cinnamon.', "You're closer than you think. A few taps and today is done."],
      evening: ["Two minutes before bed, that's all today needs.", "Be honest with yourself. That's what makes this work.", 'Sleep well tonight. Good sleep means fewer cravings tomorrow.', 'Every day you mark is a day your future self thanks you for.', "Don't let today go unmarked. You showed up, now count it.", "Tomorrow's day unlocks the moment you finish tonight.", 'Strong With Sherni means finishing what you start.']
    }
  },
  '5-am-club': {
    name: '5 AM Club',
    earlyLeaderboard: true,
    wake: [ // ~5:00 AM wake-up notification (phone notification only)
      ['Rise and shine, {name} ☀️', "It's 5 AM. Feet on the floor, water first. Tap to mark your wake-up check."],
      ['Good morning, {name}!', 'Your quiet hours start now. Alarm off, curtains open, glass of water.'],
      ['5 AM. You vs. the snooze button.', 'Win this one, {name}. Stand up and tap to check in.'],
      ['Up and at it, {name} 🌅', 'Daylight and water in the next 10 minutes. Then mark your wake-up check.'],
      ['The world is still asleep.', "You're not, {name}. Tap to start Day {day}."],
      ['Morning, Sherni!', 'One small step: get out of bed. The rest gets easier.'],
      ['Day {day} starts now ⏰', 'Water, light, stretch. Tap to check in.']
    ], // early sleepers: leaderboard + bedtime nudge go out together at ~8:30 PM, nothing at 10 PM
    titles: ["Find your why","Evening wind-down","Water first","Get daylight","Stretch it out","Plan your routine","Week 1 check-in","Hit your time","Add movement","Quiet minutes","Phone-free start","Breakfast ready","Easy day","Week 2 check-in","Full routine","Time for you","Top 3 tasks","Stay consistent","Share your morning","Notice the change","Your forever routine"],
    steps: { quiz: 'Sleep quiz', craving: 'Energy check', main: 'Wake-up check' },
    pass: 'wake up on time', mainShort: 'wake-up check',
    morningTip: "Up already? Mark your wake-up check now, then do today's task. That's 65 points before breakfast.",
    afternoonTip: 'Feeling sleepy this afternoon? A 20-minute power nap is fine. No coffee after 2 PM.',
    nightTip: () => 'Screens off 30 minutes before bed, alarm across the room, water by your bed. Tomorrow-you will thank you.',
    nightPush: 'Finish today, then wind down: screens off, alarm across the room.',
    lines: {
      morning: ['You beat the snooze button. That is a win already.', 'Morning light first, phone later.', 'The quiet hours are yours. Use them well.', 'Small habits. Big life. Today is one more brick.', "You don't need motivation, you need the next small step.", 'Water first, then the world.', 'Progress, not perfection. Just today.'],
      afternoon: ['No coffee after 2 PM tonight means an easier 5 AM tomorrow.', 'Afternoon slump? Step outside for 5 minutes of daylight.', "Your batch woke up early too. You're not doing this alone.", 'A short walk now helps you sleep better tonight.', 'Plan tonight: what time do you need to be in bed?', 'Keep dinner light and early for deeper sleep.', "You're closer than you think. A few taps and today is done."],
      evening: ['Bedtime is where tomorrow morning starts.', 'Lay out your clothes and water now.', 'Dim the lights and put the phone away.', 'Every early night makes 5 AM feel easier.', "Don't let today go unmarked. You showed up, now count it.", "Tomorrow's day unlocks the moment you finish today.", 'Strong With Sherni means finishing what you start.']
    }
  },
  'mindful-eating': {
    name: 'Mindful Eating', titles: ["One calm meal", "Breathe first", "Chew slowly", "Notice your food", "20-minute dinner", "Other hand", "Week 1 check-in", "Hunger scale", "Comfortably full", "Halfway pause", "Water first", "Name the feeling", "Guilt-free treat", "Week 2 check-in", "Three set meals", "Wait 5 minutes", "Stress plan", "Smaller first serving", "Share a meal", "Your 3 habits", "What you learned"],
    steps: { quiz: 'Food quiz', craving: 'Hunger check', main: 'Mindful meal check' },
    pass: 'eat one meal mindfully', mainShort: 'mindful meal check',
    morningTip: "Tip: read today's task now, then try it at your first meal.",
    afternoonTip: 'Snack urge? Water first, wait 10 minutes, then choose on purpose.',
    nightTip: d => `Rushed meals today? No stress. Mark it honestly and you'll simply repeat Day ${d} tomorrow.`,
    nightPush: 'Mark your mindful meal check before bed.',
    lines: {
      morning: ['Small habits. Big life. Today is one more brick.', "You don't need motivation, you need the next small step.", 'Progress, not perfection. Just today.', 'Water first, then the world.', 'Every day you show up counts.', 'Your batch is starting today too.', 'Strong mornings make strong days.'],
      afternoon: ["You're closer than you think. A few taps and today is done.", "Your batch is checking in too. You're not doing this alone.", 'A 10-minute walk now will lift your energy.', 'Halfway through the day. Keep going.', 'Drink a glass of water right now.', 'Small steps still move you forward.', 'Finish strong today.'],
      evening: ["Don't let today go unmarked. You showed up, now count it.", "Tomorrow's day unlocks the moment you finish tonight.", 'Strong With Sherni means finishing what you start.', 'Two minutes is all today needs.', "Be honest with yourself. That's what makes this work.", 'Every day you mark is a day your future self thanks you for.', 'Sleep well tonight. You earned it.']
    }
  },
  'wedding-season-ready': {
    name: 'Wedding Season Ready', titles: ["Set your goal", "Hydrate", "Protein power", "Morning walk", "Smart snack", "Beauty sleep", "Week 1 check-in", "Eat the rainbow", "Home workout", "Posture reset", "Skin-friendly day", "After-dinner walk", "Recovery day", "Week 2 check-in", "Level up", "Plan event meals", "Outfit walk", "Calm mind", "Steady day", "Pre-event prep", "Celebrate you"],
    steps: { quiz: 'Glow quiz', craving: 'Energy check', main: 'Daily basics check' },
    pass: 'hit your daily basics', mainShort: 'daily basics check',
    morningTip: 'Start with a big glass of water and protein at breakfast.',
    afternoonTip: 'Refill your water bottle and fit in your movement before dinner.',
    nightTip: d => `Missed some basics? No stress. Mark it honestly and you'll simply repeat Day ${d} tomorrow.`,
    nightPush: 'Mark your daily basics before bed.',
    lines: {
      morning: ['Small habits. Big life. Today is one more brick.', "You don't need motivation, you need the next small step.", 'Progress, not perfection. Just today.', 'Water first, then the world.', 'Every day you show up counts.', 'Your batch is starting today too.', 'Strong mornings make strong days.'],
      afternoon: ["You're closer than you think. A few taps and today is done.", "Your batch is checking in too. You're not doing this alone.", 'A 10-minute walk now will lift your energy.', 'Halfway through the day. Keep going.', 'Drink a glass of water right now.', 'Small steps still move you forward.', 'Finish strong today.'],
      evening: ["Don't let today go unmarked. You showed up, now count it.", "Tomorrow's day unlocks the moment you finish tonight.", 'Strong With Sherni means finishing what you start.', 'Two minutes is all today needs.', "Be honest with yourself. That's what makes this work.", 'Every day you mark is a day your future self thanks you for.', 'Sleep well tonight. You earned it.']
    }
  },
  'new-year-kickstart': {
    name: 'New Year Kickstart', days: 30, titles: ["Set your goal", "Water first", "Protein breakfast", "Drink smart", "Add veggies", "Balanced plate", "Week 1 check-in", "Walk after meals", "First workout", "Morning stretch", "You choose", "Walk and talk", "Rest day", "Week 2 check-in", "Set a bedtime", "Breathe to sleep", "Caffeine cut-off", "Gratitude", "Move and rest", "Screen-free evening", "Week 3 check-in", "Your top 3", "Best workout", "Meal prep", "New recipe", "Walk with someone", "Reflect", "Slip-up plan", "Full routine", "Next month goals"],
    steps: { quiz: 'Habit quiz', craving: 'Energy check', main: 'Daily habit check' },
    pass: 'complete your daily habit', mainShort: 'daily habit check',
    morningTip: "Tip: do today's task early, before the day gets busy.",
    afternoonTip: 'Fit in your movement and water before dinner.',
    nightTip: d => `Missed today? No stress. Mark it honestly and you'll simply repeat Day ${d} tomorrow.`,
    nightPush: 'Mark your daily habit check before bed.',
    lines: {
      morning: ['Small habits. Big life. Today is one more brick.', "You don't need motivation, you need the next small step.", 'Progress, not perfection. Just today.', 'Water first, then the world.', 'Every day you show up counts.', 'Your batch is starting today too.', 'Strong mornings make strong days.'],
      afternoon: ["You're closer than you think. A few taps and today is done.", "Your batch is checking in too. You're not doing this alone.", 'A 10-minute walk now will lift your energy.', 'Halfway through the day. Keep going.', 'Drink a glass of water right now.', 'Small steps still move you forward.', 'Finish strong today.'],
      evening: ["Don't let today go unmarked. You showed up, now count it.", "Tomorrow's day unlocks the moment you finish tonight.", 'Strong With Sherni means finishing what you start.', 'Two minutes is all today needs.', "Be honest with yourself. That's what makes this work.", 'Every day you mark is a day your future self thanks you for.', 'Sleep well tonight. You earned it.']
    }
  }
};
const cfgOf = m => CFG[m.challenge] || CFG['sugar-break'];
const daysOfC = c => c.days || 21;
const stepsOf = c => [
  { key: 'task_done', label: "Today's task", pts: 25 },
  { key: 'learned', label: "Today's learning", pts: 10 },
  { key: 'quiz', label: c.steps.quiz, pts: 15 },
  { key: 'craving', label: c.steps.craving, pts: 10 },
  { key: 'sugar_free', label: c.steps.main, pts: 40 }
];
const done = (a, k) => !a ? false : k === 'quiz' ? a.quiz_answer != null : k === 'sugar_free' ? a.sugar_free != null : !!a[k];
const todayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

function emailFor(slot, m, pr) {
  const c = cfgOf(m), STEPS = stepsOf(c), TITLES = c.titles;
  const first = shortName(m.name).split(' ')[0];
  const d = pr.currentDay, a = pr.todayAttempt, pts = (a && a.points) || 0;
  const left = STEPS.filter(s => !done(a, s.key));
  const ND = daysOfC(c);
  const next = d < ND ? `Day ${d + 1}` : 'your finish line';
  const list = (items, tick) => '<table style="width:100%;border-collapse:collapse;margin:12px 0">' + items.map(s => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${tick && done(a, s.key) ? '&#10003; ' : '&#9675; '}${s.label}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#7C3AED">${s.pts} pts</td></tr>`).join('') + '</table>';
  let subject, intro, body;
  if (slot === 'morning') {
    subject = `Day ${d} is open: ${TITLES[d - 1]}`;
    intro = `Good morning ${first}! Day ${d} of ${c.name} is open.`;
    body = `<p style="margin:0 0 6px"><b>Today's task:</b> ${TITLES[d - 1]}</p><p style="margin:0">Score <b>70 points</b> and ${c.pass} to unlock <b>${next}</b>. Here's today:</p>${list(STEPS, false)}<p style="margin:0;color:#6B6459">${c.morningTip}</p>`;
  } else if (slot === 'afternoon') {
    subject = `You're at ${pts}/100 points today`;
    intro = `Hi ${first}, quick check-in on Day ${d}.`;
    body = `<p style="margin:0">You have <b>${pts} points</b> so far. You need <b>70</b> and to ${c.pass} to unlock <b>${next}</b>. Still left:</p>${list(left, false)}<p style="margin:0;color:#6B6459">${c.afternoonTip}</p>`;
  } else {
    subject = `Tonight: unlock ${next}`;
    intro = `Hi ${first}, Day ${d} isn't unlocked yet.`;
    body = `<p style="margin:0">You're at <b>${pts}/100</b>. Finish these to unlock <b>${next}</b> tomorrow morning:</p>${list(left, false)}<p style="margin:0;color:#6B6459">${c.nightTip(d)}</p>`;
  }
  const line = c.lines[slot][(d - 1) % 7];
  body = `<p style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#F1E9FF;color:#5B21B6;font-weight:bold">${line}</p>` + body;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1424;background:#FAF9F3;padding:26px 22px;border-radius:14px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#C026D3;font-weight:bold">${c.name.toUpperCase()} · DAY ${d} OF ${ND}</p>
  <h2 style="font-family:Georgia,serif;margin:0 0 14px;color:#1a1424">${intro}</h2>${body}
  <p style="margin:20px 0 0"><a href="${loginLink(m)}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 24px;border-radius:24px;text-decoration:none;font-weight:bold">Open my app</a></p>
  <p style="margin:20px 0 0">Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni · Small habits. Big life.</span></p></div>`;
  const left2 = left.map(s => s.label.replace(' (before bed)', '').toLowerCase()).join(', ');
  const push = slot === 'morning' ? { title: `Day ${d} is open: ${TITLES[d - 1]}`, body: `Score 70 points and ${c.pass} to unlock ${next}. Tap to start.` }
    : slot === 'afternoon' ? { title: `You're at ${pts}/100 points today`, body: `Still left: ${left2}. A few taps and you're there!` }
    : { title: `Tonight: unlock ${next}`, body: `You're at ${pts}/100. ${c.nightPush}` };
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
  if (rank <= 3) return `You're <b>#${rank}</b>. So close to the top you can almost taste victory.${chase}`;
  if (rank === size) return `You're holding the last spot so firmly, honestly impressive. Plot twist time: one full day tomorrow and that spot belongs to someone else.${chase}`;
  if (rank <= Math.ceil(size / 2)) return `You're <b>#${rank} of ${size}</b>. Comfortably in the middle, like dal in a thali: essential, but not the star yet.${chase}`;
  return `You're <b>#${rank} of ${size}</b>. The top of the leaderboard misses you. Even 70 points tomorrow moves you up.${chase}`;
}
const HEADS = ['The Sherni standings are in!', 'Leaderboard drama, live from your batch', 'Who ruled today? Let\'s spill the chai', 'Tonight\'s rankings just dropped', 'Breaking news from the sugar-free arena', 'The scoreboard has spoken', 'Plot twists in tonight\'s leaderboard'];

async function standings(members, atts, today, nudge) {
  const batches = {};
  members.forEach(m => { const k = (m.challenge || 'sugar-break') + '|' + m.start_date; (batches[k] = batches[k] || []).push(m); });
  const emails = [];
  for (const [key, list] of Object.entries(batches)) {
    const start = key.split('|')[1], cname = cfgOf(list[0]).name;
    if (list.length < 2) continue;
    const day = Math.round((new Date(today + 'T00:00:00Z') - new Date(start + 'T00:00:00Z')) / 86400000) + 1;
    const board = list.map(m => { const p = atts.filter(a => a.member_id === m.id && a.passed); return { m, name: shortName(m.name), points: p.reduce((s, a) => s + (a.points || 0), 0), days: p.length }; })
      .sort((a, b) => b.points - a.points || b.days - a.days || a.name.localeCompare(b.name));
    board.forEach((x, i) => x.rank = i + 1);
    const medal = ['&#129351;', '&#129352;', '&#129353;'];
    const top = board.slice(0, 3).map((x, i) => `<tr><td style="padding:9px 0;border-bottom:1px solid #eee;font-size:16px">${medal[i]} <b>${x.name}</b></td><td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#7C3AED">${x.points} pts</td></tr>`).join('');
    const head = HEADS[(day - 1) % HEADS.length];
    for (const x of board) {
      if (nudge) { const pr = progress(x.m, atts.filter(a => a.member_id === x.m.id), today); x.unfinished = pr.status === 'active' && !(pr.todayAttempt && pr.todayAttempt.passed); }
      const above = x.rank > 1 ? board[x.rank - 2] : null;
      const first = shortName(x.m.name).split(' ')[0];
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1424;background:#FAF9F3;padding:26px 22px;border-radius:14px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#C026D3;font-weight:bold">${cname.toUpperCase()} · BATCH LEADERBOARD</p>
  <h2 style="font-family:Georgia,serif;margin:0 0 14px">${head}</h2>
  <table style="width:100%;border-collapse:collapse;margin:0 0 14px">${top}</table>
  <p style="margin:0 0 6px">Hey ${first}, you have <b>${x.points} points</b>.</p>${x.unfinished ? `<p style="margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#FFF1E6;color:#9A3412;font-weight:bold">Today isn't unlocked yet. Finish your steps before bed, then wind down: screens off, alarm across the room.</p>` : ''}
  <p style="margin:0;padding:12px;border-radius:10px;background:#F1E9FF;color:#3B1A6E">${rankLine(x.rank, board.length, above ? above.points - x.points : 0, above ? above.name : '')}</p>
  <p style="margin:20px 0 0"><a href="${loginLink(x.m)}" style="display:inline-block;background:#7C3AED;color:#fff;padding:13px 24px;border-radius:24px;text-decoration:none;font-weight:bold">See the full leaderboard</a></p>
  <p style="margin:20px 0 0">Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni · Small habits. Big life.</span></p></div>`;
      const pbody = (x.unfinished ? 'Today isn\'t unlocked yet, finish before bed! ' : '') + (x.rank === 1 ? `You're leading with ${x.points} points. Guard that crown!` : `Top: ${board[0].name} (${board[0].points}). You're #${x.rank}` + (above && above.points > x.points ? `, ${above.points - x.points} pts behind ${above.name.replace(/\.$/, '')}.` : '.'));
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
      const wa = waLink(x.m.phone, `Hi ${first}! Coach Sherni here. Missed you in ${cfgOf(x.m).name} the last couple of days. Everything okay? You're on Day ${x.day}, let's get you back on track today.`);
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee"><b>${x.m.name}</b><br><span style="color:#6B6459;font-size:13px">${cfgOf(x.m).name} · Day ${x.day} · last active ${x.last || 'never'} · ${x.m.phone || 'no phone'}</span></td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${wa ? `<a href="${wa}" style="background:#25D366;color:#fff;padding:8px 14px;border-radius:18px;text-decoration:none;font-weight:bold;font-size:13px">WhatsApp</a>` : ''}</td></tr>`;
    }).join('');
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="margin:0 0 6px">${inactive.length} challenge member${inactive.length > 1 ? 's' : ''} inactive for 2+ days</h2><p style="color:#6B6459;margin:0 0 12px">${today}. Tap WhatsApp to send a ready-made check-in message.</p><table style="width:100%;border-collapse:collapse">${rowsHtml}</table></div>`;
    const r = await sendBatch([{ to: [process.env.REMINDER_EMAIL], subject: `Check in: ${inactive.length} inactive in your challenges`, html }]);
    out.coachEmail = r.sent ? 'sent' : r.errors;
  }
  const ph = process.env.COACH_WHATSAPP_PHONE, key = process.env.COACH_WHATSAPP_APIKEY;
  if (ph && key) {
    const text = `Challenge check-in needed (${inactive.length}):\n` + inactive.map(x => `- ${x.m.name}, ${cfgOf(x.m).name} Day ${x.day}, last active ${x.last || 'never'}, ${x.m.phone || ''}`).join('\n');
    const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(ph)}&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(text)}`);
    out.coachWhatsApp = r.ok ? 'sent' : `failed ${r.status}`;
  }
  return out;
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  const slot = ['wake', 'morning', 'afternoon', 'evening', 'standings'].includes(req.query.slot) ? req.query.slot : null;
  if (!slot) return res.status(400).json({ error: 'slot must be wake, morning, afternoon, evening or standings' });
  try {
    const today = todayIST();
    const members = await rows(`challenge_members?start_date=lte.${today}&start_date=gt.${addDays(today, -60)}&select=id,name,email,phone,access_code,start_date,challenge`);
    if (!members.length) return res.status(200).json({ slot, sent: 0, note: 'No active members' });
    const atts = await rows(`challenge_attempts?member_id=in.(${members.map(m => m.id).join(',')})&select=member_id,attempt_date,day,sugar_free,task_done,quiz_answer,quiz_correct,learned,craving,points,passed`);
    if (slot === 'wake') {
      const items = [];
      for (const m of members) {
        const c = cfgOf(m); if (!c.wake) continue;
        const pr = progress(m, atts.filter(a => a.member_id === m.id), today);
        if (pr.status !== 'active' || (pr.todayAttempt && pr.todayAttempt.sugar_free != null)) continue;
        const [t, b] = c.wake[(pr.currentDay - 1) % c.wake.length];
        const fill = x => x.replace('{name}', shortName(m.name).split(' ')[0]).replace('{day}', pr.currentDay);
        items.push({ mid: m.id, push: { title: fill(t), body: fill(b), url: '/app.html', tag: 'sws-wake' } });
      }
      const p = await sendPushes(items);
      return res.status(200).json({ slot, today, eligible: items.length, ...p });
    }
    if (slot === 'standings') {
      const live = members.filter(m => !cfgOf(m).earlyLeaderboard && progress(m, atts.filter(a => a.member_id === m.id), today).status !== 'expired');
      const em = await standings(live, atts, today);
      const out = em.length ? await sendBatch(em) : { sent: 0, errors: [] };
      const p = await sendPushes(em);
      return res.status(200).json({ slot, today, eligible: em.length, ...out, ...p });
    }
    const emails = [], inactive = [];
    let early = [];
    if (slot === 'evening') { // early-leaderboard challenges: one combined message at night
      early = await standings(members.filter(m => cfgOf(m).earlyLeaderboard && progress(m, atts.filter(a => a.member_id === m.id), today).status !== 'expired'), atts, today, true);
      emails.push(...early);
    }
    const earlyIds = new Set(early.map(e => e.mid));
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
      if (slot === 'evening' && earlyIds.has(m.id)) continue; // already got the combined leaderboard + nudge
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
