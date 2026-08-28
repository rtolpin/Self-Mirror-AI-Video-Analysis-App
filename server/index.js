import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unlink } from 'fs/promises';
import db, { deleteOldGuests } from './services/db.js';
import sessionsRoutes, { UPLOADS_DIR } from './routes/sessions.js';
import analysisRoutes from './routes/analysis.js';
import twinRoutes from './routes/twin.js';
import dataRoutes from './routes/data.js';
import authRoutes from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3101;

// In dev, the frontend (5173) and API (3101) are different origins, but
// Vite's proxy forwards /api requests server-side so the browser only ever
// talks to its own origin — cookies set here are seen as same-origin on
// both sides. In production the built frontend is served from this same
// process, so it's always same-origin. CORS is only relevant at all because
// some tooling (curl, tests) hits the API directly without the proxy.
app.use(cors({
  origin: IS_PROD ? false : (req, callback) => callback(null, true),
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));

// Every uploaded file (recordings, cloned-voice samples, dubbed/synthetic
// videos) belongs to exactly one user's session or variant. Serving them
// through a plain express.static would let anyone who has (or guesses) a
// filename fetch another user's video — this checks ownership first instead.
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  const owned = db.prepare(`
    SELECT 1 FROM sessions
      WHERE user_id = ? AND (video_path = ? OR audio_path = ? OR photo_paths LIKE ?)
    UNION
    SELECT 1 FROM variants v JOIN sessions s ON v.session_id = s.id
      WHERE s.user_id = ? AND (v.video_path = ? OR v.dub_video_path = ?)
  `).get(req.userId, filename, filename, `%"${filename}"%`, req.userId, filename, filename);
  if (!owned) return res.status(404).end();
  res.sendFile(join(UPLOADS_DIR, filename));
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', requireAuth, sessionsRoutes);
app.use('/api/analysis', requireAuth, analysisRoutes);
app.use('/api/twin', requireAuth, twinRoutes);
app.use('/api/data', requireAuth, dataRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: IS_PROD ? 'production' : 'development' }));

if (IS_PROD) {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// Guest accounts (see routes/auth.js POST /guest) are meant to be temporary
// demo access, not indefinite free storage — anything older than a day gets
// deleted, rows and files both, so anonymous usage doesn't grow the
// database/disk without bound. Runs at startup and then on a standing timer
// for long-lived processes.
const GUEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
async function cleanupOldGuests() {
  const { deletedUserCount, files } = deleteOldGuests(GUEST_MAX_AGE_MS);
  if (deletedUserCount) {
    await Promise.all(files.map((f) => unlink(join(UPLOADS_DIR, f)).catch(() => {})));
    console.log(`Cleaned up ${deletedUserCount} guest account(s) older than 24h (${files.length} file(s)).`);
  }
}
cleanupOldGuests();
setInterval(cleanupOldGuests, 6 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Self-Mirror server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
