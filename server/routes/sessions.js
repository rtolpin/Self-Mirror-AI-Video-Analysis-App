import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import db, { toISO } from '../services/db.js';
import { transcribeAudio } from '../services/elevenLabsService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Same reasoning as DB_PATH in services/db.js: uploaded files need to live
// on the persistent volume in production, not the app's own code directory.
export const UPLOADS_DIR = process.env.DATA_DIR ? join(process.env.DATA_DIR, 'uploads') : join(__dirname, '../uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname) || ''}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

const router = Router();

const MAX_CONTEXT_LENGTH = 200;

router.post(
  '/',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'photos', maxCount: 6 },
  ]),
  (req, res) => {
    const context = (req.body.context || '').trim().slice(0, MAX_CONTEXT_LENGTH) || 'General self-analysis';
    const transcript = req.body.transcript;

    const videoPath = req.files?.video?.[0]?.filename || null;
    const audioPath = req.files?.audio?.[0]?.filename || null;
    const photoPaths = (req.files?.photos || []).map((f) => f.filename);

    const result = db
      .prepare(`
        INSERT INTO sessions (user_id, context, video_path, photo_paths, audio_path, transcript, consent_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .run(req.userId, context, videoPath, JSON.stringify(photoPaths), audioPath, transcript || '');

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
    res.json(toClientSession(session));
  }
);

// Transcribes a just-recorded clip before it's saved as a session. Uses a
// throwaway temp upload rather than the permanent session storage, since the
// recording may still be discarded/retaken at this point.
router.post('/transcribe', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A video file is required.' });
  try {
    const text = await transcribeAudio({ filePath: req.file.path });
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    unlink(req.file.path).catch(() => {});
  }
});

router.get('/', (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(sessions.map(toClientSession));
});

router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const analysis = db.prepare('SELECT * FROM analyses WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(session.id);
  const variants = db.prepare('SELECT * FROM variants WHERE session_id = ? ORDER BY created_at DESC').all(session.id);
  res.json({
    ...toClientSession(session),
    analysis: analysis ? JSON.parse(analysis.result) : null,
    variants: variants.map((v) => ({
      id: v.id,
      style: v.style,
      text: JSON.parse(v.text),
      videoStatus: v.video_status,
      videoUrl: v.video_path ? `/uploads/${v.video_path}` : null,
      dubVideoUrl: v.dub_video_path ? `/uploads/${v.dub_video_path}` : null,
    })),
  });
});

router.delete('/:id', async (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const files = [session.video_path, session.audio_path, ...JSON.parse(session.photo_paths || '[]')].filter(Boolean);
  await Promise.all(files.map((f) => unlink(join(UPLOADS_DIR, f)).catch(() => {})));

  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
  res.json({ deleted: true });
});

function toClientSession(session) {
  return {
    id: session.id,
    context: session.context,
    videoUrl: session.video_path ? `/uploads/${session.video_path}` : null,
    audioUrl: session.audio_path ? `/uploads/${session.audio_path}` : null,
    photoUrls: JSON.parse(session.photo_paths || '[]').map((p) => `/uploads/${p}`),
    transcript: session.transcript,
    createdAt: toISO(session.created_at),
  };
}

export default router;
