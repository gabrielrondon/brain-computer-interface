import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@cortex-bci/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@cortex-bci/simulator': fileURLToPath(new URL('../../packages/simulator/src/index.ts', import.meta.url)),
      '@cortex-bci/hardware': fileURLToPath(new URL('../../packages/hardware/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
});
