import { Router } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import db from '../services/db.js';
import { UPLOADS_DIR } from './sessions.js';
import { deleteVoice } from '../services/elevenLabsService.js';
import { getTwinProfile } from '../services/db.js';

const router = Router();

// Wipes everything belonging to the signed-in user: every recorded
// photo/video/audio file, every stored analysis, their twin profile, and
// their cloned voice (if any) — but never touches other accounts' data or
// their files, since this now runs in a shared multi-user database.
router.delete('/', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (profile?.voice_id) {
      await deleteVoice(profile.voice_id).catch(() => {});
    }

    const sessions = db.prepare('SELECT id, video_path, audio_path, photo_paths FROM sessions WHERE user_id = ?').all(req.userId);
    const variants = db.prepare(`
      SELECT v.video_path, v.dub_video_path FROM variants v
      JOIN sessions s ON v.session_id = s.id
      WHERE s.user_id = ?
    `).all(req.userId);

    const files = [
      ...sessions.flatMap((s) => [s.video_path, s.audio_path, ...JSON.parse(s.photo_paths || '[]')]),
      ...variants.flatMap((v) => [v.video_path, v.dub_video_path]),
    ].filter(Boolean);
    await Promise.all(files.map((f) => unlink(join(UPLOADS_DIR, f)).catch(() => {})));

    // variants/analyses cascade-delete with their parent session.
    db.prepare('DELETE FROM scenario_predictions WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM life_paths WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM twin_profile WHERE user_id = ?').run(req.userId);

    res.json({ wiped: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
