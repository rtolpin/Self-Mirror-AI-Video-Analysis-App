import { PlusCircle, Sparkles } from 'lucide-react';

export default function EmptyState({ title = 'Nothing Here Yet', description, ctaLabel = 'Start Your First Session', onGoToRecord }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </div>
      <p className="text-lg font-semibold mb-1.5">{title}</p>
      {description && <p className="text-sm text-white/50 max-w-xs mb-5">{description}</p>}
      <button
        onClick={onGoToRecord}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-semibold shadow-lg shadow-emerald-400/20 transition"
      >
        <PlusCircle className="w-4 h-4" /> {ctaLabel}
      </button>
    </div>
  );
}
