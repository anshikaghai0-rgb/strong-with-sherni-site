import crypto from 'crypto';
import { SITE, GROUPS, challengeSlug, baseOf, levelOf, challengeName as chName, batchStartIST, newAccessCode, refCodeFor, refLink, dbRows } from './_shared.js';

// This runs on Vercel's server. It checks the payment is genuinely real (not faked).
// - Coaching plans: creates the client record in the Supabase 'clients' table (same as before).
// - Challenges: creates a challenge member with a 6-digit app login code and emails the
//   client their welcome email (WhatsApp group link + app link + login code).

const DAY = 86400000;

function prettyDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

// One line under the welcome heading, per challenge.
const TAGLINES = { 'sugar-break': '21 days. Zero added sugar. You\'ve got this.', '5-am-club': '21 days to own your mornings. You\'ve got this.', 'mindful-eating': '21 days to slow down and enjoy food without guilt.', 'wedding-season-ready': '21 days to glow, feel strong and confident.', 'new-year-kickstart': '30 days to start the year strong. You\'ve got this.',
  'sugar-break-level-2': 'Level 2: no hidden sugar, real-life ready.', '5-am-club-level-2': 'Level 2: 21 days of power mornings.', 'mindful-eating-level-2': 'Level 2: mindful eating in real life.', 'wedding-season-ready-level-2': 'Level 2: strength, stamina and confidence.', 'new-year-kickstart-level-2': 'Level 2: 30 days to level up your year.',
  'sugar-break-level-3': 'Level 3: sugar-free for life.', '5-am-club-level-3': 'Level 3: 21 days of morning mastery.', 'mindful-eating-level-3': 'Level 3: complete food freedom.', 'wedding-season-ready-level-3': 'Level 3: peak strength and confidence.', 'new-year-kickstart-level-3': 'Level 3: make it a lifestyle.' };
export function welcomeEmailHtml({ name, email, challengeName, code, startDate, groupLink, slug, refCode }) {
  const loginLink = `${SITE}/app.html?login=${Buffer.from(`${String(email).trim().toLowerCase()}:${code}`).toString('base64url')}`;
  const first = String(name || '').split(' ')[0] || 'there';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2D322C;background:#FAF9F3;padding:28px 24px;border-radius:14px">
  <h2 style="font-family:Georgia,serif;color:#7B0237;margin:0 0 6px">Welcome to ${challengeName}, ${first}!</h2>
  <p style="margin:0 0 18px;color:#6B6459">${TAGLINES[slug] || 'Small habits. Big life. You\'ve got this.'}</p>
  <p style="margin:0 0 6px"><b>Your batch starts:</b> ${prettyDate(startDate)}</p><p style="margin:0 0 6px;color:#6B6459;font-size:14px">Everyone in your batch starts Day 1 together. Your app shows a countdown until then.</p>
  <h3 style="margin:22px 0 8px;font-size:16px">Step 1 &mdash; Join your WhatsApp group</h3>
  <p style="margin:0 0 10px">Your daily tasks, reminders and batch support happen here.</p>
  <a href="${groupLink}" style="display:inline-block;background:#1F4037;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Join WhatsApp group</a>
  <h3 style="margin:24px 0 8px;font-size:16px">Step 2 &mdash; Open your challenge app</h3>
  <p style="margin:0 0 10px">Just tap the button &mdash; it logs you in automatically. No typing needed.</p>
  <p style="margin:0 0 14px"><a href="${loginLink}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p>
  <p style="margin:0 0 8px;font-size:13px;color:#6B6459">On another phone? Log in with this email and your code:</p>
  <div style="font-size:30px;letter-spacing:8px;font-weight:bold;background:#fff;border:1px dashed #7B0237;color:#7B0237;text-align:center;padding:14px;border-radius:10px">${code}</div>
  ${refCode ? `<div style="margin:22px 0 0;background:#fff;border-radius:12px;padding:14px 16px;border:1px solid #eadfd3"><b>🎁 Bring a friend</b><p style="margin:6px 0 8px;font-size:14px">New friends get <b>₹50 off</b> any challenge, and for each friend who joins you get your <b>next level of that challenge free</b>. Your personal link (works for every challenge) is in your app.</p><a href="${refLink(refCode, baseOf(slug))}" style="color:#7B0237;font-weight:bold;word-break:break-all">${refLink(refCode, baseOf(slug))}</a></div>` : ''}
  <p style="margin:18px 0 0;font-size:13px;color:#6B6459">Tip: once it opens on your phone, tap "Add to Home Screen" so it works like an app.</p>
  <p style="margin:22px 0 0">See you inside,<br>Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni &middot; Small habits. Big life.</span></p>
</div>`;
}

// Email settings (Vercel -> Settings -> Environment Variables):
//   RESEND_API_KEY = API key from the Resend account where strongwithsherni.com is verified.
//                    (CHALLENGE_RESEND_KEY is still accepted as an older fallback name.)
//   EMAIL_FROM     = sender, e.g. "Strong With Sherni <hello@strongwithsherni.com>" (domain must be verified in Resend).
// The same logic is used in api/challenge.js for login-code emails.
export function emailSettings() {
  const key = String(process.env.RESEND_API_KEY || '').trim() || String(process.env.CHALLENGE_RESEND_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim() || 'Strong With Sherni <hello@strongwithsherni.com>';
  return { key, from };
}

async function sendEmail({ to, subject, html }) {
  const { key, from } = emailSettings();
  if (!key) { console.error('[email] RESEND_API_KEY not set'); return { ok: false, error: 'RESEND_API_KEY not set' }; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html })
    });
    const error = r.ok ? null : await r.text();
    if (error) console.error(`[email] Resend error ${r.status} sending "${subject}" from ${from}:`, error);
    return { ok: r.ok, error };
  } catch (err) {
    console.error('[email] Could not reach Resend:', err.message);
    return { ok: false, error: err.message };
  }
}

const memberHeaders = sb => ({ apikey: sb.key, Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json' });

// Creates the membership, emails the welcome email and returns what the success screen shows.
// Also used by the app when someone claims their free Level 2 (paymentId = 'reward:<friend id>').
export async function createMembership({ customer, slug, paymentId, referredBy, sb }) {
  const name = chName(slug);
  const email = String(customer.email).trim().toLowerCase();
  // Same payment confirmed twice (e.g. page refreshed)? Return the existing membership instead of a duplicate.
  const dup = await dbRows(`challenge_members?payment_id=eq.${encodeURIComponent(paymentId)}&select=*&limit=1`);
  if (dup.length) {
    const m = dup[0];
    return { challenge: true, emailSent: true, code: m.access_code, groupLink: GROUPS[m.challenge] || GROUPS[baseOf(m.challenge)], startDate: m.start_date,
      appLink: `${SITE}/app.html?login=${Buffer.from(`${email}:${m.access_code}`).toString('base64url')}`, refCode: m.ref_code, duplicate: true };
  }
  const code = newAccessCode();
  const startDate = process.env.CHALLENGE_START_DATE && process.env.CHALLENGE_START_DATE > new Date().toISOString().slice(0, 10)
    ? process.env.CHALLENGE_START_DATE : batchStartIST();
  const refCode = await refCodeFor(email, customer.name);
  const ins = await fetch(`${sb.url}/rest/v1/challenge_members`, {
    method: 'POST', headers: { ...memberHeaders(sb), Prefer: 'return=representation' },
    body: JSON.stringify({ name: customer.name, email, phone: customer.phone, challenge: slug, start_date: startDate, access_code: code, payment_id: paymentId, ref_code: refCode, referred_by: referredBy || null })
  });
  if (!ins.ok) return { warning: 'Payment verified but challenge record failed — please add manually', details: await ins.text() };

  const base = baseOf(slug);
  const groupLink = GROUPS[slug] || GROUPS[base] ||
    'https://wa.me/919036147675?text=' + encodeURIComponent(`Hi! I just joined the ${name} challenge. Please add me to the group.`);
  const mail = await sendEmail({
    to: email,
    subject: `You're in! Your ${name} login code: ${code}`,
    html: welcomeEmailHtml({ name: customer.name, email, challengeName: name, code, startDate, groupLink, slug, refCode })
  });

  // Tell the person who referred them: their free Level 2 is earned.
  if (referredBy) {
    const owner = await dbRows(`challenge_members?ref_code=eq.${encodeURIComponent(referredBy)}&select=name,email&order=created_at.desc&limit=1`);
    if (owner.length) {
      const friend = String(customer.name || 'Your friend').split(' ')[0];
      await sendEmail({ to: owner[0].email, subject: `🎁 ${friend} joined with your link! You've earned a free ${chName(base)} level`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px"><p>Hi ${String(owner[0].name || '').split(' ')[0] || 'there'},</p><p><b>${friend}</b> just joined <b>${chName(base)}</b> with your referral link. Thank you!</p><p>You've earned your <b>next ${chName(base)} level free</b> (Level 1 if you haven't done it yet, Level 2 after Level 1, Level 3 after Level 2). Open your challenge app and tap <b>Claim</b>.</p><p><a href="${SITE}/app.html" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p><p>Coach Sherni</p></div>` });
    }
  }
  if (process.env.REMINDER_EMAIL) {
    await sendEmail({
      to: process.env.REMINDER_EMAIL,
      subject: `New ${name} member: ${customer.name}${referredBy ? ' (referred by ' + referredBy + ')' : ''}${String(paymentId).startsWith('reward:') ? ' (free referral reward)' : ''}`,
      html: `<p><b>${customer.name}</b> joined ${name}.</p><p>Email: ${email}<br>Phone: ${customer.phone || '-'}<br>Starts: ${startDate}<br>Login code: ${code}<br>${referredBy ? 'Referred by code: ' + referredBy + '<br>' : ''}${String(paymentId).startsWith('reward:') ? 'Free level from a referral (no payment).<br>' : ''}</p><p>${mail.ok ? 'Welcome email sent' : 'Welcome email FAILED - send them the code on WhatsApp: ' + (mail.error || '')}</p>`
    });
  }
  const appLink = `${SITE}/app.html?login=${Buffer.from(`${email}:${code}`).toString('base64url')}`;
  return { challenge: true, emailSent: mail.ok, code, groupLink, appLink, startDate, refCode };
}

// Reads the order back from Razorpay: the real amount paid and the plan/referral the server set.
async function razorpayOrder(orderId) {
  const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  try {
    const r = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') } });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment details' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Step 1: verify the payment signature is genuinely from Razorpay
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed — signature mismatch' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Step 1b: the plan and referral come from the order the server created, not from the browser.
    const order = await razorpayOrder(razorpay_order_id);
    const notes = (order && order.notes) || {};
    if (notes.plan) customer.plan = notes.plan;
    if (notes.duration) customer.duration = notes.duration;

    // Step 2a: challenges get an app login code + welcome email
    if (/challenge/i.test(customer.plan || '')) {
      const out = await createMembership({
        customer, slug: challengeSlug(customer.plan), paymentId: razorpay_payment_id, referredBy: notes.ref || null,
        sb: {
          url: String(process.env.CHALLENGE_SUPABASE_URL || supabaseUrl || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''),
          key: String(process.env.CHALLENGE_SUPABASE_KEY || supabaseServiceKey || '').trim()
        }
      });
      return res.status(200).json({ success: true, ...out });
    }

    // Step 2b: coaching plans — create the client record in Supabase (unchanged)
    const today = new Date().toISOString().slice(0, 10);

    const durationMap = {
      '3 Months': '3 months',
      '4 Months': '4 months',
      '6 Months': '6 months',
      '12 Months': '12 months',
      '1 Hour': '1 hour'
    };
    const durationValue = durationMap[customer.duration] || customer.duration;

    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/clients`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        password: 'changeme123',
        join_date: today,
        payment_date: today,
        duration: durationValue,
        phase: customer.plan === '1-on-1 Trial Session' ? 'Trial' : 'Phase 1',
        pause_days: 0,
        extension_days: 0,
        referral_days: 0,
        payment_status: 'paid',
        intro_done: false,
        onboarding_done: false,
        notes: `${customer.location ? 'Location: ' + customer.location + '. ' : ''}${customer.plan === '1-on-1 Trial Session' ? '⭐ TRIAL SESSION — if they join a full program, remember to add +1 day via Extension. ' : ''}Auto-created via Razorpay signup. Plan: ${customer.plan}. Payment ID: ${razorpay_payment_id}`
      })
    });

    if (!supabaseRes.ok) {
      const errText = await supabaseRes.text();
      return res.status(200).json({
        success: true,
        warning: 'Payment verified but client record creation failed — please add manually',
        details: errText
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
}
