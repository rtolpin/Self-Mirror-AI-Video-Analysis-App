import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3101',
      // Recorded video/photo/audio files are served from here by the
      // backend. Without this, <video src="/uploads/..."> resolves against
      // Vite's own dev server (which knows nothing about it) instead of the
      // backend, and playback just hangs with no visible error.
      '/uploads': 'http://localhost:3101',
    },
  },
});
