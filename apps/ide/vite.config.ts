import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

// Teach Vite how to handle Monaco editor web workers so they resolve from
// the locally installed monaco-editor package rather than a CDN request.
function monacoWorkerPlugin() {
  return {
    name: "monaco-worker-resolver",
    resolveId(id: string) {
      if (id.startsWith("monaco-editor/esm/vs/") && id.endsWith(".worker")) {
        return { id, external: false };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    monacoWorkerPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // use public/manifest.webmanifest
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@emptysock/types": resolve(
        __dirname,
        "../../packages/types/src/index.ts",
      ),
      "@emptysock/engine": resolve(
        __dirname,
        "../../packages/engine/src/index.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      "@dimforge/rapier2d-compat",
      "@dimforge/rapier3d-compat",
      "monaco-editor",
    ],
  },
  server: {
    port: 5173,
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    target: "esnext",
  },
});
