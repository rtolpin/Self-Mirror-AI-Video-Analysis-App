import { useEffect, useState } from 'react';
import { Video, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import SessionDetail from './SessionDetail.jsx';
import EmptyState from './EmptyState.jsx';
import LoadingState from './LoadingState.jsx';

// Tailwind needs full literal class names, so each row's accent is spelled
// out and cycled through by index for visual variety across the list.
const ROW_PALETTES = [
  { badge: 'bg-sky-400/15 text-sky-300', ring: 'hover:border-sky-400/40' },
  { badge: 'bg-violet-400/15 text-violet-300', ring: 'hover:border-violet-400/40' },
  { badge: 'bg-rose-400/15 text-rose-300', ring: 'hover:border-rose-400/40' },
  { badge: 'bg-amber-400/15 text-amber-300', ring: 'hover:border-amber-400/40' },
  { badge: 'bg-teal-400/15 text-teal-300', ring: 'hover:border-teal-400/40' },
  { badge: 'bg-fuchsia-400/15 text-fuchsia-300', ring: 'hover:border-fuchsia-400/40' },
];

function formatDate(iso) {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${time}`;
}

export default function History({ hasVoice, hasVideoAvatar, videoAvatarConsentUrl, onStartSession, onVoiceCloned }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (selectedId) {
    return (
      <div>
        <button onClick={() => { setSelectedId(null); refresh(); }} className="text-sm text-white/50 hover:text-white mb-4">
          ← Back To History
        </button>
        <SessionDetail
          sessionId={selectedId}
          hasVoice={hasVoice}
          hasVideoAvatar={hasVideoAvatar}
          videoAvatarConsentUrl={videoAvatarConsentUrl}
          onDeleted={() => { setSelectedId(null); refresh(); }}
          onVoiceCloned={onVoiceCloned}
        />
      </div>
    );
  }

  if (loading) return <LoadingState />;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!sessions.length) {
    return (
      <EmptyState
        description="Your recorded sessions and their AI analysis will show up here. Record your first one to get started."
        onGoToRecord={onStartSession}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {sessions.map((s, i) => {
        const palette = ROW_PALETTES[i % ROW_PALETTES.length];
        return (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={`w-full text-left p-4 rounded-xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:shadow-lg hover:bg-white/[0.06] flex items-center gap-3.5 ${palette.ring}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${palette.badge}`}>
              <Video className="w-[18px] h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.context}</div>
              <div className="text-xs text-white/40">{formatDate(s.createdAt)}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
