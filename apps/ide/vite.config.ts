import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@emptysock/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@emptysock/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d-compat'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
