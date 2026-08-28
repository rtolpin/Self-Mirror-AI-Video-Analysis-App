import { useEffect, useState } from 'react';
import { Sparkles, Loader2, Info } from 'lucide-react';
import { api } from '../api.js';
import EmptyState from './EmptyState.jsx';

export default function LifePathsPanel({ hasTwin, buildingTwin, onStartSession }) {
  const [paths, setPaths] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLifePaths().then(setPaths);
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      setPaths(await api.generateLifePaths());
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
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-4" />
          <p className="text-lg font-semibold mb-1.5">Building Your Twin…</p>
          <p className="text-sm text-white/50 max-w-xs">
            Analyzing your recorded sessions — this unlocks automatically once it's ready, no need to refresh.
          </p>
        </div>
      );
    }
    return (
      <EmptyState
        description="Life path suggestions are built from your AI Twin's profile. Record a session and build your twin first to unlock this."
        onGoToRecord={onStartSession}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="text-base font-bold bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 hover:brightness-110 text-black px-6 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 transition shadow-lg shadow-amber-400/20"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {paths ? 'Regenerate' : 'Discover My Potential Paths'}
      </button>
      <div className="flex items-start gap-2.5 border-2 border-sky-400/50 bg-sky-400/10 rounded-xl px-3.5 py-2.5 max-w-md">
        <Info className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-sky-100 leading-snug">
          Suggested professions, cities, and activities based on your AI Twin's personality profile — a set of
          possibilities to consider, not a single "right" answer.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {paths && (
        <div className="space-y-5">
          <div className="border-2 border-amber-400/50 bg-amber-400/10 rounded-xl pl-4 pr-3 py-3 flex gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-base font-medium text-amber-50 leading-relaxed">{paths.overallNarrative}</p>
          </div>
          <PathList title="Professions" items={paths.suggestedProfessions} field="title" color="sky" />
          <PathList title="Cities" items={paths.suggestedCities} field="city" color="violet" />
          <PathList title="Activities" items={paths.suggestedActivities} field="activity" color="emerald" />
        </div>
      )}
    </div>
  );
}

const PATH_COLORS = {
  sky: { text: 'text-sky-300', border: 'border-sky-400/40', bg: 'bg-sky-400/10' },
  violet: { text: 'text-violet-300', border: 'border-violet-400/40', bg: 'bg-violet-400/10' },
  emerald: { text: 'text-emerald-300', border: 'border-emerald-400/40', bg: 'bg-emerald-400/10' },
};

function PathList({ title, items, field, color }) {
  if (!items?.length) return null;
  const c = PATH_COLORS[color] || PATH_COLORS.sky;
  return (
    <div>
      <h4 className={`text-sm font-bold mb-2 ${c.text}`}>{title}</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className={`border-2 ${c.border} ${c.bg} rounded-lg p-3.5`}>
            <p className="font-semibold text-base">{item[field]}</p>
            <p className="text-white/70 text-sm mt-1 leading-relaxed">{item.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
