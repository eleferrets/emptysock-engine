/**
 * Bundles @emptysock/engine's public API as a self-contained IIFE that sets
 * window.EmptySockEngine = { ...engine exports }. This is the one surface
 * user game code and the live preview/Inspector bridge see at runtime.
 * There is only one export surface — the pre-ECS classic engine
 * (`core/`/`systems/`/`components/`/`ui/`) was deleted once every real
 * consumer was migrated (RELEASE_PASS.md Track 9), so there is no longer a
 * colliding second surface to avoid bundling.
 *
 * Output: src/runtime/engineBundle.generated.ts
 * Run automatically via the predev / prebuild npm scripts.
 *
 * Pass --minify or set NODE_ENV=production for a minified, smaller bundle.
 * Minification reduces iframe startup time at the cost of a longer build step.
 */

import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProd =
  process.argv.includes("--minify") || process.env.NODE_ENV === "production";

const engineEntry = resolve(__dirname, "../../packages/engine/src/index.ts");
const outDir = resolve(__dirname, "src/runtime");
const outFile = resolve(outDir, "engineBundle.generated.ts");

console.log(
  `[engine-runtime] Bundling engine API as IIFE${isProd ? " (minified)" : ""}...`,
);

const result = await build({
  configFile: false,
  logLevel: "warn",
  esbuild: {
    target: "es2022",
    tsconfigRaw: "{}",
  },
  resolve: {
    alias: {
      "@emptysock/engine": engineEntry,
    },
  },
  optimizeDeps: {
    exclude: ["@dimforge/rapier2d-compat"],
  },
  build: {
    target: "es2022",
    write: false,
    minify: isProd,
    lib: {
      entry: engineEntry,
      name: "EmptySockEngine",
      formats: ["iife"],
      fileName: () => "engine.iife.js",
    },
    rollupOptions: {
      // The deterministic-compat builds are optionalDependencies (most games
      // never install them — CLAUDE.md's "Deterministic Rapier build is
      // imported via a non-literal specifier") and are not installed here;
      // externalizing them keeps the bundler from resolving both branches of
      // PhysicsSystem's runtime `moduleName` ternary at build time.
      external: [
        "@dimforge/rapier2d-compat",
        "@dimforge/rapier2d-deterministic-compat",
        "@dimforge/rapier3d-compat",
        "@dimforge/rapier3d-deterministic-compat",
        /^@tauri-apps\//,
      ],
      output: {
        name: "EmptySockEngine",
        globals: {
          "@dimforge/rapier2d-compat": "RAPIER2D",
          "@dimforge/rapier2d-deterministic-compat": "RAPIER2D",
          "@dimforge/rapier3d-compat": "RAPIER3D",
          "@dimforge/rapier3d-deterministic-compat": "RAPIER3D",
        },
      },
    },
  },
});

const output = Array.isArray(result) ? result[0] : result;
const chunk = output.output.find((c) => c.type === "chunk" && c.isEntry);
if (!chunk || chunk.type !== "chunk") {
  console.error("[engine-runtime] No entry chunk found in build output");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

writeFileSync(
  outFile,
  `// AUTO-GENERATED — do not edit. Run \`pnpm engine-runtime\` to regenerate.\n` +
    `// eslint-disable\n` +
    `export const ENGINE_BUNDLE: string = ${JSON.stringify(chunk.code)};\n`,
  "utf-8",
);

console.log(
  `[engine-runtime] Written to ${outFile} (${(chunk.code.length / 1024).toFixed(1)} KB)`,
);
