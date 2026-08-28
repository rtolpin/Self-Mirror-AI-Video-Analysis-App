import { useEffect, useRef, useState } from 'react';
import { Video, Square } from 'lucide-react';
import { api } from '../api.js';

function pickMimeType() {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

// Shared by TwinPanel (the full My Twin page) and CloneVoiceModal (the
// in-context clone-and-consent flow launched from a style chip), so both
// places record and upload a voice/avatar sample the same way.
export default function VoiceCloneRecorder({ onCloned }) {
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [consentScript, setConsentScript] = useState('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const liveVideoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    api.getConsentScript().then((d) => setConsentScript(d.script)).catch(() => {});
  }, []);

  // The <video> preview only mounts once `recording` becomes true, so
  // assigning srcObject inline in startVoiceRecording (before that state
  // update has rendered) targets a ref that doesn't exist yet and silently
  // no-ops, leaving the preview black. Assigning it here, after the element
  // has actually mounted, is what makes the live preview show up.
  useEffect(() => {
    if (recording && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [recording]);

  async function startVoiceRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError('Could not access camera/microphone: ' + err.message);
    }
  }

  function stopVoiceRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function discardRecording() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRecordedBlob(null);
    setPreviewUrl(null);
  }

  async function handleUploadVoice() {
    if (!recordedBlob) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('video', recordedBlob, 'voice-sample.webm');
      // Where HeyGen's hosted consent page redirects once the user finishes
      // the live check there. This points at a page that just closes itself
      // (see public/consent-complete.html) rather than back into the app —
      // the consent flow always runs in a popup (see openConsentWindow),
      // so reloading the full app there would just show it awkwardly inside
      // a small window instead of returning control to the tab underneath.
      form.append('returnUrl', `${window.location.origin}/consent-complete.html`);
      const profile = await api.uploadVoiceSample(form);
      discardRecording();
      await onCloned?.(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-white/60">
        Record yourself reading the line below out loud. This clones your voice (sent to ElevenLabs) and — if a video
        avatar is set up — becomes the footage and consent proof for a talking-avatar version of you (sent to HeyGen).
      </p>
      {consentScript && (
        <p className="italic text-emerald-200 border-l-4 border-emerald-400/60 bg-emerald-400/5 rounded-r-lg pl-3 py-2">{consentScript}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {previewUrl ? (
        <div className="space-y-2">
          <video src={previewUrl} controls muted className="w-full rounded-lg" />
          <div className="flex gap-2">
            <button onClick={handleUploadVoice} disabled={uploading} className="bg-emerald-400 hover:bg-emerald-300 text-black font-semibold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 shadow-lg shadow-emerald-400/20">
              {uploading ? 'Uploading…' : 'Clone My Voice & Avatar'}
            </button>
            <button onClick={discardRecording} className="text-white/40 text-xs">Discard</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {recording && <video ref={liveVideoRef} muted playsInline className="w-full rounded-lg bg-black" />}
          <button
            onClick={recording ? stopVoiceRecording : startVoiceRecording}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-lg ${
              recording ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-400/20'
            }`}
          >
            {recording ? <><Square className="w-4 h-4" /> Stop</> : <><Video className="w-4 h-4" /> Record Voice & Avatar Sample</>}
          </button>
        </div>
      )}
    </div>
  );
}
