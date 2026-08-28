import { useEffect, useRef, useState } from 'react';
import { Sparkles, Volume2, Trash2, Loader2, TrendingUp, CheckCircle2, Gauge, Smile, Compass, Film, Mic2, X, Square } from 'lucide-react';
import { api } from '../api.js';
import { STYLE_LABELS } from '../styles.js';
import LoadingState from './LoadingState.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import CloneVoiceModal from './CloneVoiceModal.jsx';
import { VOICE_CONSENT_KEY, VOICE_PROMPT_DISMISSED_KEY, openConsentWindow } from '../voiceConsent.js';

// Tailwind needs full literal class names, so each style chip's palette is
// spelled out and cycled through by index rather than built dynamically.
const CHIP_PALETTES = [
  { idle: 'border-sky-400/25 bg-sky-950/50 text-sky-300/80 hover:border-sky-400/60 hover:bg-sky-950/70', active: 'border-sky-400 bg-sky-400/20 text-sky-300' },
  { idle: 'border-violet-400/25 bg-violet-950/50 text-violet-300/80 hover:border-violet-400/60 hover:bg-violet-950/70', active: 'border-violet-400 bg-violet-400/20 text-violet-300' },
  { idle: 'border-rose-400/25 bg-rose-950/50 text-rose-300/80 hover:border-rose-400/60 hover:bg-rose-950/70', active: 'border-rose-400 bg-rose-400/20 text-rose-300' },
  { idle: 'border-amber-400/25 bg-amber-950/50 text-amber-300/80 hover:border-amber-400/60 hover:bg-amber-950/70', active: 'border-amber-400 bg-amber-400/20 text-amber-300' },
  { idle: 'border-teal-400/25 bg-teal-950/50 text-teal-300/80 hover:border-teal-400/60 hover:bg-teal-950/70', active: 'border-teal-400 bg-teal-400/20 text-teal-300' },
  { idle: 'border-fuchsia-400/25 bg-fuchsia-950/50 text-fuchsia-300/80 hover:border-fuchsia-400/60 hover:bg-fuchsia-950/70', active: 'border-fuchsia-400 bg-fuchsia-400/20 text-fuchsia-300' },
  { idle: 'border-lime-400/25 bg-lime-950/50 text-lime-300/80 hover:border-lime-400/60 hover:bg-lime-950/70', active: 'border-lime-400 bg-lime-400/20 text-lime-300' },
];

function confidencePalette(score) {
  if (score >= 8) return { ring: 'border-emerald-400 text-emerald-300 bg-emerald-400/10' };
  if (score >= 5) return { ring: 'border-amber-400 text-amber-300 bg-amber-400/10' };
  return { ring: 'border-rose-400 text-rose-300 bg-rose-400/10' };
}

const ANALYSIS_AUDIO_KEY = '__analysis__';

function buildAnalysisNarration(analysis) {
  const parts = [analysis.overallSentiment, analysis.honestFeedback];
  if (analysis.strengths?.length) parts.push(`Strengths: ${analysis.strengths.join('. ')}.`);
  if (analysis.growthAreas?.length) parts.push(`Areas to grow: ${analysis.growthAreas.join('. ')}.`);
  return parts.filter(Boolean).join(' ');
}

export default function SessionDetail({ sessionId, hasVoice, hasVideoAvatar, videoAvatarConsentUrl, onDeleted, onVoiceCloned }) {
  const [session, setSession] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [generatingStyle, setGeneratingStyle] = useState(null);
  const [speakingStyle, setSpeakingStyle] = useState(null);
  const speakingAudioRef = useRef(null);
  const [dubbingVariantId, setDubbingVariantId] = useState(null);
  const [pendingStyleKey, setPendingStyleKey] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: 'session' } | { type: 'variant', id }
  const [scrollToVariantId, setScrollToVariantId] = useState(null);
  const autoAnalyzedRef = useRef(false);
  const variantRefs = useRef({});

  useEffect(() => {
    autoAnalyzedRef.current = false;
    load();
  }, [sessionId]);

  useEffect(() => {
    // One click on "Save & Analyze" should be enough — auto-run the
    // analysis the first time a session with none loads, instead of making
    // the user press a second "Analyze" button.
    if (session?.id === sessionId && !session.analysis && !autoAnalyzedRef.current) {
      autoAnalyzedRef.current = true;
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionId]);

  async function load() {
    const data = await api.getSession(sessionId);
    setSession(data);
    return data;
  }

  // HeyGen renders asynchronously (well over a minute for some clips), so
  // poll rather than block — this runs on a shared interval as long as any
  // variant on this session is mid-render.
  useEffect(() => {
    const hasGenerating = session?.variants?.some((v) => v.videoStatus === 'generating');
    if (!hasGenerating) return;
    const timer = setInterval(async () => {
      const generating = session.variants.filter((v) => v.videoStatus === 'generating');
      for (const v of generating) {
        try {
          await api.getVariantVideoStatus(v.id);
        } catch { /* keep polling */ }
      }
      await load();
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Scrolls to a just-generated variant once it actually has something to
  // show — not the instant the row appears (still just a spinner then), but
  // once its dub or synthetic video is ready, or immediately if neither will
  // ever apply (no voice/avatar, so the rewritten text is the whole result).
  useEffect(() => {
    if (!scrollToVariantId) return;
    const variant = session?.variants?.find((v) => v.id === scrollToVariantId);
    if (!variant) return;
    const hasResult = variant.videoUrl || variant.dubVideoUrl || (!hasVoice && !hasVideoAvatar);
    if (hasResult) {
      variantRefs.current[scrollToVariantId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToVariantId(null);
    }
  }, [session, scrollToVariantId, hasVoice, hasVideoAvatar]);

  async function handleGenerateVariantVideo(variantId) {
    setError(null);
    try {
      await api.generateVariantVideo(variantId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDubVariantVideo(variantId) {
    setDubbingVariantId(variantId);
    setError(null);
    try {
      await api.dubVariantVideo(variantId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDubbingVariantId(null);
    }
  }

  async function handleConfirmDelete() {
    const target = confirmTarget;
    setConfirmTarget(null);
    if (!target) return;
    setError(null);
    try {
      if (target.type === 'session') {
        await api.deleteSession(sessionId);
        onDeleted?.();
      } else if (target.type === 'variant') {
        await api.deleteVariant(target.id);
        await load();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      await api.analyzeSession(sessionId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerateVariant(styleKey, { voiceOverride } = {}) {
    setGeneratingStyle(styleKey);
    setError(null);
    try {
      await api.generateVariants(sessionId, [styleKey]);
      const updated = await load();
      // One click should be enough: automatically follow up with whichever
      // real video option is available, instead of waiting for a second,
      // separate click on the variant that just appeared.
      // voiceOverride covers the moment right after cloning a voice in this
      // same flow: the `hasVoice` prop won't reflect that until the parent's
      // twin-profile refetch re-renders this component with a new prop.
      const newVariant = updated.variants.find((v) => v.style === styleKey);
      if (newVariant) {
        setScrollToVariantId(newVariant.id);
        const effectiveHasVoice = voiceOverride ?? hasVoice;
        if (hasVideoAvatar) {
          // The synthetic HeyGen render is the higher-fidelity result, so
          // it's what auto-triggers here — dubbing every single generation
          // as well isn't needed on top of it and just costs an extra
          // ElevenLabs call each time. Dubbing stays available as an
          // explicit, optional action instead (see the "Dub With My Voice"
          // button below), for whoever wants the much-faster fallback while
          // the several-minutes-long synthetic render is still cooking.
          handleGenerateVariantVideo(newVariant.id);
        } else if (effectiveHasVoice) {
          // No video avatar set up — dubbing is the only real video option,
          // so it still happens automatically here.
          await handleDubVariantVideo(newVariant.id);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingStyle(null);
    }
  }

  function handleChipClick(styleKey) {
    // Show the modal on the first click either way: if a voice exists, it
    // asks consent to use it; if not, it explains that and offers a
    // shortcut to My Twin. Once either path has been acknowledged once, skip
    // straight to generating instead of interrupting every click.
    const alreadyDecided = hasVoice ? localStorage.getItem(VOICE_CONSENT_KEY) : localStorage.getItem(VOICE_PROMPT_DISMISSED_KEY);
    if (!alreadyDecided) {
      setPendingStyleKey(styleKey);
    } else {
      handleGenerateVariant(styleKey);
    }
  }

  function handleConsentAndGenerate() {
    localStorage.setItem(hasVoice ? VOICE_CONSENT_KEY : VOICE_PROMPT_DISMISSED_KEY, 'true');
    const styleKey = pendingStyleKey;
    setPendingStyleKey(null);
    handleGenerateVariant(styleKey);
  }

  function handlePlay(style, text) {
    // Clicking the same style again while it's already playing stops it,
    // instead of the button just being disabled with no way to cancel.
    if (speakingStyle === style) {
      speakingAudioRef.current?.pause();
      speakingAudioRef.current = null;
      setSpeakingStyle(null);
      return;
    }
    speakingAudioRef.current?.pause();
    setError(null);
    const audio = new Audio(api.getSpeakUrl(text));
    audio.onended = () => { setSpeakingStyle(null); speakingAudioRef.current = null; };
    audio.onerror = () => { setError('Playback failed.'); setSpeakingStyle(null); speakingAudioRef.current = null; };
    speakingAudioRef.current = audio;
    setSpeakingStyle(style);
    audio.play().catch((err) => {
      setError(err.message);
      setSpeakingStyle(null);
      speakingAudioRef.current = null;
    });
  }

  if (!session) return <LoadingState />;

  const contextLabel = session.context;
  const analysis = session.analysis;
  const confidence = analysis ? confidencePalette(analysis.confidenceScore) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{contextLabel}</h2>
          <p className="text-xs text-white/40">{new Date(session.createdAt).toLocaleString()}</p>
        </div>
        <button
          onClick={() => setConfirmTarget({ type: 'session' })}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-400/15 border border-sky-400/40 text-sky-300 hover:bg-sky-400/25 hover:border-sky-400/70 transition"
          title="Delete this recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {session.videoUrl && (
        <video
          key={session.videoUrl}
          src={session.videoUrl}
          controls
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01; }}
          className="w-full rounded-xl border border-white/10"
        />
      )}

      {session.transcript && (
        <div className="text-sm bg-white/5 border border-white/10 rounded-lg p-3">
          <span className="text-white/40">Transcript: </span>{session.transcript}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
              Honest Analysis
            </h3>
          </div>
          {analysis && (
            <div className="flex items-center gap-3">
              {hasVoice && (
                <button
                  onClick={() => handlePlay(ANALYSIS_AUDIO_KEY, buildAnalysisNarration(analysis))}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-400/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20 hover:border-sky-400/70 flex items-center gap-1.5 transition"
                >
                  {speakingStyle === ANALYSIS_AUDIO_KEY
                    ? <><Square className="w-3.5 h-3.5" /> Stop Reading Aloud</>
                    : <><Volume2 className="w-3.5 h-3.5" /> Read Aloud</>}
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-400/40 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20 hover:border-violet-400/70 flex items-center gap-1.5 disabled:opacity-50 transition"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Re-Analyze
              </button>
            </div>
          )}
        </div>

        {!analysis && analyzing && (
          <div className="flex flex-col items-center text-center py-10 bg-gradient-to-br from-emerald-400/10 via-sky-400/10 to-violet-400/10 border border-white/10 rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-3" />
            <p className="font-medium">Analyzing your recording…</p>
            <p className="text-sm text-white/50 mt-1">This takes a few seconds.</p>
          </div>
        )}

        {analysis && (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 space-y-5">
            <p className="text-lg font-semibold leading-snug">{analysis.overallSentiment}</p>

            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 ${confidence.ring}`}>
                <Gauge className="w-4 h-4" />
                <span className="text-sm font-medium">Confidence</span>
                <span className="text-base font-bold">{analysis.confidenceScore}/10</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-violet-400 text-violet-300 bg-violet-400/10">
                <Smile className="w-4 h-4" />
                <span className="text-sm font-medium">Tone</span>
                <span className="text-sm font-bold capitalize">{analysis.emotionalTone}</span>
              </div>
            </div>

            {analysis.bodyLanguageNotes && (
              <p className="text-sm text-white/60">{analysis.bodyLanguageNotes}</p>
            )}

            <div className="border-l-4 border-sky-400/60 bg-sky-400/5 rounded-r-lg pl-4 pr-3 py-3">
              <p className="text-sm leading-relaxed">{analysis.honestFeedback}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3.5">
                <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> STRENGTHS
                </p>
                <ul className="space-y-1.5">
                  {analysis.strengths?.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-emerald-400 mt-0.5">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3.5">
                <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> GROWTH AREAS
                </p>
                <ul className="space-y-1.5">
                  {analysis.growthAreas?.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {analysis.contextFitNotes && (
              <p className="text-xs text-white/40 flex items-start gap-1.5 italic">
                <Compass className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {analysis.contextFitNotes}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-1">Try Different Versions Of You</h3>
        <div className="flex items-start gap-2 border-2 border-sky-400/50 bg-sky-400/10 rounded-xl px-3.5 py-2.5 mb-3">
          <Sparkles className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-sky-100 leading-snug">
            Tap a style to generate it right away — the rewritten text and video will appear below this list once
            ready.
          </p>
        </div>

        {generatingStyle && (
          <div className="flex items-center gap-2.5 border-2 border-violet-400/50 bg-violet-400/10 rounded-xl px-3.5 py-2.5 mb-3">
            <Loader2 className="w-4 h-4 text-violet-300 shrink-0 animate-spin" />
            <p className="text-sm font-semibold text-violet-100 leading-snug">
              Generating your video as {STYLE_LABELS[generatingStyle] || generatingStyle}…
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {Object.entries(STYLE_LABELS).map(([key, label], i) => {
            const palette = CHIP_PALETTES[i % CHIP_PALETTES.length];
            const alreadyGenerated = session.variants?.some((v) => v.style === key);
            const isGenerating = generatingStyle === key;
            return (
              <button
                key={key}
                onClick={() => handleChipClick(key)}
                disabled={!!generatingStyle}
                className={`relative text-sm px-4 py-3 rounded-xl border-2 font-semibold text-center transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
                  alreadyGenerated ? palette.active : palette.idle
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {label}
                  </span>
                ) : (
                  <>
                    {label}
                    {alreadyGenerated && <CheckCircle2 className="w-3.5 h-3.5 absolute top-1.5 right-1.5" />}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {session.variants?.length > 0 && (
          <div className="mt-4 space-y-3">
            {session.variants.map((v) => (
              <div
                key={v.id}
                ref={(el) => { variantRefs.current[v.id] = el; }}
                className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm scroll-mt-4"
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-medium">{STYLE_LABELS[v.style] || v.style}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {hasVideoAvatar && v.videoStatus !== 'ready' && (
                      <button
                        onClick={() => handleGenerateVariantVideo(v.id)}
                        disabled={v.videoStatus === 'generating'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs transition shadow-lg shadow-emerald-400/20 disabled:opacity-60"
                      >
                        {v.videoStatus === 'generating' ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering…</>
                        ) : (
                          <><Film className="w-3.5 h-3.5" /> {v.videoStatus === 'failed' ? 'Retry Video' : 'Generate Video'}</>
                        )}
                      </button>
                    )}
                    {hasVoice && v.videoStatus !== 'ready' && (
                      dubbingVariantId === v.id ? (
                        <span className="text-white/50 flex items-center gap-1 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dubbing…
                        </span>
                      ) : (
                        // Optional and secondary on purpose: the synthetic
                        // video above is the primary path when available, so
                        // this fast-but-lower-fidelity option (real footage,
                        // swapped audio) is here for whoever wants it sooner
                        // rather than something that runs automatically.
                        <button
                          onClick={() => handleDubVariantVideo(v.id)}
                          className="text-white/50 hover:text-white flex items-center gap-1 text-xs"
                        >
                          <Mic2 className="w-3.5 h-3.5" /> Dub With My Voice
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setConfirmTarget({ type: 'variant', id: v.id })}
                      className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-400/15 border border-sky-400/40 text-sky-300 hover:bg-sky-400/25 hover:border-sky-400/70 transition"
                      title="Delete this version"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p>{v.text.rewrittenText}</p>
                <p className="text-white/40 text-xs mt-1 italic">{v.text.whatChanged}</p>
                {v.videoStatus === 'ready' && v.videoUrl ? (
                  // The real synthetic HeyGen render, once ready — the best
                  // available result. Keyed by URL so switching between
                  // branches (or to a newer file at the same branch) always
                  // mounts a fresh <video> element instead of React patching
                  // `src` on a reused node — the latter leaves the element's
                  // internal playback state stale, so the first click on
                  // play silently does nothing until a second click catches
                  // it up.
                  <video key={v.videoUrl} src={v.videoUrl} controls onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01; }} className="w-full mt-2 rounded-lg" />
                ) : v.dubVideoUrl ? (
                  // A dub is available (fast, ~seconds) — shown even while a
                  // higher-fidelity synthetic render is still cooking in the
                  // background, instead of leaving the unmodified original up.
                  <div className="mt-2">
                    <video key={v.dubVideoUrl} src={v.dubVideoUrl} controls onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01; }} className="w-full rounded-lg" />
                    {v.videoStatus === 'generating' ? (
                      <div className="flex items-start gap-2.5 border-2 border-amber-400/60 bg-amber-400/10 rounded-xl p-3 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300 shrink-0 mt-0.5" />
                        <p className="text-sm font-semibold text-amber-100 leading-snug">
                          Dubbed with your voice for now. A fully synthetic version of you saying this is still
                          rendering — HeyGen's pipeline usually takes 5–7 minutes and will swap in automatically
                          once ready, if you navigate away and come back.
                        </p>
                      </div>
                    ) : (
                      <p className="text-white/30 text-[11px] mt-1">
                        Dubbed with your voice over your original footage.
                        {hasVideoAvatar ? ' Use "Generate Video" above for a full synthetic recreation.' : ''}
                      </p>
                    )}
                  </div>
                ) : v.videoStatus === 'generating' ? (
                  // No dub to fall back on (e.g. voice-only path skipped) —
                  // a real loading state instead of the bare original video,
                  // with an explicit time expectation so it doesn't look stuck.
                  <div className="mt-2 flex flex-col items-center text-center py-8 bg-gradient-to-br from-emerald-400/10 via-sky-400/10 to-violet-400/10 border border-white/10 rounded-xl">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                    <p className="font-medium text-sm">Generating your synthetic video…</p>
                    <p className="text-xs text-white/50 mt-1 max-w-xs">
                      HeyGen's rendering pipeline usually takes 5–7 minutes. Feel free to navigate away — it'll be
                      ready when you come back.
                    </p>
                  </div>
                ) : session.videoUrl && (
                  <div className="mt-2">
                    <video
                      key={session.videoUrl}
                      src={session.videoUrl}
                      controls
                      onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.01; }}
                      className="w-full rounded-lg"
                    />
                    <p className="text-white/30 text-[11px] mt-1">
                      Placeholder — your original recording with the original audio, not this style.{' '}
                      {dubbingVariantId === v.id
                        ? 'Dubbing this with your voice now — it\'ll swap in automatically once ready.'
                        : v.videoStatus === 'failed'
                          ? 'The synthetic video render failed — click "Retry Video" above, or "Dub With My Voice" for a quicker alternative.'
                          : hasVideoAvatar
                            ? 'Click "Generate Video" above for a full synthetic recreation, or "Dub With My Voice" for a quicker version.'
                            : hasVoice
                              ? 'Click "Dub With My Voice" above to swap in narration of this style.'
                              : 'Clone your voice in My Twin to dub this footage with this style\'s narration.'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingStyleKey && !showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPendingStyleKey(null)} />
          <div className="relative bg-[#17171d] border border-emerald-400/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-emerald-400/15 flex items-center justify-center shrink-0">
                <Mic2 className="w-5 h-5 text-emerald-300" />
              </div>
              <button onClick={() => setPendingStyleKey(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {hasVoice ? (
              <div>
                <h3 className="font-semibold text-lg text-emerald-200">Use Your Cloned Voice For This?</h3>
                <p className="text-sm text-white/60 mt-1.5">
                  Generating "{STYLE_LABELS[pendingStyleKey] || pendingStyleKey}" will rewrite what you said using Claude, then
                  send that text to ElevenLabs to narrate it in your cloned voice{hasVideoAvatar ? ' and animate your video avatar' : ' (and dub your original video, if you use that option)'}.
                  This happens every time you generate a style unless you say otherwise here.
                </p>
                {videoAvatarConsentUrl && (
                  <div className="border-2 border-emerald-400/60 bg-emerald-400/10 rounded-xl p-4 mt-3 space-y-2.5">
                    <p className="text-sm font-semibold text-emerald-100 leading-snug">
                      Optional: Want the video itself to look like you're speaking this, instead of your voice dubbed
                      over the original footage?
                    </p>
                    <p className="text-xs text-white/50">
                      Complete a quick live webcam check on HeyGen's own page (a security step we can't do for you).
                    </p>
                    <button
                      onClick={() => openConsentWindow(videoAvatarConsentUrl, { onClosed: onVoiceCloned, checkStatus: api.getVideoAvatarStatus })}
                      className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs transition shadow-lg shadow-emerald-400/20"
                    >
                      Complete It Now →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-lg text-emerald-200">Want This In Your Own Voice?</h3>
                <p className="text-sm text-white/60 mt-1.5">
                  Generating "{STYLE_LABELS[pendingStyleKey] || pendingStyleKey}" will rewrite what you said using Claude.
                  You haven't cloned your voice yet, so this will be text only — clone it once in My Twin to also hear it
                  narrated and dub your video.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingStyleKey(null)} className="px-4 py-2 rounded-lg border border-white/15 hover:border-white/30 text-sm transition">
                Cancel
              </button>
              {!hasVoice && (
                <button
                  onClick={() => setShowCloneModal(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-sm transition"
                >
                  Clone My Voice
                </button>
              )}
              <button
                onClick={handleConsentAndGenerate}
                className={
                  hasVoice
                    ? 'px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-sm transition'
                    : 'px-4 py-2 rounded-lg border border-white/15 hover:border-white/30 text-white/60 text-sm font-normal transition'
                }
              >
                {hasVoice ? 'I Consent — Generate' : 'Generate Text Only'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CloneVoiceModal
        open={showCloneModal}
        styleLabel={STYLE_LABELS[pendingStyleKey] || pendingStyleKey}
        onClose={() => { setShowCloneModal(false); setPendingStyleKey(null); }}
        onCloned={onVoiceCloned}
        onGenerate={() => {
          setShowCloneModal(false);
          localStorage.setItem(VOICE_CONSENT_KEY, 'true');
          const styleKey = pendingStyleKey;
          setPendingStyleKey(null);
          handleGenerateVariant(styleKey, { voiceOverride: true });
        }}
      />

      <ConfirmModal
        open={!!confirmTarget}
        title={confirmTarget?.type === 'session' ? 'Delete This Recording?' : 'Delete This Version?'}
        message={
          confirmTarget?.type === 'session'
            ? 'This permanently deletes this recording and its analysis.'
            : 'This permanently deletes this generated version and any video attached to it.'
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
