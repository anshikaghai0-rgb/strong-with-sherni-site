// Free phone notifications (Web Push). No extra service or package needed.
// Files starting with "_" in /api are helpers, not endpoints.
//
// The VAPID key pair is derived from a secret that's already set in Vercel, so there is
// nothing new to configure. (Changing that secret means everyone taps "Turn on reminders" again.)
import crypto from 'crypto';

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(String(s), 'base64url');

let KEYS = null;
export function vapidKeys() {
  if (KEYS) return KEYS;
  const secret = process.env.PUSH_SECRET || process.env.CHALLENGE_SECRET || process.env.CHALLENGE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
  for (let i = 0; i < 10; i++) {
    const d = crypto.createHmac('sha256', String(secret).trim()).update('sws-vapid-v1:' + i).digest();
    try {
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(d);
      const pub = ecdh.getPublicKey(); // 65 bytes, uncompressed
      KEYS = { d, pub, publicKey: b64u(pub) };
      return KEYS;
    } catch (e) { /* invalid scalar (astronomically rare): try the next one */ }
  }
  throw new Error('Could not create notification keys');
}

function vapidAuth(endpoint) {
  const { d, pub, publicKey } = vapidKeys();
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:hello@strongwithsherni.com' }));
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// RFC 8291 (aes128gcm) payload encryption
export function encrypt(p256dh, auth, plaintext) {
  const uaPub = fromB64u(p256dh), authSecret = fromB64u(auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPub);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
  const salt = crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

// sub = { endpoint, p256dh, auth }; msg = { title, body, url?, tag? }
// Returns { ok, gone } — gone=true means the phone unsubscribed, so delete it.
export async function sendPush(sub, msg) {
  try {
    const body = encrypt(sub.p256dh, sub.auth, JSON.stringify(msg));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: vapidAuth(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'normal' },
      body
    });
    return { ok: r.ok, gone: r.status === 404 || r.status === 410, status: r.status };
  } catch (e) {
    return { ok: false, gone: false, error: e.message };
  }
}
