import crypto from 'crypto';

// This runs on Vercel's server. It checks the payment is genuinely real (not faked).
// - Coaching plans: creates the client record in the Supabase 'clients' table (same as before).
// - Challenges: creates a challenge member with a 6-digit app login code and emails the
//   client their welcome email (WhatsApp group link + app link + login code).

const SITE = 'https://www.strongwithsherni.com';
const DAY = 86400000;

function challengeSlug(plan) {
  return String(plan || '').replace(/\s*challenge\s*$/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Batch starts on the next Monday (India time). You can change any member's start_date in Supabase.
function nextMondayIST() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  const dow = ist.getUTCDay(); // 0 Sun ... 1 Mon
  const add = ((8 - dow) % 7) || 7;
  return new Date(ist.getTime() + add * DAY).toISOString().slice(0, 10);
}

function prettyDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function welcomeEmailHtml({ name, email, challengeName, code, startDate, groupLink }) {
  const loginLink = `${SITE}/app.html?login=${Buffer.from(`${String(email).trim().toLowerCase()}:${code}`).toString('base64url')}`;
  const first = String(name || '').split(' ')[0] || 'there';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2D322C;background:#FAF9F3;padding:28px 24px;border-radius:14px">
  <h2 style="font-family:Georgia,serif;color:#7B0237;margin:0 0 6px">Welcome to ${challengeName}, ${first}!</h2>
  <p style="margin:0 0 18px;color:#6B6459">21 days. Zero added sugar. You've got this.</p>
  <p style="margin:0 0 6px"><b>Your challenge starts:</b> ${prettyDate(startDate)}</p>
  <h3 style="margin:22px 0 8px;font-size:16px">Step 1 &mdash; Join your WhatsApp group</h3>
  <p style="margin:0 0 10px">Your daily tasks, reminders and batch support happen here.</p>
  <a href="${groupLink}" style="display:inline-block;background:#1F4037;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Join WhatsApp group</a>
  <h3 style="margin:24px 0 8px;font-size:16px">Step 2 &mdash; Open your challenge app</h3>
  <p style="margin:0 0 10px">Just tap the button &mdash; it logs you in automatically. No typing needed.</p>
  <p style="margin:0 0 14px"><a href="${loginLink}" style="display:inline-block;background:#7B0237;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font-weight:bold">Open my challenge app</a></p>
  <p style="margin:0 0 8px;font-size:13px;color:#6B6459">On another phone? Log in with this email and your code:</p>
  <div style="font-size:30px;letter-spacing:8px;font-weight:bold;background:#fff;border:1px dashed #7B0237;color:#7B0237;text-align:center;padding:14px;border-radius:10px">${code}</div>
  <p style="margin:18px 0 0;font-size:13px;color:#6B6459">Tip: once it opens on your phone, tap "Add to Home Screen" so it works like an app.</p>
  <p style="margin:22px 0 0">See you inside,<br>Coach Sherni<br><span style="color:#6B6459;font-size:13px">Strong With Sherni &middot; Small habits. Big life.</span></p>
</div>`;
}

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Strong With Sherni <onboarding@resend.dev>', to: [to], subject, html })
  });
  return { ok: r.ok, error: r.ok ? null : await r.text() };
}

async function handleChallenge(customer, paymentId, sb) {
  const slug = challengeSlug(customer.plan);
  const challengeName = String(customer.plan || '').replace(/\s*challenge\s*$/i, '').trim() || 'your challenge';
  const code = String(crypto.randomInt(100000, 1000000));
  const startDate = process.env.CHALLENGE_START_DATE && process.env.CHALLENGE_START_DATE > new Date().toISOString().slice(0, 10)
    ? process.env.CHALLENGE_START_DATE : nextMondayIST();

  const ins = await fetch(`${sb.url}/rest/v1/challenge_members`, {
    method: 'POST',
    headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      name: customer.name, email: String(customer.email).trim().toLowerCase(), phone: customer.phone,
      challenge: slug, start_date: startDate, access_code: code, payment_id: paymentId
    })
  });
  if (!ins.ok) return { warning: 'Payment verified but challenge record failed — please add manually', details: await ins.text() };

  // WhatsApp group per challenge. Add new challenges' group links here.
  const GROUPS = { 'sugar-break': 'https://chat.whatsapp.com/LdOprhlpyJ57FAT1flTFkU' };
  const groupLink = GROUPS[slug] ||
    'https://wa.me/919036147675?text=' + encodeURIComponent(`Hi! I just joined the ${challengeName} challenge. Please add me to the group.`);

  const mail = await sendEmail({
    to: customer.email,
    subject: `You're in! Your ${challengeName} login code: ${code}`,
    html: welcomeEmailHtml({ name: customer.name, email: customer.email, challengeName, code, startDate, groupLink })
  });

  // Let the coach know too (works even before the domain is verified in Resend).
  if (process.env.REMINDER_EMAIL) {
    await sendEmail({
      to: process.env.REMINDER_EMAIL,
      subject: `New ${challengeName} member: ${customer.name}`,
      html: `<p><b>${customer.name}</b> joined ${challengeName}.</p><p>Email: ${customer.email}<br>Phone: ${customer.phone}<br>Starts: ${startDate}<br>Login code: ${code}</p><p>${mail.ok ? 'Welcome email sent' : 'Welcome email FAILED - send them the code on WhatsApp: ' + (mail.error || '')}</p>`
    });
  }
  return { challenge: true, emailSent: mail.ok };
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

    // Step 2a: challenges get an app login code + welcome email
    if (/challenge/i.test(customer.plan || '')) {
      const out = await handleChallenge(customer, razorpay_payment_id, { url: supabaseUrl, key: supabaseServiceKey });
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
