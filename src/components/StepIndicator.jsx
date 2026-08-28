import { Check, Pencil } from 'lucide-react';

const STEPS = [
  { n: 1, lines: ['Choose', 'Occasion'] },
  { n: 2, lines: ['Record', '& Save'] },
];

export default function StepIndicator({ current, onStepClick }) {
  return (
    // Spans the full content column so step 1 and step 2 line up with the
    // same left/right edges as the heading and search box below it.
    <div className="w-full flex items-start justify-between">
      {STEPS.map((step, i) => {
        // "Active" (not just "already completed") so the connector reads as
        // forward momentum from the moment you land on step 1, rather than
        // sitting gray until step 2 is reached.
        const active = current >= step.n;
        const revisitable = step.n < current && onStepClick;
        const Wrapper = revisitable ? 'button' : 'div';
        return (
          <div key={step.n} className={`flex items-start ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <Wrapper
              onClick={revisitable ? () => onStepClick(step.n) : undefined}
              title={revisitable ? 'Go back and change this' : undefined}
              className={`relative flex flex-col items-center gap-2 w-24 shrink-0 ${revisitable ? 'group' : ''}`}
            >
              <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 transition ${
                  step.n < current
                    ? `bg-emerald-400 border-emerald-400 text-black ${revisitable ? 'group-hover:bg-emerald-300 group-hover:border-emerald-300' : ''}`
                    : step.n === current
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10 shadow-lg shadow-emerald-400/20'
                    : 'border-white/15 text-white/30'
                }`}
              >
                {step.n < current ? <Check className="w-5 h-5 group-hover:opacity-0 transition" /> : step.n}
                {revisitable && (
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Pencil className="w-4 h-4" />
                  </span>
                )}
              </div>
              <span
                className={`text-sm font-medium text-center leading-tight ${
                  step.n === current ? 'text-white' : revisitable ? 'text-white/40 group-hover:text-white/70' : 'text-white/40'
                }`}
              >
                {step.lines.map((line) => (
                  <span key={line} className="block">{line}</span>
                ))}
              </span>
              {revisitable && (
                <span className="text-[10px] font-medium text-emerald-400/80 -mt-1">Tap to edit</span>
              )}
            </Wrapper>
            {i < STEPS.length - 1 && (
              <div className="flex-1 flex items-center mx-2 mt-[22px]">
                <div
                  className={`flex-1 h-1.5 rounded-l-full transition ${
                    active ? 'bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400' : 'bg-white/10'
                  }`}
                />
                <div
                  className="w-0 h-0 shrink-0 transition"
                  style={{
                    borderTop: '7px solid transparent',
                    borderBottom: '7px solid transparent',
                    borderLeft: `11px solid ${active ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
