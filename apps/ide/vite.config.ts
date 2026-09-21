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
//
// The bundled Monaco TypeScript worker (monaco-editor@0.56) only supports
// ModuleResolutionKind.Classic | NodeJs and cannot resolve the bare specifier
// "@emptysock/engine" from a pile of file:///node_modules/@emptysock/engine/**
// extra libs alone — it reports TS2792 on the import line, which then makes
// every inherited method on Scene/Entity/etc. report as "Property does not
// exist" (see RELEASE_PASS.md). Per-relative-file resolution and a synthetic
// package.json extra lib were both tried and did not clear TS2792.
//
// The fix: flatten dist-types into a single ambient module block —
// `declare module "@emptysock/engine" { ... }` — fed to addExtraLib. Ambient
// module declarations for a bare specifier are looked up by name directly,
// bypassing module resolution entirely. Internal relative imports between
// engine source files are rewritten to synthetic ambient module names
// (`@emptysock/engine/__internal/<path>`) so nothing inside the block needs
// further resolution either.
function engineTypesPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:engine-types";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;
  const INTERNAL_PREFIX = "@emptysock/engine/__internal/";

  // Relative specifiers inside dist-types, e.g. `from "./core/Component.js"`
  // or `import("../systems/RenderSystem.js")`. Captures the quote char so it
  // can rewrite the exact original text (including quotes).
  const RELATIVE_SPECIFIER_RE = /(from\s+|import\()(['"])(\.[^'"]+)\2/g;

  function posixJoin(...parts: string[]): string {
    const joined = parts.join("/");
    const segs: string[] = [];
    for (const seg of joined.split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") segs.pop();
      else segs.push(seg);
    }
    return segs.join("/");
  }

  function dirnameOf(key: string): string {
    const idx = key.lastIndexOf("/");
    return idx === -1 ? "" : key.slice(0, idx);
  }

  // Turns dist-types into a map of "module key" (relative path, no
  // extension, e.g. "core/Component" or "index") -> raw .d.ts source.
  function collectModuleSources(dir: string): Record<string, string> {
    const sources: Record<string, string> = {};
    if (!existsSync(dir)) return sources;
    function scan(d: string): void {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
        } else if (entry.endsWith(".d.ts")) {
          const rel = relative(dir, full).replace(/\\/g, "/");
          const key = rel.replace(/\.d\.ts$/, "");
          sources[key] = readFileSync(full, "utf-8");
        }
      }
    }
    scan(dir);
    return sources;
  }

  // Builds the single ambient-module-block string for @emptysock/engine.
  function buildAmbientEngineModule(dir: string): string {
    const sources = collectModuleSources(dir);
    const parts: string[] = [];

    for (const [key, content] of Object.entries(sources)) {
      const rewritten = content.replace(
        RELATIVE_SPECIFIER_RE,
        (_match, prefix: string, quote: string, specifier: string) => {
          const withoutJs = specifier.replace(/\.js$/, "");
          const resolved = posixJoin(dirnameOf(key), withoutJs);
          return `${prefix}${quote}${INTERNAL_PREFIX}${resolved}${quote}`;
        },
      );
      parts.push(
        `declare module "${INTERNAL_PREFIX}${key}" {\n${rewritten}\n}`,
      );
    }

    // The public surface is whatever index.d.ts re-exports, now resolvable
    // purely by ambient module name (no file-based resolution involved).
    parts.push(
      `declare module "@emptysock/engine" {\n` +
        `  export * from "${INTERNAL_PREFIX}index";\n` +
        `}`,
    );

    return parts.join("\n\n");
  }

  return {
    name: "engine-types",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const dtDir = resolve(__dirname, "../../packages/engine/dist-types");
      const libs: Record<string, string> = {
        "file:///node_modules/@emptysock/engine/__ambient__.d.ts":
          buildAmbientEngineModule(dtDir),
      };
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
