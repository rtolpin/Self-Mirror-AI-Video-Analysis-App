import { Router } from 'express';
import db, { claimOrphanedDataForFirstUser } from '../services/db.js';
import { hashPassword, verifyPassword, signSessionToken } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';

function setSessionCookie(res, token) {
  const maxAge = 30 * 24 * 60 * 60; // seconds
  res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${IS_PROD ? '; Secure' : ''}`);
}

function toClientUser(user) {
  return { id: user.id, email: user.email, isGuest: !!user.is_guest };
}

router.post('/signup', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const passwordHash = hashPassword(password);
  const result = db.prepare('INSERT INTO users (email, password_hash, is_guest) VALUES (?, ?, 0)').run(email, passwordHash);
  const userId = result.lastInsertRowid;

  // If this is the very first account on a database that predates accounts,
  // it inherits whatever single-user data already exists instead of
  // orphaning recordings/twin profile that were created before signup existed.
  claimOrphanedDataForFirstUser(userId);

  const token = signSessionToken(userId);
  setSessionCookie(res, token);
  res.json({ user: toClientUser({ id: userId, email, is_guest: 0 }) });
});

router.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signSessionToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: toClientUser(user) });
});

// Demo access with no signup: an anonymous account like any other, just
// flagged is_guest so it can be cleaned up later (see db.js
// cleanupOldGuests) and so the client can nudge toward creating a real
// account. Everything the guest does is fully functional in the meantime —
// it's the same data model, just temporary.
router.post('/guest', (req, res) => {
  const result = db.prepare('INSERT INTO users (is_guest) VALUES (1)').run();
  const userId = result.lastInsertRowid;
  const token = signSessionToken(userId);
  setSessionCookie(res, token);
  res.json({ user: toClientUser({ id: userId, email: null, is_guest: 1 }) });
});

// Turns a guest account into a real one in place — same user_id, so
// everything already recorded under it (sessions, twin profile, cloned
// voice) is preserved rather than needing to be copied or re-created.
router.post('/upgrade', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  if (!user.is_guest) return res.status(400).json({ error: 'This account already has a login.' });

  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.userId);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const passwordHash = hashPassword(password);
  db.prepare('UPDATE users SET email = ?, password_hash = ?, is_guest = 0 WHERE id = ?').run(email, passwordHash, req.userId);
  res.json({ user: toClientUser({ id: req.userId, email, is_guest: 0 }) });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ loggedOut: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, is_guest FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: toClientUser(user) });
});

export default router;
