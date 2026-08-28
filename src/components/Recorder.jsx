import { useEffect, useRef, useState } from 'react';
import { Circle, Square, RotateCcw, Save, Loader2 } from 'lucide-react';
import { api } from '../api.js';

const MAX_SNAPSHOTS = 4;
const SNAPSHOT_INTERVAL_MS = 3000;
const MAX_DURATION_SECONDS = 120;
// Keep bitrate modest — this is a short self-analysis clip, not a production
// recording, and a smaller file is the single biggest lever on upload time.
const VIDEO_BITS_PER_SECOND = 1_500_000;

function pickMimeType() {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Recorder({ context, onSaved }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedBlobRef = useRef(null);
  const snapshotTimerRef = useRef(null);
  const snapshotsRef = useRef([]);
  const clockTimerRef = useRef(null);
  const mimeTypeRef = useRef('');
  // Bumped on every startCamera()/stopStreamTracks() call so a slow, stale
  // getUserMedia() from an earlier invocation (e.g. React StrictMode's
  // deliberate dev-mode mount→unmount→remount) can detect it's been
  // superseded instead of racing a newer stream for the same <video> element.
  const cameraGenRef = useRef(0);

  const [streamActive, setStreamActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopStreamTracks();
      clearInterval(snapshotTimerRef.current);
      clearInterval(clockTimerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError(null);
    const gen = ++cameraGenRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      if (gen !== cameraGenRef.current) {
        // Superseded by a newer startCamera() call while we were waiting on
        // permission/hardware — discard this stream rather than assigning it
        // to a <video> element a newer call may already be using.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Benign: another srcObject assignment interrupted this play()
          // call (e.g. StrictMode's double-invoke). Not a real failure.
          if (playErr.name !== 'AbortError') throw playErr;
        }
      }
      setStreamActive(true);
    } catch (err) {
      if (gen === cameraGenRef.current) {
        setError('Could not access camera/microphone: ' + err.message);
      }
    }
  }

  function stopStreamTracks() {
    cameraGenRef.current++;
    const stream = videoRef.current?.srcObject;
    stream?.getTracks?.().forEach((t) => t.stop());
    setStreamActive(false);
  }

  function captureSnapshot() {
    if (snapshotsRef.current.length >= MAX_SNAPSHOTS || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) snapshotsRef.current.push(blob);
    }, 'image/jpeg', 0.85);
  }

  async function transcribeRecording(blob, ext) {
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const form = new FormData();
      form.append('video', blob, `clip.${ext}`);
      const { text } = await api.transcribe(form);
      setTranscript(text || '');
    } catch (err) {
      setTranscribeError("Couldn't auto-transcribe this clip — you can type what you said instead.");
    } finally {
      setTranscribing(false);
    }
  }

  function startRecording() {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;

    chunksRef.current = [];
    snapshotsRef.current = [];
    recordedBlobRef.current = null;
    setTranscript('');
    setTranscribeError(null);
    setElapsed(0);

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      // Only release the camera/mic once the final chunk has actually landed —
      // stopping tracks earlier can truncate the last chunk and produce a
      // video file that saves but won't play back.
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      recordedBlobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      stopStreamTracks();
      transcribeRecording(blob, mimeType.includes('mp4') ? 'mp4' : 'webm');
    };
    recorder.start();
    recorderRef.current = recorder;

    captureSnapshot();
    snapshotTimerRef.current = setInterval(captureSnapshot, SNAPSHOT_INTERVAL_MS);

    clockTimerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS) stopRecording();
        return next;
      });
    }, 1000);

    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    clearInterval(snapshotTimerRef.current);
    clearInterval(clockTimerRef.current);
    setRecording(false);
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTranscript('');
    setTranscribeError(null);
    setElapsed(0);
    setError(null);
    chunksRef.current = [];
    snapshotsRef.current = [];
    recordedBlobRef.current = null;
    startCamera();
  }

  async function handleSave() {
    if (!recordedBlobRef.current) return;
    setSaving(true);
    setProgress(0);
    setError(null);
    try {
      const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm';
      const form = new FormData();
      form.append('context', context);
      form.append('transcript', transcript);
      form.append('video', recordedBlobRef.current, `session.${ext}`);
      snapshotsRef.current.forEach((blob, i) => form.append('photos', blob, `frame-${i}.jpg`));

      const session = await api.createSessionWithProgress(form, setProgress);
      onSaved(session);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
        {previewUrl ? (
          <video
            key="preview"
            src={previewUrl}
            controls
            muted
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              // Recorded blobs often render solid black until played or
              // seeked at least once. Nudge the frame forward so something
              // is visible even if autoplay below gets blocked, and try to
              // start playback (muted, since browsers require that for
              // autoplay without a fresh user gesture).
              v.currentTime = 0.01;
              v.play().catch(() => {});
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <video key="live" ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        )}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium">
            <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
            {formatTime(elapsed)} <span className="text-white/40">/ {formatTime(MAX_DURATION_SECONDS)}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!previewUrl && (
        <button
          disabled={!streamActive}
          onClick={recording ? stopRecording : startRecording}
          className={`w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition shadow-lg ${
            recording
              ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
              : 'bg-emerald-400 hover:bg-emerald-300 text-black disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none shadow-emerald-400/20'
          }`}
        >
          {recording ? <><Square className="w-4 h-4" /> Stop Recording</> : <><Circle className="w-4 h-4" /> Start Recording</>}
        </button>
      )}

      {previewUrl && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 block mb-1.5 flex items-center gap-1.5">
              {transcribing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing What You Said…</>
              ) : (
                transcript ? 'What You Said (Auto-Transcribed — Edit If Needed)' : 'What You Said'
              )}
            </label>
            {transcribeError && <p className="text-xs text-amber-400 mb-1.5">{transcribeError}</p>}
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              disabled={transcribing}
              className="w-full bg-white/5 border border-white/10 focus:border-emerald-400 rounded-xl p-3 text-sm outline-none transition disabled:opacity-50"
              placeholder="Type Roughly What You Said During This Recording…"
            />
          </div>

          {saving ? (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-white/50 text-center">Uploading… {progress}%</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-3 rounded-xl border border-white/15 hover:border-white/30 flex items-center justify-center gap-2 font-medium">
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
              <button
                onClick={handleSave}
                disabled={transcribing}
                className="flex-1 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/20"
              >
                <Save className="w-4 h-4" /> Save & Analyze
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
