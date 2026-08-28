import { useMemo, useRef, useState } from 'react';
import { Search, Sparkles, Heart, PartyPopper, Video, Building2, Mic2, Users, Check } from 'lucide-react';

const GENERAL_OPTION = 'General Self-Analysis (No Specific Occasion)';

const SUGGESTIONS = [
  GENERAL_OPTION,
  'A Date',
  'A Social Event Or Party',
  'A Job Interview (Video Call)',
  'A Job Interview (In Person)',
  'A Public Speaking Event Or Presentation',
  'A Networking Event',
  'A Sales Pitch Or Client Meeting',
  'A Performance Review Or 1:1 With My Manager',
  'Meeting New Coworkers For The First Time',
  'A Podcast Or Video Appearance',
];

// A short, always-visible subset for one-tap picking, separate from the
// full searchable list in the dropdown. General analysis has its own
// dedicated "skip" entry point in App.jsx, so it's left out here.
const CHIP_ITEMS = [
  { label: 'A Date', icon: Heart, palette: 'rose' },
  { label: 'A Social Event Or Party', icon: PartyPopper, palette: 'violet' },
  { label: 'A Job Interview (Video Call)', icon: Video, palette: 'sky' },
  { label: 'A Job Interview (In Person)', icon: Building2, palette: 'amber' },
  { label: 'A Public Speaking Event Or Presentation', icon: Mic2, palette: 'teal' },
  { label: 'A Networking Event', icon: Users, palette: 'fuchsia' },
];

// Tailwind needs full literal class names to pick them up, so each palette
// is spelled out rather than built from an interpolated color name.
const PALETTES = {
  rose: { idle: 'border-rose-400/40 bg-rose-400/10 hover:border-rose-400/70 hover:bg-rose-400/20', active: 'border-rose-400 bg-rose-400/20', iconBg: 'bg-rose-400/25', iconText: 'text-rose-300' },
  violet: { idle: 'border-violet-400/40 bg-violet-400/10 hover:border-violet-400/70 hover:bg-violet-400/20', active: 'border-violet-400 bg-violet-400/20', iconBg: 'bg-violet-400/25', iconText: 'text-violet-300' },
  sky: { idle: 'border-sky-400/40 bg-sky-400/10 hover:border-sky-400/70 hover:bg-sky-400/20', active: 'border-sky-400 bg-sky-400/20', iconBg: 'bg-sky-400/25', iconText: 'text-sky-300' },
  amber: { idle: 'border-amber-400/40 bg-amber-400/10 hover:border-amber-400/70 hover:bg-amber-400/20', active: 'border-amber-400 bg-amber-400/20', iconBg: 'bg-amber-400/25', iconText: 'text-amber-300' },
  teal: { idle: 'border-teal-400/40 bg-teal-400/10 hover:border-teal-400/70 hover:bg-teal-400/20', active: 'border-teal-400 bg-teal-400/20', iconBg: 'bg-teal-400/25', iconText: 'text-teal-300' },
  fuchsia: { idle: 'border-fuchsia-400/40 bg-fuchsia-400/10 hover:border-fuchsia-400/70 hover:bg-fuchsia-400/20', active: 'border-fuchsia-400 bg-fuchsia-400/20', iconBg: 'bg-fuchsia-400/25', iconText: 'text-fuchsia-300' },
};

export default function ReasonInput({ value, onChange, onSubmit }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return SUGGESTIONS;
    const starts = SUGGESTIONS.filter((s) => s.toLowerCase().startsWith(q));
    const includes = SUGGESTIONS.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...starts, ...includes];
  }, [value]);

  function selectSuggestion(s) {
    onChange(s);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      setOpen(false);
      onSubmit?.();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="Search Or Type What You're Preparing For…"
          className="w-full bg-white/5 border border-white/15 focus:border-emerald-400 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition"
        />
      </div>

      {open && (
        <div className="absolute z-10 mt-2 w-full bg-[#17171d] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {value.trim() && !SUGGESTIONS.some((s) => s.toLowerCase() === value.trim().toLowerCase()) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(value.trim())}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex items-center gap-2 border-b border-white/5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Use "<span className="font-medium">{value.trim()}</span>"
            </button>
          )}
          {filtered.map((s) => (
            <button
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 ${s === GENERAL_OPTION ? 'text-emerald-400' : ''}`}
            >
              {s}
            </button>
          ))}
          {!filtered.length && !value.trim() && (
            <p className="px-4 py-3 text-sm text-white/40">Start Typing To Search…</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {CHIP_ITEMS.map(({ label, icon: Icon, palette: paletteKey }) => {
          const palette = PALETTES[paletteKey];
          const selected = value === label;
          return (
            <button
              key={label}
              onClick={() => selectSuggestion(label)}
              className={`group flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] ${
                selected ? palette.active : palette.idle
              }`}
            >
              <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${palette.iconBg}`}>
                <Icon className={`w-[18px] h-[18px] ${palette.iconText}`} />
              </span>
              <span className="text-sm font-medium leading-snug flex-1">{label}</span>
              {selected && <Check className="w-4 h-4 text-white shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { GENERAL_OPTION };
