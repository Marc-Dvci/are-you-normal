import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/** Local preview of the client against dev/server.ts. The Devvit build does not use it. */
export default defineConfig({
  root: here('../src/client'),
  plugins: [react()],
  resolve: {
    alias: { '@devvit/web/client': here('./devvit-client.ts') },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
