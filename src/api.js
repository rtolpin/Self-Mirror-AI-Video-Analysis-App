async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  signup: (email, password) =>
    fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(handle),
  login: (email, password) =>
    fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(handle),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }).then(handle),
  me: () => fetch('/api/auth/me').then(handle),
  continueAsGuest: () => fetch('/api/auth/guest', { method: 'POST' }).then(handle),
  upgradeAccount: (email, password) =>
    fetch('/api/auth/upgrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(handle),

  listSessions: () => fetch('/api/sessions').then(handle),
  getSession: (id) => fetch(`/api/sessions/${id}`).then(handle),
  deleteSession: (id) => fetch(`/api/sessions/${id}`, { method: 'DELETE' }).then(handle),
  createSession: (formData) => fetch('/api/sessions', { method: 'POST', body: formData }).then(handle),

  // Plain fetch() gives no upload progress events, so a multi-MB video looks
  // "stuck" with no feedback. XHR exposes upload.onprogress instead.
  createSessionWithProgress: (formData, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/sessions');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(new Error(body.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.send(formData);
    }),

  transcribe: (formData) => fetch('/api/sessions/transcribe', { method: 'POST', body: formData }).then(handle),

  analyzeSession: (id) => fetch(`/api/analysis/sessions/${id}/analyze`, { method: 'POST' }).then(handle),
  getStyles: () => fetch('/api/analysis/styles').then(handle),
  generateVariants: (id, styles) =>
    fetch(`/api/analysis/sessions/${id}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styles }),
    }).then(handle),

  getTwin: () => fetch('/api/twin').then(handle),
  buildTwin: () => fetch('/api/twin/build', { method: 'POST' }).then(handle),
  uploadVoiceSample: (formData) => fetch('/api/twin/voice', { method: 'POST', body: formData }).then(handle),
  deleteVoice: () => fetch('/api/twin/voice', { method: 'DELETE' }).then(handle),

  getConsentScript: () => fetch('/api/twin/consent-script').then(handle),
  getVideoAvatarStatus: () => fetch('/api/twin/video-avatar/status').then(handle),
  deleteVideoAvatar: () => fetch('/api/twin/video-avatar', { method: 'DELETE' }).then(handle),
  generateVariantVideo: (variantId) => fetch(`/api/twin/variant-video/${variantId}`, { method: 'POST' }).then(handle),
  getVariantVideoStatus: (variantId) => fetch(`/api/twin/variant-video/${variantId}/status`).then(handle),
  dubVariantVideo: (variantId) => fetch(`/api/twin/variant-dub/${variantId}`, { method: 'POST' }).then(handle),
  deleteVariant: (variantId) => fetch(`/api/twin/variant/${variantId}`, { method: 'DELETE' }).then(handle),
  // A plain URL, not a fetch: pointing an <audio src> element straight at
  // this lets the browser start playing as bytes arrive (the backend
  // streams rather than buffers) instead of waiting for a full
  // fetch-then-blob round trip to finish downloading before playback can
  // even start.
  getSpeakUrl: (text) => `/api/twin/speak?text=${encodeURIComponent(text)}`,

  predictScenario: (scenario) =>
    fetch('/api/twin/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    }).then(handle),
  listScenarios: () => fetch('/api/twin/scenarios').then(handle),

  generateLifePaths: () => fetch('/api/twin/lifepaths', { method: 'POST' }).then(handle),
  getLifePaths: () => fetch('/api/twin/lifepaths').then(handle),

  wipeAllData: () => fetch('/api/data', { method: 'DELETE' }).then(handle),
};
