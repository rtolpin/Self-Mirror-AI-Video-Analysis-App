import { useEffect, useRef, useState } from 'react';
import { Sparkles, Video, Volume2, Trash2, Loader2, CheckCircle2, Clock, MessageSquare, Brain, Heart, UserCircle2 } from 'lucide-react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';
import LoadingState from './LoadingState.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import VoiceCloneRecorder from './VoiceCloneRecorder.jsx';
import { resetVoiceConsentFlags, openConsentWindow } from '../voiceConsent.js';

const EMPTY_PROFILE = { personality: null, hasVoice: false, sessionCount: 0, updatedAt: null, videoAvatar: null };

const TRAIT_PALETTES = [
  'border-sky-400/40 bg-sky-400/10 text-sky-300',
  'border-violet-400/40 bg-violet-400/10 text-violet-300',
  'border-rose-400/40 bg-rose-400/10 text-rose-300',
  'border-amber-400/40 bg-amber-400/10 text-amber-300',
  'border-teal-400/40 bg-teal-400/10 text-teal-300',
];

export default function TwinPanel({ onProfileChange, onStartSession, buildingTwin }) {
  const [profile, setProfile] = useState(null);
  // Distinct from `profile` being null: `profile` is legitimately null before
  // any twin has ever been built, which isn't the same as "still fetching."
  const [loaded, setLoaded] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  // profile.sessionCount only reflects how many sessions existed as of the
  // *last build* (it's 0 until "Build My Twin" is ever clicked, even with
  // sessions already recorded) — this tracks how many actually exist, so the
  // empty state below doesn't wrongly tell someone who's already recorded to
  // go record "their first" one again.
  const [recordedSessionCount, setRecordedSessionCount] = useState(null);

  const [testText, setTestText] = useState("Hi, it's really me — or at least, an echo of me.");
  const [speaking, setSpeaking] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'voice' | 'videoAvatar'

  useEffect(() => {
    load();
  }, []);

  // While HeyGen is reviewing the consent submission, poll for a resolution
  // every few seconds rather than requiring a manual refresh.
  useEffect(() => {
    if (profile?.videoAvatar?.consentStatus !== 'pending') return;
    const timer = setInterval(async () => {
      try {
        const data = await api.getVideoAvatarStatus();
        setProfile(data);
        onProfileChange?.(data);
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.videoAvatar?.consentStatus]);

  async function load() {
    try {
      setError(null);
      const [data, sessions] = await Promise.all([api.getTwin(), api.listSessions()]);
      setProfile(data);
      setRecordedSessionCount(sessions.length);
      onProfileChange?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }

  // The actual auto-build trigger lives in App.jsx now, so it fires as soon
  // as a session is saved regardless of which tab is open (Life Paths and
  // Ask My Twin need to know about it too, not just this page) — this just
  // refetches once that shared build finishes, to pick up the result
  // without requiring a remount.
  const wasBuildingTwin = useRef(buildingTwin);
  useEffect(() => {
    if (wasBuildingTwin.current && !buildingTwin) load();
    wasBuildingTwin.current = buildingTwin;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingTwin]);

  async function handleBuild() {
    setBuilding(true);
    setError(null);
    try {
      await api.buildTwin();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuilding(false);
    }
  }

  async function handleConfirmDelete() {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'voice') {
      await api.deleteVoice();
      resetVoiceConsentFlags();
      await load();
    } else if (action === 'videoAvatar') {
      await api.deleteVideoAvatar();
      await load();
    }
  }

  async function handleTestSpeak() {
    setSpeaking(true);
    setError(null);
    try {
      const blob = await api.speak(testText);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setSpeaking(false);
      await audio.play();
    } catch (err) {
      setError(err.message);
      setSpeaking(false);
    }
  }

  if (!loaded) return <LoadingState />;

  if (error && !profile) {
    return (
      <div className="text-center py-14 space-y-3">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="text-sm px-4 py-2 rounded-lg border border-white/15 hover:border-white/30">
          Try Again
        </button>
      </div>
    );
  }

  const p = profile || EMPTY_PROFILE;

  if (!p.personality && !recordedSessionCount && !buildingTwin) {
    return (
      <EmptyState
        description="Your AI Twin is built from what it learns across your recorded sessions. Record your first one to start building it."
        onGoToRecord={onStartSession}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid lg:grid-cols-[3fr_2fr] gap-6 items-start">
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center shrink-0">
              <UserCircle2 className="w-4 h-4 text-black" />
            </div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">
              Personality Profile
            </h3>
          </div>
          <button
            onClick={handleBuild}
            disabled={building || buildingTwin}
            className="text-xs text-white/50 hover:text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            {building || buildingTwin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {p.personality ? 'Rebuild From All Sessions' : 'Build My Twin'}
          </button>
        </div>

        {building || buildingTwin ? (
          <div className="flex flex-col items-center text-center py-10 bg-gradient-to-br from-violet-400/10 via-fuchsia-400/10 to-rose-400/10 border border-white/10 rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400 mb-3" />
            <p className="font-medium">{p.personality ? 'Rebuilding your twin…' : 'Building your twin…'}</p>
            <p className="text-sm text-white/50 mt-1">Analyzing your recorded sessions — this takes a few seconds.</p>
          </div>
        ) : p.personality ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 space-y-4">
            <p className="text-base font-semibold leading-snug">{p.personality.summary}</p>

            {p.personality.corePersonalityTraits?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.personality.corePersonalityTraits.map((trait, i) => (
                  <span key={i} className={`text-xs font-medium px-3 py-1.5 rounded-full border-2 ${TRAIT_PALETTES[i % TRAIT_PALETTES.length]}`}>
                    {trait}
                  </span>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-3.5">
                <p className="text-xs font-semibold text-sky-300 mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> SPEECH PATTERNS
                </p>
                <p className="text-sm">{p.personality.speechPatterns}</p>
              </div>
              <div className="rounded-xl border border-violet-400/30 bg-violet-400/5 p-3.5">
                <p className="text-xs font-semibold text-violet-300 mb-1.5 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> THOUGHT PROCESS
                </p>
                <p className="text-sm">{p.personality.thoughtProcessStyle}</p>
              </div>
              <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-3.5">
                <p className="text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" /> VALUES
                </p>
                <p className="text-sm">{p.personality.valuesAndPriorities}</p>
              </div>
            </div>

            <p className="text-white/40 text-xs">Built from {p.sessionCount} session(s) · updated {new Date(p.updatedAt).toLocaleString()}</p>
          </div>
        ) : (
          <p className="text-sm text-white/40">You have {recordedSessionCount} session(s) recorded — build your twin whenever you're ready.</p>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-black" />
          </div>
          <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent">
            Voice & Video Avatar
          </h3>
        </div>

        {p.hasVoice ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-emerald-400 text-emerald-300 bg-emerald-400/10">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Voice Cloned</span>
              </div>

              {p.videoAvatar?.consentStatus && (
                p.videoAvatar.ready ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-violet-400 text-violet-300 bg-violet-400/10">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Video Avatar Ready</span>
                  </div>
                ) : p.videoAvatar.consentStatus === 'pending' ? (
                  p.videoAvatar.consentUrl ? (
                    <button
                      onClick={() => openConsentWindow(p.videoAvatar.consentUrl, { onClosed: load, checkStatus: api.getVideoAvatarStatus })}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-amber-400 text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 transition"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">Complete Video Consent On HeyGen →</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-amber-400 text-amber-300 bg-amber-400/10">
                      <Clock className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-medium">Reviewing Consent…</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-white/20 text-white/60 bg-white/5">
                    <span className="text-sm font-medium">Video Avatar: {p.videoAvatar.consentStatus}</span>
                  </div>
                )
              )}
            </div>

            {p.videoAvatar?.consentStatus === 'pending' && p.videoAvatar.consentUrl && (
              <p className="text-xs text-white/40">
                One more step for videos where it actually looks like you're speaking the new words: HeyGen requires
                completing a short live webcam check on their own page (they read your face live and have you repeat
                a code — a security step we can't do on your behalf). Until then, style videos are dubbed with your
                voice over your original footage instead.
              </p>
            )}

            <div className="flex gap-2">
              <input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              />
              <button onClick={handleTestSpeak} disabled={speaking} className="bg-white text-black px-3 rounded-lg flex items-center gap-1.5 text-sm">
                <Volume2 className="w-3.5 h-3.5" /> {speaking ? 'Playing…' : 'Speak'}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setConfirmAction('voice')} className="text-red-400 text-xs flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete Cloned Voice
              </button>
              {p.videoAvatar?.consentStatus && (
                <button onClick={() => setConfirmAction('videoAvatar')} className="text-red-400 text-xs flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete Video Avatar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
            <VoiceCloneRecorder onCloned={load} />
          </div>
        )}
      </section>
      </div>

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction === 'voice' ? 'Delete Cloned Voice?' : 'Delete Video Avatar?'}
        message={
          confirmAction === 'voice'
            ? 'This permanently deletes your cloned voice from ElevenLabs and this app.'
            : 'This permanently deletes your video avatar from HeyGen and this app.'
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
