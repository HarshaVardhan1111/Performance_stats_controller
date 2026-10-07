import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the same build work on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
