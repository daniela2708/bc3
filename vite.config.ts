/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * index.html ships a strict Content-Security-Policy. The dev server needs inline
 * scripts/styles (React Refresh, injected CSS) and a websocket for HMR, so only
 * while serving locally the policy is relaxed. Production builds keep it as written.
 */
function devCsp(): Plugin {
  return {
    name: 'dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws: wss:");
    },
  };
}

/**
 * The demo access gate reads one build-time value: the salted hash of the password. Vite only exposes variables
 * prefixed VITE_, but the hosting dashboard may hold it as ACCESS_PASSWORD_HASH, so both names are accepted.
 * Only this single value reaches the bundle (it is public by design); no other variable is exposed.
 */
function accessHash(mode: string): string {
  const env = loadEnv(mode, '.', '');
  const raw = env.VITE_ACCESS_PASSWORD_HASH || env.ACCESS_PASSWORD_HASH || '';
  return /^[0-9a-fA-F]{64}$/.test(raw.trim()) ? raw.trim().toLowerCase() : '';
}

export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_ACCESS_PASSWORD_HASH': JSON.stringify(accessHash(mode)),
  },
  plugins: [react(), devCsp()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
