import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-white/40">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
