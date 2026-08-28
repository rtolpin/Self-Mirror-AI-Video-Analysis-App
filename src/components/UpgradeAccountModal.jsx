import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../api.js';

// Turns a guest session into a real account in place (same user_id), so
// everything already recorded under it is preserved — see
// server/routes/auth.js POST /upgrade.
export default function UpgradeAccountModal({ open, onClose, onUpgraded }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api.upgradeAccount(email, password);
      onUpgraded(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-3 bg-gradient-to-br from-emerald-400/[0.07] via-sky-400/[0.05] to-violet-400/[0.07] border-2 border-sky-400/30 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-bold text-lg bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
            Save Your Account
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-white/50">
          Everything you've made stays exactly as it is — this just adds a login so it doesn't get cleaned up with
          other guest sessions.
        </p>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400/60"
          />
          <p className="text-[11px] text-white/30 mt-1">At least 8 characters.</p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 hover:brightness-110 disabled:opacity-50 text-black font-bold flex items-center justify-center gap-2 mt-1 shadow-lg shadow-emerald-400/20"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Account
        </button>
      </form>
    </div>
  );
}
