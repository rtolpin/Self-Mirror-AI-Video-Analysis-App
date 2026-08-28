import { useState } from 'react';
import { Mic2, X, CheckCircle2 } from 'lucide-react';
import VoiceCloneRecorder from './VoiceCloneRecorder.jsx';
import { openConsentWindow } from '../voiceConsent.js';
import { api } from '../api.js';

// Launched from a style chip's consent modal when the user has no cloned
// voice yet: walks them through recording + cloning right here, then asks
// for a second, narrower consent — using that voice to narrate this
// specific style — instead of just dropping them on the My Twin page.
export default function CloneVoiceModal({ open, styleLabel, onClose, onCloned, onGenerate }) {
  const [cloned, setCloned] = useState(false);
  const [consentUrl, setConsentUrl] = useState(null);

  if (!open) return null;

  async function handleCloned(profile) {
    setConsentUrl(profile?.videoAvatar?.consentUrl || null);
    await onCloned?.(profile);
    setCloned(true);
  }

  function handleClose() {
    setCloned(false);
    setConsentUrl(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-[#17171d] border border-emerald-400/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
            {cloned ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <Mic2 className="w-5 h-5 text-emerald-300" />}
          </div>
          <button onClick={handleClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {cloned ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-emerald-200">Voice Cloned!</h3>
              <p className="text-sm text-white/60 mt-1.5">
                Your voice is ready. Generate "{styleLabel}" now, narrated in your cloned voice? This happens every time
                you generate a style unless you say otherwise here.
              </p>
            </div>
            {consentUrl && (
              <div className="border-2 border-emerald-400/60 bg-emerald-400/10 rounded-xl p-4 space-y-2.5">
                <p className="text-sm font-semibold text-emerald-100 leading-snug">
                  Optional: Want the video itself to look like you're speaking these words?
                </p>
                <p className="text-xs text-white/50">
                  That needs one more thing: a quick live webcam check on HeyGen's own page (they have you repeat a
                  code — a security step we can't do for you). Until then, styles are dubbed with your voice over
                  your original footage instead.
                </p>
                <button
                  onClick={() => openConsentWindow(consentUrl, { onClosed: onCloned, checkStatus: api.getVideoAvatarStatus })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs transition shadow-lg shadow-emerald-400/20"
                >
                  Complete It Now →
                </button>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-white/15 hover:border-white/30 text-sm transition">
                Not Now
              </button>
              <button
                onClick={() => { handleClose(); onGenerate?.(); }}
                className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-sm transition"
              >
                I Consent — Generate
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h3 className="font-semibold text-lg text-emerald-200">Clone Your Voice</h3>
              <p className="text-xs text-white/40 mt-1">
                Do this once — then every style you generate can be narrated in your own voice.
              </p>
            </div>
            <VoiceCloneRecorder onCloned={handleCloned} />
          </>
        )}
      </div>
    </div>
  );
}
