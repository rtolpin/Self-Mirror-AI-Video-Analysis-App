// "Have I already been asked whether to use my voice for style variants?" is
// remembered in localStorage so the consent modal only interrupts once, per
// the user's own choice — but that memory needs to be invalidated whenever
// the underlying voice actually changes (cloned or deleted), or it goes
// stale and silently skips a modal that should reappear.
export const VOICE_CONSENT_KEY = 'self-mirror-voice-consent-given';
export const VOICE_PROMPT_DISMISSED_KEY = 'self-mirror-voice-prompt-dismissed';

export function resetVoiceConsentFlags() {
  localStorage.removeItem(VOICE_CONSENT_KEY);
  localStorage.removeItem(VOICE_PROMPT_DISMISSED_KEY);
}

// HeyGen's hosted consent page sends a Content-Security-Policy with a
// frame-ancestors allowlist that doesn't include us, so it can never be
// embedded in an <iframe> here — that's a deliberate anti-spoofing boundary
// (the liveness check needs to run on HeyGen's own top-level page, not
// something a third party could proxy or relay) and isn't ours to bypass.
// A popup window is a legitimate middle ground: it's still a real top-level
// browsing context on HeyGen's origin (so the policy doesn't apply and the
// check's guarantees hold), but it's launched from and returns focus to this
// app instead of swapping the whole tab away.
//
// It opens on our own consent-instructions.html first (explaining what's
// about to happen) rather than jumping straight to HeyGen, since landing
// cold on a live-webcam recording page with no context is disorienting.
//
// checkStatus (optional) re-checks the real consent status right after
// opening: a stored consent link goes stale if it was already approved out
// of band (e.g. via a direct status poll, or HeyGen finishing review before
// the user got back to the app) — revisiting a used link then just shows a
// dead-end error on HeyGen's side with no way forward, so this closes the
// popup immediately instead of stranding the user there.
//
// onClosed lets a caller refresh consent status the moment the user's done
// (or the moment the popup is auto-closed above), instead of waiting on the
// next background poll.
export function openConsentWindow(url, { onClosed, checkStatus } = {}) {
  const width = 480;
  const height = 820;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const instructionsUrl = `${window.location.origin}/consent-instructions.html?to=${encodeURIComponent(url)}`;
  const popup = window.open(instructionsUrl, 'heygen-consent', `width=${width},height=${height},left=${left},top=${top}`);
  if (!popup) return null;

  if (checkStatus) {
    checkStatus()
      .then((freshProfile) => {
        if (freshProfile?.videoAvatar?.consentStatus !== 'pending' && !popup.closed) {
          popup.close();
        }
      })
      .catch(() => {});
  }

  if (onClosed) {
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        onClosed();
      }
    }, 1000);
  }
  return popup;
}
