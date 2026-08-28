import crypto from 'crypto';

// Node's built-in crypto is used instead of bcrypt/jsonwebtoken so there are
// no extra native dependencies to compile on deploy — scrypt is a
// well-established, memory-hard password hash, and a signed+timestamped
// token is all a session needs here (no need for full JWT's header/claims
// machinery for a single-purpose cookie).
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production — generate one with `openssl rand -hex 32`.');
}
const SECRET = SESSION_SECRET || 'dev-only-insecure-secret-change-me';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + SESSION_LIFETIME_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}
