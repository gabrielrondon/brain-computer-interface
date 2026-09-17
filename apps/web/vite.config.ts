import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cortex-bci/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@cortex-bci/simulator': path.resolve(__dirname, '../../packages/simulator/src/index.ts'),
      '@cortex-bci/hardware': path.resolve(__dirname, '../../packages/hardware/src/index.ts'),
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
