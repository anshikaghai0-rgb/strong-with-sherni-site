// Shared settings for payments, levels and referrals (helper file, not an endpoint).
import crypto from 'crypto';

export const SITE = 'https://www.strongwithsherni.com';

// ---- PRICES (rupees). The server decides the price, never the web address. ----
// Challenges: every level costs the same as Level 1.
export const CHALLENGE_PRICES = {
  'sugar-break': 299,
  '5-am-club': 299,
  'mindful-eating': 479,
  'wedding-season-ready': 599,
  'new-year-kickstart': 299
};
// Coaching plans: "Plan name|Duration" -> price. Add a line here if you add a new plan to the website.
export const PLAN_PRICES = {
  '1-on-1 Trial Session|1 Hour': 1999,
  'Individual Coaching - Student|3 Months': 19499,
  'Individual Coaching - Advanced|4 Months': 25499,
  'Individual Coaching - Advanced|6 Months': 38999,
  'Individual Coaching - Advanced|12 Months': 65999,
  'Individual Coaching - Elite|4 Months': 32999,
  'Individual Coaching - Elite|6 Months': 49999,
  'Individual Coaching - Elite|12 Months': 78999,
  'Buddy Coaching - Student|3 Months': 24499,
  'Buddy Coaching - Advanced|4 Months': 48499,
  'Buddy Coaching - Advanced|6 Months': 70999,
  'Buddy Coaching - Advanced|12 Months': 115000,
  'Buddy Coaching - Elite|4 Months': 61999,
  'Buddy Coaching - Elite|6 Months': 99999,
  'Buddy Coaching - Elite|12 Months': 140000
};
export const REFERRAL_DISCOUNT = 50; // rupees off for the friend who joins with a referral link

// WhatsApp group for every challenge AND level (each level has its own group).
export const GROUPS = {
  'sugar-break': 'https://chat.whatsapp.com/LdOprhlpyJ57FAT1flTFkU',
  '5-am-club': 'https://chat.whatsapp.com/Jyx1nPHTWrMJiqSHPdQ2LN',
  'mindful-eating': 'https://chat.whatsapp.com/DLrZZSG8KvpJvnzrWE03Gg',
  'wedding-season-ready': 'https://chat.whatsapp.com/K2Vdt0R17FA2cxjxDiyVHZ',
  'new-year-kickstart': 'https://chat.whatsapp.com/ELyrGbwJmG0IXzdYPB0yz6',
  'sugar-break-level-2': 'https://chat.whatsapp.com/Govt9yZGVojHTlFlZnyh8d',
  'sugar-break-level-3': 'https://chat.whatsapp.com/HTNBEMWxfV3CfffsvnGlkX',
  '5-am-club-level-2': 'https://chat.whatsapp.com/KFe6M5PvVxh9g3qsWY7MJv',
  '5-am-club-level-3': 'https://chat.whatsapp.com/DEDZGbqVhSnFnlZGbQWMXE',
  'mindful-eating-level-2': 'https://chat.whatsapp.com/DD0b05ZtifL5lhGOmLzkuG',
  'mindful-eating-level-3': 'https://chat.whatsapp.com/CGAAXB5F9Ox55OGp3CXctt',
  'wedding-season-ready-level-2': 'https://chat.whatsapp.com/E4cyA1yCrMGHUJGTSZtd5a',
  'wedding-season-ready-level-3': 'https://chat.whatsapp.com/CmJR6NMEjcQ4mqDN2rwHEu',
  'new-year-kickstart-level-2': 'https://chat.whatsapp.com/LOHz4RgfkP1AKsecSIq6Cn',
  'new-year-kickstart-level-3': 'https://chat.whatsapp.com/HVxXVUykMV92lC3EC8n2DR'
};
export const NAMES = { 'sugar-break': 'Sugar Break', '5-am-club': '5 AM Club', 'mindful-eating': 'Mindful Eating', 'wedding-season-ready': 'Wedding Season Ready', 'new-year-kickstart': 'New Year Kickstart' };
export const PAGES = { 'sugar-break': 'challenge-sugar-break.html', '5-am-club': 'challenge-5-am-club.html', 'mindful-eating': 'challenge-mindful-eating.html', 'wedding-season-ready': 'challenge-wedding-season-ready.html', 'new-year-kickstart': 'challenge-new-year-kickstart.html' };
export const DAYS = { 'new-year-kickstart': 30 };

export function challengeSlug(plan) {
  return String(plan || '').replace(/\s*challenge\s*$/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export const MAX_LEVEL = 3; // Level 1 -> Level 2 -> Level 3. Each unlocks after finishing the one before.
export const baseOf = slug => String(slug || '').replace(/-level-\d+$/, '');
export const levelOf = slug => { const m = String(slug || '').match(/-level-(\d+)$/); return m ? +m[1] : 1; };
export const slugFor = (base, level) => level > 1 ? `${base}-level-${level}` : base;
export const challengeName = slug => (NAMES[baseOf(slug)] || 'your challenge') + (levelOf(slug) > 1 ? ' Level ' + levelOf(slug) : '');
export const refLink = (code, base) => `${SITE}/${PAGES[base] || 'challenges.html'}?ref=${encodeURIComponent(code)}`;

// Monthly batches: join on the 1st-3rd -> this month's batch, later -> next month's batch.
export const LATE_JOIN_DAYS = 3;
export function batchStartIST() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  let y = ist.getUTCFullYear(), m = ist.getUTCMonth();
  if (ist.getUTCDate() > LATE_JOIN_DAYS) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
export const newAccessCode = () => String(crypto.randomInt(100000, 1000000));

// ---- Database (same settings as the app) ----
const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '').replace(/\/+$/, '');
export const SB_URL = () => cleanUrl(process.env.CHALLENGE_SUPABASE_URL || process.env.SUPABASE_URL);
export const SB_KEY = () => String(process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
export function db(path, opts = {}) {
  const key = SB_KEY();
  return fetch(`${SB_URL()}/rest/v1/${path}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}
export async function dbRows(path) {
  const r = await db(path);
  if (!r.ok) throw new Error(`Database error ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// Everyone gets ONE personal referral code (same for all their challenges), e.g. PRIYA482.
export async function refCodeFor(email, name) {
  email = String(email || '').trim().toLowerCase();
  const have = await dbRows(`challenge_members?email=eq.${encodeURIComponent(email)}&ref_code=not.is.null&select=ref_code&limit=1`);
  if (have.length) return have[0].ref_code;
  const stem = (String(name || '').trim().split(/\s+/)[0] || 'SHERNI').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'SHERNI';
  for (let i = 0; i < 6; i++) {
    const code = stem + crypto.randomInt(100, 1000);
    const taken = await dbRows(`challenge_members?ref_code=eq.${code}&select=id&limit=1`);
    if (!taken.length) return code;
  }
  return stem + crypto.randomInt(10000, 100000);
}
