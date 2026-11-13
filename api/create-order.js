// Runs on Vercel's server, so the Razorpay Key Secret stays hidden.
// The PRICE IS DECIDED HERE (from api/_shared.js), never taken from the web address.
//   POST { planName, duration, email, ref, quote? }
//   quote: true -> only returns the price (used to show the right price on the signup page)
import { CHALLENGE_PRICES, PLAN_PRICES, REFERRAL_DISCOUNT, MAX_LEVEL, challengeSlug, baseOf, levelOf, challengeName, dbRows } from './_shared.js';
import { finishedLevel } from './challenge.js';

export async function priceFor({ planName, duration, email, phone, ref }) {
  const plan = String(planName || '').trim();
  email = String(email || '').trim().toLowerCase();
  if (/challenge/i.test(plan)) {
    const slug = challengeSlug(plan), base = baseOf(slug), level = levelOf(slug);
    const full = CHALLENGE_PRICES[base];
    if (!full || level > MAX_LEVEL) return { error: 'This challenge is not available right now.' };
    const out = { plan, slug, base, level, full, price: full, discount: 0, ref: null };
    if (level > 1) {
      out.needsLevel = level - 1;
      if (email && !(await finishedLevel(email, base, level - 1))) {
        out.locked = `${challengeName(slug)} unlocks once you finish Level ${level - 1}. Please use the same email you joined with.`;
      }
    }
    const code = String(ref || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code && level === 1) {
      // A referral link works for ANY challenge, but only for someone NEW (never joined before, by email or phone),
      // and never for the person's own link. This stops members swapping codes every month.
      const digits = String(phone || '').replace(/\D/g, '').slice(-10);
      const owner = (await dbRows(`challenge_members?ref_code=eq.${code}&select=email,name,phone&limit=1`))[0];
      const ownerPhone = owner ? String(owner.phone || '').replace(/\D/g, '').slice(-10) : '';
      let existing = false;
      if (email) existing = (await dbRows(`challenge_members?email=eq.${encodeURIComponent(email)}&select=id&limit=1`)).length > 0;
      if (!existing && digits.length === 10) existing = (await dbRows(`challenge_members?phone=like.*${digits}&select=id&limit=1`)).length > 0;
      if (!owner) out.refNote = '';
      else if (owner.email === email || (digits.length === 10 && digits === ownerPhone)) out.refNote = 'You can\'t use your own referral link.';
      else if (existing) out.refNote = 'The ₹50 referral discount is for new members only. Welcome back!';
      else {
        out.ref = code; out.discount = REFERRAL_DISCOUNT; out.price = full - REFERRAL_DISCOUNT;
        out.referrer = String(owner.name || '').split(' ')[0];
      }
    }
    return out;
  }
  const price = PLAN_PRICES[`${plan}|${String(duration || '').trim()}`];
  if (!price) return { error: 'This plan could not be found. Please choose it again from the website.' };
  return { plan, full: price, price, discount: 0, ref: null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const p = await priceFor(body);
    if (p.error) return res.status(400).json({ error: p.error });
    if (body.quote) return res.status(200).json(p);
    if (p.locked) return res.status(400).json({ error: p.locked });

    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({ error: 'Razorpay keys not configured on the server' });
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: p.price * 100, currency: 'INR',
        // verify-payment reads these back from Razorpay, so nobody can change them in the browser
        notes: { plan: p.plan, duration: String(body.duration || ''), email: String(body.email || '').trim().toLowerCase(), ref: p.ref || '' }
      })
    });
    const order = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Razorpay order creation failed', details: order });
    return res.status(200).json({ ...order, price: p.price, discount: p.discount });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
