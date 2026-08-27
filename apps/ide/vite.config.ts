import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // use public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@emptysock/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@emptysock/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d-compat', '@dimforge/rapier3d-compat'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
