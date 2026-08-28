import { Router } from 'express';
import { join } from 'path';
import { readFile } from 'fs/promises';
import db, { getTwinProfile } from '../services/db.js';
import { UPLOADS_DIR } from './sessions.js';
import { analyzeSelfPresentation, generateVariant, STYLE_OPTIONS } from '../services/claudeService.js';

const router = Router();

const MEDIA_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function loadImages(photoPaths) {
  const images = [];
  for (const relPath of photoPaths.slice(0, 4)) {
    const ext = relPath.slice(relPath.lastIndexOf('.')).toLowerCase();
    const mediaType = MEDIA_TYPES[ext];
    if (!mediaType) continue;
    const buffer = await readFile(join(UPLOADS_DIR, relPath));
    images.push({ mediaType, base64: buffer.toString('base64') });
  }
  return images;
}

router.post('/sessions/:id/analyze', async (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const photoPaths = JSON.parse(session.photo_paths || '[]');
    const images = await loadImages(photoPaths);

    const result = await analyzeSelfPresentation({
      context: session.context,
      images,
      transcript: session.transcript,
    });

    db.prepare('INSERT INTO analyses (session_id, result) VALUES (?, ?)').run(session.id, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/styles', (req, res) => {
  res.json(STYLE_OPTIONS);
});

router.post('/sessions/:id/variants', async (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const styles = Array.isArray(req.body.styles) && req.body.styles.length ? req.body.styles : STYLE_OPTIONS;
    const invalid = styles.filter((s) => !STYLE_OPTIONS.includes(s));
    if (invalid.length) return res.status(400).json({ error: `Unknown style(s): ${invalid.join(', ')}` });

    const twinProfile = getTwinProfile(req.userId);
    const profile = twinProfile?.personality ? JSON.parse(twinProfile.personality) : null;

    const results = [];
    for (const style of styles) {
      const variant = await generateVariant({ transcript: session.transcript, twinProfile: profile, style });
      db.prepare('INSERT INTO variants (session_id, style, text) VALUES (?, ?, ?)').run(session.id, style, JSON.stringify(variant));
      results.push(variant);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
