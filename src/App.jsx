import { useEffect, useRef, useState } from 'react';
import { PlusCircle, History as HistoryIcon, UserCircle2, Compass, MessageCircleQuestion, Trash2, ArrowRight, ArrowLeft, Sparkles, Target, LogOut, UserPlus } from 'lucide-react';
import ReasonInput, { GENERAL_OPTION } from './components/ReasonInput.jsx';
import Recorder from './components/Recorder.jsx';
import SessionDetail from './components/SessionDetail.jsx';
import History from './components/History.jsx';
import TwinPanel from './components/TwinPanel.jsx';
import LifePathsPanel from './components/LifePathsPanel.jsx';
import ScenarioPanel from './components/ScenarioPanel.jsx';
import StepIndicator from './components/StepIndicator.jsx';
import RecentRecordings from './components/RecentRecordings.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import Auth from './components/Auth.jsx';
import LoadingState from './components/LoadingState.jsx';
import UpgradeAccountModal from './components/UpgradeAccountModal.jsx';
import { api } from './api.js';
import { resetVoiceConsentFlags } from './voiceConsent.js';

const TABS = [
  { id: 'record', label: 'New Session', icon: PlusCircle, color: 'text-emerald-400' },
  { id: 'history', label: 'History', icon: HistoryIcon, color: 'text-sky-400' },
  { id: 'twin', label: 'My Twin', icon: UserCircle2, color: 'text-violet-400' },
  { id: 'paths', label: 'Life Paths', icon: Compass, color: 'text-amber-400' },
  { id: 'ask', label: 'Ask My Twin', icon: MessageCircleQuestion, color: 'text-rose-400' },
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out, object = signed in
  const [tab, setTab] = useState('record');
  const [recordStep, setRecordStep] = useState('reason'); // 'reason' | 'capture'
  const [reason, setReason] = useState('');
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [twinProfile, setTwinProfile] = useState(null);
  const [buildingTwin, setBuildingTwin] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  // Guards against firing the auto-build twice — once from the login-time
  // check and again right after a session is saved — without preventing a
  // real later attempt if the first one bailed out for having zero sessions.
  const autoBuildAttemptedRef = useRef(false);

  useEffect(() => {
    api.me().then(({ user }) => setUser(user)).catch(() => setUser(null));
  }, []);

  // Building the twin used to only happen if/when someone visited "My Twin"
  // and clicked (or auto-triggered) the build there — so Life Paths and Ask
  // My Twin, which both gate on a built profile, stayed stuck on "Nothing
  // Here Yet" for anyone who recorded a session but went straight to one of
  // those tabs instead. Centralizing the trigger here means it starts the
  // moment a session exists, regardless of which tab is open, and every
  // consumer of `twinProfile`/`buildingTwin` can show real-time progress.
  async function maybeAutoBuildTwin(currentProfile) {
    if (currentProfile?.personality || autoBuildAttemptedRef.current) return;
    try {
      const sessions = await api.listSessions();
      if (!sessions.length) return;
      autoBuildAttemptedRef.current = true;
      setBuildingTwin(true);
      const built = await api.buildTwin();
      setTwinProfile(built);
    } catch (err) {
      console.error('Auto-build twin failed (manual build from My Twin still available):', err.message);
    } finally {
      setBuildingTwin(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const profile = await api.getTwin();
      setTwinProfile(profile);
      await maybeAutoBuildTwin(profile);
    })();

    // A quick escape hatch for when the "don't ask me again" voice-consent
    // choice needs clearing but there's no reason to make someone open
    // DevTools for it: visiting the app with ?resetConsent=1 clears it.
    const params = new URLSearchParams(window.location.search);
    if (params.get('resetConsent')) {
      resetVoiceConsentFlags();
      params.delete('resetConsent');
      const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const videoAvatarConsentUrl = twinProfile?.videoAvatar?.consentStatus === 'pending' ? twinProfile.videoAvatar.consentUrl : null;

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setTwinProfile(null);
    setSavedSessionId(null);
    setTab('record');
  }

  function goToTab(id) {
    setTab(id);
    setSavedSessionId(null);
    setRecordStep('reason');
    setReason('');
  }

  async function handleWipeAll() {
    setConfirmWipe(false);
    await api.wipeAllData();
    resetVoiceConsentFlags();
    setSavedSessionId(null);
    setTwinProfile(null);
    window.location.reload();
  }

  if (user === undefined) return <LoadingState />;
  if (!user) return <Auth onAuthed={setUser} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <button onClick={() => goToTab('record')} className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="flex items-baseline gap-2.5">
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 bg-clip-text text-transparent">
              Self-Mirror
            </span>
            <span className="hidden sm:inline text-xs text-white/40">
              Record yourself, get honest AI feedback, and see yourself in different styles
            </span>
          </span>
        </button>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-white/40">{user.isGuest ? 'Guest' : user.email}</span>
          <button
            onClick={() => setConfirmWipe(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/20 hover:border-red-400/70 flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete All My Data
          </button>
          {user.isGuest ? (
            <>
              <button
                onClick={handleLogout}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/40 flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Back To Sign In
              </button>
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 hover:brightness-110 text-black flex items-center gap-1.5 transition shadow-lg shadow-emerald-400/20"
              >
                <UserPlus className="w-3.5 h-3.5" /> Create Account To Save
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/40 flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </header>

      <UpgradeAccountModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgraded={(updatedUser) => { setUser(updatedUser); setShowUpgrade(false); }}
      />

      <nav className="flex gap-1 px-6 py-3 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goToTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              tab === t.id ? 'bg-white text-black' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon className={`w-4 h-4 ${t.color}`} /> {t.label}
          </button>
        ))}
      </nav>

      <main className="px-6 py-8">
        {tab === 'record' && (
          savedSessionId ? (
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => goToTab('record')}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 hover:border-emerald-400/70 mb-4 flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Record Another
              </button>
              <SessionDetail
                sessionId={savedSessionId}
                hasVoice={twinProfile?.hasVoice}
                hasVideoAvatar={twinProfile?.videoAvatar?.ready}
                videoAvatarConsentUrl={videoAvatarConsentUrl}
                onDeleted={() => setSavedSessionId(null)}
                onVoiceCloned={() => api.getTwin().then(setTwinProfile)}
              />
            </div>
          ) : recordStep === 'reason' ? (
            <div className="max-w-6xl mx-auto grid md:grid-cols-[240px_1fr_240px] gap-8 items-start">
              <div className="md:col-start-1">
                <RecentRecordings onSelect={(id) => setSavedSessionId(id)} />
              </div>
              <div className="md:col-start-2 space-y-6 max-w-2xl w-full mx-auto">
                {/* holy-grail centering: this middle column, not the row, is what actually centers.
                    Explicit col-start on every grid child (not just this one) matters here: without
                    it, CSS Grid auto-placement assigns tracks by DOM order, so when RecentRecordings
                    renders null (any account with zero past sessions — which is now every fresh
                    signup, not just a rare state) this column silently shifts into track 1 instead
                    of 2, breaking the whole layout. */}
                <StepIndicator current={1} />
                <div>
                  <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">What Are You Preparing For?</span>
                  </h2>
                  <p className="text-sm text-white/50">Search a common occasion or type your own — or just pick general analysis. Next, you'll record a short video for AI feedback.</p>
                </div>
                <ReasonInput value={reason} onChange={setReason} onSubmit={() => reason.trim() && setRecordStep('capture')} />
                <button
                  disabled={!reason.trim()}
                  onClick={() => setRecordStep('capture')}
                  className="w-full py-3 rounded-xl bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 text-black font-semibold flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3 text-xs text-white/30">
                  <div className="flex-1 h-px bg-white/10" /> Or <div className="flex-1 h-px bg-white/10" />
                </div>

                <button
                  onClick={() => { setReason(GENERAL_OPTION); setRecordStep('capture'); }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-white/20 hover:border-emerald-400/60 hover:bg-emerald-400/5 transition text-left"
                >
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-medium">Skip — Just Analyze Me</p>
                    <p className="text-xs text-white/50">No specific occasion, get a general read</p>
                  </div>
                </button>
              </div>
              <div className="hidden md:block md:col-start-3" aria-hidden="true" />
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              <StepIndicator current={2} onStepClick={(n) => n === 1 && setRecordStep('reason')} />
              <div>
                <h2 className="text-xl font-semibold">{reason}</h2>
                <p className="text-sm text-white/50 mt-1">Record a short video of yourself — we'll transcribe it and give you an honest read right after.</p>
              </div>
              <Recorder context={reason} onSaved={(s) => { setSavedSessionId(s.id); maybeAutoBuildTwin(twinProfile); }} />
            </div>
          )
        )}

        {tab === 'history' && (
          <div className="max-w-2xl mx-auto">
            <History
              hasVoice={twinProfile?.hasVoice}
              hasVideoAvatar={twinProfile?.videoAvatar?.ready}
              videoAvatarConsentUrl={videoAvatarConsentUrl}
              onStartSession={() => goToTab('record')}
              onVoiceCloned={() => api.getTwin().then(setTwinProfile)}
            />
          </div>
        )}

        {tab === 'twin' && (
          <div className="max-w-6xl mx-auto">
            <TwinPanel onProfileChange={setTwinProfile} onStartSession={() => goToTab('record')} buildingTwin={buildingTwin} />
          </div>
        )}

        {tab === 'paths' && (
          <div className="max-w-2xl mx-auto">
            <LifePathsPanel hasTwin={!!twinProfile?.personality} buildingTwin={buildingTwin} onStartSession={() => goToTab('record')} />
          </div>
        )}

        {tab === 'ask' && (
          <div className="max-w-2xl mx-auto">
            <ScenarioPanel hasTwin={!!twinProfile?.personality} buildingTwin={buildingTwin} onStartSession={() => goToTab('record')} />
          </div>
        )}
      </main>

      <ConfirmModal
        open={confirmWipe}
        title="Delete All My Data?"
        message="This permanently deletes every recording, analysis, your twin profile, and your cloned voice. This can't be undone."
        confirmLabel="Delete Everything"
        onConfirm={handleWipeAll}
        onCancel={() => setConfirmWipe(false)}
      />
    </div>
  );
}
