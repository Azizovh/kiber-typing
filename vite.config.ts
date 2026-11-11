import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base + HashRouter means the build works on any static host
// (GitHub Pages project sites, Netlify, a plain folder) without rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
