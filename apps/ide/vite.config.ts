import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = import.meta.dirname;

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
    visualizer({ open: false, filename: "stats.html", gzipSize: true }),
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
      "@": resolve(__dirname, "src"),
    },
  },
  worker: {
    format: "es" as const,
  },
  esbuild: {
    target: "es2022",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "zustand", "rc-dock"],
    exclude: [
      "@dimforge/rapier2d-compat",
      "@dimforge/rapier3d-compat",
      "monaco-editor",
      "@tauri-apps/api",
      "@tauri-apps/api/window",
      "@tauri-apps/api/core",
    ],
  },
  server: {
    port: 5173,
    host: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    warmup: {
      clientFiles: ["./src/App.tsx", "./src/store/ideStore.ts"],
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("monaco-editor")) return "monaco";
          if (id.includes("pixi.js") || id.includes("@pixi/")) return "pixi";
          if (id.includes("rapier")) return "rapier";
          if (id.includes("esbuild-wasm")) return "esbuild";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
