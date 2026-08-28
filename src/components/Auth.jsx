import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { api } from '../api.js';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = mode === 'signup' ? await api.signup(email, password) : await api.login(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);
    try {
      const { user } = await api.continueAsGuest();
      onAuthed(user);
    } catch (err) {
      setError(err.message);
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* No video asset to embed here, so this animated gradient stands in
          for a "living" background — slow-drifting blurred color fields
          rather than a static page. */}
      <style>{`
        @keyframes authBlob1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(60px, -40px) scale(1.15); } 66% { transform: translate(-40px, 30px) scale(0.9); } }
        @keyframes authBlob2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-70px, 40px) scale(1.1); } 66% { transform: translate(40px, -50px) scale(0.95); } }
        @keyframes authBlob3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, 50px) scale(1.2); } }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] bg-emerald-400/25 rounded-full blur-[130px]" style={{ animation: 'authBlob1 16s ease-in-out infinite' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-400/25 rounded-full blur-[140px]" style={{ animation: 'authBlob2 18s ease-in-out infinite' }} />
        <div className="absolute top-[25%] right-[10%] w-[420px] h-[420px] bg-sky-400/20 rounded-full blur-[120px]" style={{ animation: 'authBlob3 13s ease-in-out infinite' }} />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Sparkles className="w-6 h-6 text-emerald-400" />
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 bg-clip-text text-transparent">
            Self-Mirror
          </span>
        </div>
        <p className="text-center text-sm text-white/50">
          Record yourself, get honest AI feedback, and see yourself in different styles.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 bg-gradient-to-br from-emerald-400/[0.07] via-sky-400/[0.05] to-violet-400/[0.07] border-2 border-sky-400/30 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-1 bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </h2>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400/60"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400/60"
            />
            {mode === 'signup' && <p className="text-[11px] text-white/30 mt-1">At least 8 characters.</p>}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 hover:brightness-110 disabled:opacity-50 text-black font-bold flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-400/20"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }}
            className="w-full text-center text-xs text-white/40 hover:text-white pt-1"
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-white/30">
          <div className="flex-1 h-px bg-white/10" /> Or <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          onClick={handleGuest}
          disabled={guestLoading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 hover:brightness-110 disabled:opacity-50 text-black font-bold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-400/25"
        >
          {guestLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          Try It As A Guest — No Account Needed
        </button>
        <p className="text-center text-[11px] text-white/30 -mt-2">
          Guest sessions are temporary and get cleaned up after a day — create an account any time to keep what you make.
        </p>
      </div>
    </div>
  );
}
