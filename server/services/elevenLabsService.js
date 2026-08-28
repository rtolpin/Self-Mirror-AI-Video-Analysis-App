import { readFile } from 'fs/promises';

const BASE_URL = 'https://api.elevenlabs.io/v1';

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  return key;
}

// Thrown instead of the generic synthesis error when ElevenLabs reports the
// voice itself doesn't exist (deleted from the dashboard, evicted for a plan
// limit, or cloned under a different ELEVENLABS_API_KEY than the one now
// deployed) — callers use this to clear the stale voice_id instead of
// leaving the user stuck retrying against an ID that will never work again.
export class VoiceNotFoundError extends Error {}

async function throwSynthesisError(res, label) {
  const body = await res.text();
  if (res.status === 404 && body.includes('voice_not_found')) {
    throw new VoiceNotFoundError(`${label} failed (${res.status}): ${body}`);
  }
  throw new Error(`${label} failed (${res.status}): ${body}`);
}

// Bracketed stage directions like "[laughs]" or "[chuckles]" sometimes show
// up in transcripts or in Claude's rewritten text, but eleven_multilingual_v2
// (the model used here) doesn't treat them as non-verbal cues the way
// newer "audio tag" models do — it just reads the words inside the
// brackets aloud, which is never what's intended. Stripped once here so
// every caller (dubbing, synthetic-video audio, Read Aloud) is covered.
function stripStageDirections(text) {
  return (text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export async function cloneVoice({ audioFilePath, name }) {
  const buffer = await readFile(audioFilePath);
  const form = new FormData();
  form.append('name', name);
  form.append('files', new Blob([buffer]), 'sample.webm');

  const res = await fetch(`${BASE_URL}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey() },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs voice clone failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.voice_id;
}

export async function synthesizeSpeech({ voiceId, text }) {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: stripStageDirections(text),
      model_id: 'eleven_multilingual_v2',
    }),
  });

  if (!res.ok) await throwSynthesisError(res, 'ElevenLabs speech synthesis');

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Used for on-demand playback ("Read Aloud" etc.), where perceived latency
// matters and the caller can play audio as it arrives — unlike
// synthesizeSpeech above (used for dubbing/video, where the full file has
// to exist on disk before ffmpeg/HeyGen can use it), this returns the raw
// response stream instead of buffering the whole thing into memory first.
export async function synthesizeSpeechStream({ voiceId, text }) {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: stripStageDirections(text),
      model_id: 'eleven_multilingual_v2',
    }),
  });

  if (!res.ok) await throwSynthesisError(res, 'ElevenLabs speech synthesis');

  return res.body;
}

export async function transcribeAudio({ filePath }) {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('file', new Blob([buffer]), 'recording');

  const res = await fetch(`${BASE_URL}/speech-to-text`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey() },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs transcription failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.text || '';
}

export async function deleteVoice(voiceId) {
  const res = await fetch(`${BASE_URL}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey() },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`ElevenLabs voice delete failed (${res.status}): ${body}`);
  }
}
