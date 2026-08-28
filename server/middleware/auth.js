import { verifySessionToken } from '../services/authService.js';

// Only ever one cookie to read here, so a tiny manual parser avoids pulling
// in the cookie-parser dependency for a single line of real logic.
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((pair) => {
      const idx = pair.indexOf('=');
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1))];
    })
  );
}

export function requireAuth(req, res, next) {
  const userId = verifySessionToken(parseCookies(req).session);
  if (!userId) return res.status(401).json({ error: 'Not signed in.' });
  req.userId = userId;
  next();
}
