import { useEffect, useState } from 'react';
import { ChevronDown, History as HistoryIcon } from 'lucide-react';
import { api } from '../api.js';

export default function RecentRecordings({ onSelect }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.listSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || !sessions.length) return null;

  const recent = sessions.slice(0, 5);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/70 hover:text-white transition"
      >
        <span className="flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-sky-400" />
          Recent Recordings <span className="text-white/40">({sessions.length})</span>
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {recent.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center justify-between gap-3"
            >
              <span className="text-sm truncate">{s.context}</span>
              <span className="text-xs text-white/40 shrink-0">{new Date(s.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
