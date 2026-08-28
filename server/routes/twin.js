import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { Readable } from 'stream';
import { unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import db, { getTwinProfile, upsertTwinProfile, toISO } from '../services/db.js';
import { UPLOADS_DIR } from './sessions.js';
import { buildTwinProfile, predictScenario, generateLifePaths } from '../services/claudeService.js';
import { cloneVoice, synthesizeSpeech, synthesizeSpeechStream, deleteVoice, VoiceNotFoundError } from '../services/elevenLabsService.js';
import {
  uploadAsset,
  createDigitalTwinAvatar,
  submitConsent,
  getAvatarConsentStatus,
  generateVideo,
  getVideoStatus,
  deleteAvatarGroup,
  CONSENT_SCRIPT,
} from '../services/heygenService.js';
import { dubVideo } from '../services/dubbingService.js';

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 60 * 1024 * 1024 } });
const router = Router();

// A variant has no user_id of its own — ownership is via the session it
// belongs to — so every variant lookup goes through this join instead of a
// bare `WHERE id = ?`, or one user could act on another's variant by id.
function getOwnedVariant(variantId, userId) {
  return db.prepare(`
    SELECT v.* FROM variants v
    JOIN sessions s ON v.session_id = s.id
    WHERE v.id = ? AND s.user_id = ?
  `).get(variantId, userId);
}

// ElevenLabs voices can disappear out from under a stored voice_id — deleted
// from the dashboard, evicted for a plan limit, or cloned under a since-
// rotated ELEVENLABS_API_KEY. Without this, every future request for that
// user would keep 404ing against an ID that can never work again.
const STALE_VOICE_MESSAGE = 'Your cloned voice is no longer available. Please record it again in My Twin.';

function clearStaleVoice(userId) {
  db.prepare('UPDATE twin_profile SET voice_id = NULL WHERE user_id = ?').run(userId);
}

function toClientProfile(row) {
  if (!row) return null;
  return {
    personality: row.personality ? JSON.parse(row.personality) : null,
    hasVoice: !!row.voice_id,
    sessionCount: row.session_count,
    updatedAt: toISO(row.updated_at),
    videoAvatar: {
      consentStatus: row.heygen_consent_status || null,
      consentUrl: row.heygen_consent_url || null,
      ready: !!(row.heygen_avatar_id && row.heygen_consent_status && row.heygen_consent_status !== 'pending'),
    },
  };
}

router.get('/', (req, res) => {
  res.json(toClientProfile(getTwinProfile(req.userId)));
});

router.get('/consent-script', (req, res) => {
  res.json({ script: CONSENT_SCRIPT });
});

router.post('/build', async (req, res) => {
  try {
    const sessions = db.prepare('SELECT context, transcript FROM sessions WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
    if (!sessions.length) return res.status(400).json({ error: 'Record at least one session before building your twin.' });

    const existing = getTwinProfile(req.userId);
    const personality = await buildTwinProfile({
      transcripts: sessions,
      existingPersonality: existing?.personality ? JSON.parse(existing.personality) : null,
    });

    const updated = upsertTwinProfile(req.userId, { personality: JSON.stringify(personality), sessionCount: sessions.length });
    res.json(toClientProfile(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// One recording serves two purposes: the audio is used to clone the user's
// voice, and — if HEYGEN_API_KEY is configured — the same video also becomes
// the training footage AND consent video for a digital-twin video avatar.
// The video-avatar half is best-effort: if it fails (no key, HeyGen error),
// the voice clone the user actually asked for still succeeds.
router.post('/voice', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A video recording is required.' });
  try {
    const voiceId = await cloneVoice({ audioFilePath: req.file.path, name: `self-mirror-twin-${Date.now()}` });
    const profileUpdate = { voiceId };

    if (process.env.HEYGEN_API_KEY) {
      try {
        const assetId = await uploadAsset(req.file.path, req.file.mimetype);
        const { avatarGroupId, avatarItemId } = await createDigitalTwinAvatar({
          videoAssetId: assetId,
          name: `self-mirror-${Date.now()}`,
        });
        // reroute_url is where HeyGen sends the browser back after the user
        // finishes the hosted consent page; the client passes its own
        // current URL so they land back where they started instead of the
        // backend's own address.
        const rerouteUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}`;
        const consentUrl = await submitConsent({ avatarGroupId, rerouteUrl });
        profileUpdate.heygenAvatarGroupId = avatarGroupId;
        profileUpdate.heygenAvatarId = avatarItemId;
        profileUpdate.heygenConsentStatus = 'pending';
        profileUpdate.heygenConsentUrl = consentUrl;
      } catch (err) {
        console.error('HeyGen video-avatar setup failed (voice clone still succeeded):', err.message);
      }
    }

    const updated = upsertTwinProfile(req.userId, profileUpdate);
    res.json(toClientProfile(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    unlink(req.file.path).catch(() => {});
  }
});

router.delete('/voice', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (profile?.voice_id) {
      await deleteVoice(profile.voice_id).catch(() => {});
      db.prepare('UPDATE twin_profile SET voice_id = NULL WHERE user_id = ?').run(req.userId);
    }
    res.json(toClientProfile(getTwinProfile(req.userId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Polls HeyGen for whether the consent submission has been reviewed yet.
// The exact set of terminal status strings HeyGen uses beyond "pending"
// isn't in their public docs, so this stores whatever they report verbatim
// and lets the UI display it, rather than guessing a specific success value.
router.get('/video-avatar/status', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (!profile?.heygen_avatar_group_id || profile.heygen_consent_status !== 'pending') {
      return res.json(toClientProfile(profile));
    }
    const status = await getAvatarConsentStatus(profile.heygen_avatar_group_id);
    if (status && status !== 'pending') {
      upsertTwinProfile(req.userId, { heygenConsentStatus: status });
    }
    res.json(toClientProfile(getTwinProfile(req.userId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-issues the consent link for the existing avatar group — needed both to
// pick up a corrected reroute_url without re-recording, and because the
// hosted consent page's link expires after 24 hours on HeyGen's side.
router.post('/video-avatar/refresh-consent', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (!profile?.heygen_avatar_group_id) return res.status(400).json({ error: 'No video avatar set up yet.' });

    const rerouteUrl = req.body.returnUrl || `${req.protocol}://${req.get('host')}`;
    const consentUrl = await submitConsent({ avatarGroupId: profile.heygen_avatar_group_id, rerouteUrl });
    const updated = upsertTwinProfile(req.userId, { heygenConsentStatus: 'pending', heygenConsentUrl: consentUrl });
    res.json(toClientProfile(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/video-avatar', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (profile?.heygen_avatar_group_id) {
      await deleteAvatarGroup(profile.heygen_avatar_group_id);
      db.prepare('UPDATE twin_profile SET heygen_avatar_group_id = NULL, heygen_avatar_id = NULL, heygen_consent_status = NULL, heygen_consent_url = NULL WHERE user_id = ?').run(req.userId);
    }
    res.json(toClientProfile(getTwinProfile(req.userId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET (not POST) specifically so an <audio src="..."> element can request
// this directly — the browser starts playing an MP3 as bytes arrive rather
// than waiting for the whole thing, but only if it's the one making the
// request itself; a fetch-then-blob round trip on the client always waits
// for the full body first no matter what the server does. Piping ElevenLabs'
// own streaming response straight through (instead of buffering it, like
// synthesizeSpeech does for the dub/video pipeline) means neither side ever
// holds the complete file in memory before the audio starts playing.
router.get('/speak', async (req, res) => {
  try {
    const { text } = req.query;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const profile = getTwinProfile(req.userId);
    if (!profile?.voice_id) return res.status(400).json({ error: 'No cloned voice yet. Upload a voice sample first.' });

    const stream = await synthesizeSpeechStream({ voiceId: profile.voice_id, text });
    res.set('Content-Type', 'audio/mpeg');
    Readable.fromWeb(stream).pipe(res);
  } catch (err) {
    if (err instanceof VoiceNotFoundError) {
      clearStaleVoice(req.userId);
      return res.status(400).json({ error: STALE_VOICE_MESSAGE });
    }
    res.status(500).json({ error: err.message });
  }
});

// Kicks off rendering a talking-avatar video of a style variant, in the
// user's cloned voice. Rendering happens async on HeyGen's side (can take
// well over a minute), so this just starts the job — the client polls
// GET /variant-video/:variantId/status for completion.
router.post('/variant-video/:variantId', async (req, res) => {
  const variant = getOwnedVariant(req.params.variantId, req.userId);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  const profile = getTwinProfile(req.userId);
  if (!profile?.voice_id) return res.status(400).json({ error: 'Clone your voice first.' });
  if (!profile?.heygen_avatar_id) return res.status(400).json({ error: 'No video avatar set up yet.' });

  let tempAudioPath;
  try {
    const { rewrittenText } = JSON.parse(variant.text);
    const audioBuffer = await synthesizeSpeech({ voiceId: profile.voice_id, text: rewrittenText });
    tempAudioPath = join(UPLOADS_DIR, `${randomUUID()}.mp3`);
    await writeFile(tempAudioPath, audioBuffer);

    const audioAssetId = await uploadAsset(tempAudioPath, 'audio/mpeg');
    const heygenVideoId = await generateVideo({ avatarId: profile.heygen_avatar_id, audioAssetId });

    db.prepare('UPDATE variants SET video_status = ?, heygen_video_id = ? WHERE id = ?').run('generating', heygenVideoId, variant.id);
    res.json({ videoStatus: 'generating' });
  } catch (err) {
    db.prepare('UPDATE variants SET video_status = ? WHERE id = ?').run('failed', variant.id);
    if (err instanceof VoiceNotFoundError) {
      clearStaleVoice(req.userId);
      return res.status(400).json({ error: STALE_VOICE_MESSAGE });
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (tempAudioPath) unlink(tempAudioPath).catch(() => {});
  }
});

router.get('/variant-video/:variantId/status', async (req, res) => {
  const variant = getOwnedVariant(req.params.variantId, req.userId);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  if (variant.video_status !== 'generating' || !variant.heygen_video_id) {
    return res.json({ videoStatus: variant.video_status, videoUrl: variant.video_path ? `/uploads/${variant.video_path}` : null });
  }

  try {
    const { status, videoUrl } = await getVideoStatus(variant.heygen_video_id);
    if (videoUrl) {
      const videoRes = await fetch(videoUrl);
      const buffer = Buffer.from(await videoRes.arrayBuffer());
      const filename = `${randomUUID()}.mp4`;
      await writeFile(join(UPLOADS_DIR, filename), buffer);
      db.prepare('UPDATE variants SET video_status = ?, video_path = ? WHERE id = ?').run('ready', filename, variant.id);
      return res.json({ videoStatus: 'ready', videoUrl: `/uploads/${filename}` });
    }
    if (status && /fail|error/i.test(status)) {
      db.prepare('UPDATE variants SET video_status = ? WHERE id = ?').run('failed', variant.id);
      return res.json({ videoStatus: 'failed' });
    }
    res.json({ videoStatus: 'generating' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dubs the ORIGINAL recording with new narration of the variant's rewritten
// text, in the user's cloned voice. Unlike the HeyGen video (a true
// synthetic recreation with lip-sync), this keeps the real footage and just
// swaps the audio — no video-avatar setup or consent flow required, only a
// cloned voice and the session's original video.
router.post('/variant-dub/:variantId', async (req, res) => {
  const variant = getOwnedVariant(req.params.variantId, req.userId);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });

  const session = db.prepare('SELECT video_path FROM sessions WHERE id = ?').get(variant.session_id);
  if (!session?.video_path) return res.status(400).json({ error: 'This session has no video to dub.' });

  const profile = getTwinProfile(req.userId);
  if (!profile?.voice_id) return res.status(400).json({ error: 'Clone your voice first.' });

  let tempAudioPath;
  try {
    const { rewrittenText } = JSON.parse(variant.text);
    const audioBuffer = await synthesizeSpeech({ voiceId: profile.voice_id, text: rewrittenText });
    tempAudioPath = join(UPLOADS_DIR, `${randomUUID()}.mp3`);
    await writeFile(tempAudioPath, audioBuffer);

    const outputFilename = `${randomUUID()}.webm`;
    await dubVideo({
      videoPath: join(UPLOADS_DIR, session.video_path),
      audioPath: tempAudioPath,
      outputPath: join(UPLOADS_DIR, outputFilename),
    });

    // Written to its own column, separate from video_status/video_path
    // (reserved for the synthetic HeyGen render) — this way a dub can be
    // shown as a fast fallback while a much slower synthetic render is still
    // in progress for the same variant, without the two clobbering each other.
    db.prepare('UPDATE variants SET dub_video_path = ? WHERE id = ?').run(outputFilename, variant.id);
    res.json({ dubVideoUrl: `/uploads/${outputFilename}` });
  } catch (err) {
    if (err instanceof VoiceNotFoundError) {
      clearStaleVoice(req.userId);
      return res.status(400).json({ error: STALE_VOICE_MESSAGE });
    }
    res.status(500).json({ error: err.message });
  } finally {
    if (tempAudioPath) unlink(tempAudioPath).catch(() => {});
  }
});

router.delete('/variant/:variantId', async (req, res) => {
  const variant = getOwnedVariant(req.params.variantId, req.userId);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });
  if (variant.video_path) {
    unlink(join(UPLOADS_DIR, variant.video_path)).catch(() => {});
  }
  if (variant.dub_video_path) {
    unlink(join(UPLOADS_DIR, variant.dub_video_path)).catch(() => {});
  }
  db.prepare('DELETE FROM variants WHERE id = ?').run(variant.id);
  res.json({ deleted: true });
});

function analysesSummaryText(userId) {
  const analyses = db.prepare(`
    SELECT a.result FROM analyses a
    JOIN sessions s ON a.session_id = s.id
    WHERE s.user_id = ?
    ORDER BY a.created_at DESC LIMIT 10
  `).all(userId);
  return analyses.map((a) => JSON.parse(a.result).overallSentiment).join(' | ') || null;
}

router.post('/scenario', async (req, res) => {
  try {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: 'scenario is required' });
    const profile = getTwinProfile(req.userId);
    if (!profile?.personality) return res.status(400).json({ error: 'Build your twin profile first.' });

    const prediction = await predictScenario({
      scenario,
      twinProfile: JSON.parse(profile.personality),
      analysesSummary: analysesSummaryText(req.userId),
    });

    db.prepare('INSERT INTO scenario_predictions (user_id, scenario, prediction) VALUES (?, ?, ?)').run(req.userId, scenario, JSON.stringify(prediction));
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scenarios', (req, res) => {
  const rows = db.prepare('SELECT * FROM scenario_predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(req.userId);
  res.json(rows.map((r) => ({ id: r.id, scenario: r.scenario, prediction: JSON.parse(r.prediction), createdAt: toISO(r.created_at) })));
});

router.post('/lifepaths', async (req, res) => {
  try {
    const profile = getTwinProfile(req.userId);
    if (!profile?.personality) return res.status(400).json({ error: 'Build your twin profile first.' });

    const result = await generateLifePaths({
      twinProfile: JSON.parse(profile.personality),
      analysesSummary: analysesSummaryText(req.userId),
    });

    db.prepare('INSERT INTO life_paths (user_id, result) VALUES (?, ?)').run(req.userId, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lifepaths', (req, res) => {
  const row = db.prepare('SELECT * FROM life_paths WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.userId);
  res.json(row ? JSON.parse(row.result) : null);
});

export default router;
