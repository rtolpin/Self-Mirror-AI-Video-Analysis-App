import { readFile } from 'fs/promises';

const BASE_URL = 'https://api.heygen.com';

// The exact statement HeyGen requires the person to read on camera for
// digital-twin consent verification. Do not alter — it's dictated by HeyGen,
// not us, and consent verification depends on it matching.
export const CONSENT_SCRIPT =
  "Hey there! I'm speaking with LOTS of energy, while staying natural and confident. " +
  "This helps HeyGen capture my voice, my expressions, and my motion, so my avatar can behave JUST like me in ANY video!";

function apiKey() {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error('HEYGEN_API_KEY is not set');
  return key;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'X-Api-Key': apiKey(), ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `HeyGen request failed (${res.status})`);
  }
  return body.data;
}

export async function uploadAsset(filePath, mimeType) {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'upload');
  const data = await request('/v3/assets', { method: 'POST', body: form });
  return data.asset_id;
}

// A digital-twin avatar is trained on real video footage (rather than a
// single photo), giving a much closer likeness match for the video-avatar
// feature. It starts in "pending_consent" until submitConsent() is approved.
export async function createDigitalTwinAvatar({ videoAssetId, name }) {
  const data = await request('/v3/avatars', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'digital_twin',
      name,
      file: { type: 'asset_id', asset_id: videoAssetId },
    }),
  });
  return { avatarGroupId: data.avatar_group.id, avatarItemId: data.avatar_item.id };
}

// Submitting a pre-recorded consent_video (our own recording) is an
// enterprise-only capability — standard accounts get a hard rejection ("only
// available to enterprise API customers"). The documented standard-account
// path instead has HeyGen host its own live webcam consent page (which
// includes a liveness check we can't replicate ourselves, like reading a
// code that's only revealed on that page) and redirects back to reroute_url
// once the subject finishes. This returns that hosted page's URL so the app
// can send the user there.
export async function submitConsent({ avatarGroupId, rerouteUrl }) {
  const data = await request(`/v3/avatars/${avatarGroupId}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reroute_url: rerouteUrl }),
  });
  return data.url;
}

export async function getAvatarConsentStatus(avatarGroupId) {
  const data = await request(`/v3/avatars/${avatarGroupId}`);
  return data.consent_status;
}

export async function generateVideo({ avatarId, audioAssetId }) {
  const data = await request('/v3/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'avatar',
      avatar_id: avatarId,
      audio_asset_id: audioAssetId,
    }),
  });
  return data.video_id;
}

export async function getVideoStatus(videoId) {
  const data = await request(`/v3/videos/${videoId}`);
  return { status: data.status, videoUrl: data.video_url };
}

export async function deleteAvatarGroup(avatarGroupId) {
  await request(`/v3/avatars/${avatarGroupId}`, { method: 'DELETE' }).catch(() => {});
}
