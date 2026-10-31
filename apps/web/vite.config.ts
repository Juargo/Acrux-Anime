import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// SPA served as static files on Vercel; /api goes to the Express function (ADR-0020).
// Locally, /api is proxied to the API dev server (pnpm --filter @acrux/api dev).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
