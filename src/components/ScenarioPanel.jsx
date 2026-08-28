import { useEffect, useState } from 'react';
import { Send, Loader2, MessageCircleQuestion, Sparkles, Gauge } from 'lucide-react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';

function confidencePalette(level) {
  const l = (level || '').toLowerCase();
  if (l === 'high') return 'border-emerald-400 text-emerald-300 bg-emerald-400/10';
  if (l === 'low') return 'border-rose-400 text-rose-300 bg-rose-400/10';
  return 'border-amber-400 text-amber-300 bg-amber-400/10';
}

export default function ScenarioPanel({ hasTwin, buildingTwin, onStartSession }) {
  const [scenario, setScenario] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listScenarios().then(setHistory);
  }, []);

  async function handleSubmit() {
    if (!scenario.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const prediction = await api.predictScenario(scenario);
      setHistory((prev) => [{ scenario, prediction, createdAt: new Date().toISOString() }, ...prev]);
      setScenario('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!hasTwin) {
    if (buildingTwin) {
      return (
        <div className="flex flex-col items-center text-center py-14 px-6">
          <Loader2 className="w-8 h-8 animate-spin text-rose-400 mb-4" />
          <p className="text-lg font-semibold mb-1.5">Building Your Twin…</p>
          <p className="text-sm text-white/50 max-w-xs">
            Analyzing your recorded sessions — this unlocks automatically once it's ready, no need to refresh.
          </p>
        </div>
      );
    }
    return (
      <EmptyState
        description="Predictions are grounded in your AI Twin's profile. Record a session and build your twin first to unlock this."
        onGoToRecord={onStartSession}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-fuchsia-400 flex items-center justify-center shrink-0">
          <MessageCircleQuestion className="w-4 h-4 text-black" />
        </div>
        <h3 className="text-lg font-bold bg-gradient-to-r from-rose-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
          Ask My Twin
        </h3>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 space-y-3">
        <label className="text-sm font-medium text-white/80 block">Describe a current or future situation</label>
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 focus:border-rose-400/60 rounded-lg p-3 text-sm outline-none transition"
          placeholder="e.g. My manager just asked me to lead a project I don't feel ready for."
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !scenario.trim()}
          className="text-sm bg-rose-400 hover:bg-rose-300 disabled:bg-white/10 disabled:text-white/30 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg shadow-rose-400/20 disabled:shadow-none transition"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Predict My Reaction
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {history.map((h, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 space-y-3">
            <p className="text-white/50 text-sm italic">"{h.scenario}"</p>
            <div className="border-2 border-violet-400/50 bg-violet-400/10 rounded-xl pl-4 pr-3 py-3 flex gap-2.5">
              <Sparkles className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" />
              <p className="text-base font-medium text-violet-50 leading-relaxed">{h.prediction.predictedReaction}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${confidencePalette(h.prediction.confidenceInPrediction)}`}>
                <Gauge className="w-3 h-3" /> {h.prediction.confidenceInPrediction} confidence
              </span>
              <span className="text-white/50 text-sm">{h.prediction.reasoning}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
