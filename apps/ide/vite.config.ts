import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve, relative, join } from "path";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin } from "vite";

const __dirname = import.meta.dirname;

// Collects all .d.ts files from dist-types/ and exposes them as virtual:engine-types
// so Monaco's TypeScript service can provide inline type errors for game code.
function engineTypesPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:engine-types";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;

  function collectDts(dir: string): Record<string, string> {
    const libs: Record<string, string> = {};
    if (!existsSync(dir)) return libs;
    function scan(d: string): void {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
        } else if (entry.endsWith(".d.ts")) {
          const rel = relative(dir, full).replace(/\\/g, "/");
          libs[`file:///node_modules/@emptysock/engine/${rel}`] = readFileSync(
            full,
            "utf-8",
          );
        }
      }
    }
    scan(dir);
    return libs;
  }

  return {
    name: "engine-types",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const dtDir = resolve(__dirname, "../../packages/engine/dist-types");
      const libs = collectDts(dtDir);
      const builtinsPath = resolve(
        __dirname,
        "../../packages/engine/src/builtins.d.ts",
      );
      if (existsSync(builtinsPath)) {
        libs["file:///game/builtins.d.ts"] = readFileSync(
          builtinsPath,
          "utf-8",
        );
      }
      return `export default ${JSON.stringify(libs)}`;
    },
  };
}

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
    engineTypesPlugin(),
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
