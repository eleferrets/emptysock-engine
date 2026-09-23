/**
 * copy-rapier-vendor.mjs — copies the real, self-contained ESM entry points
 * of @dimforge/rapier2d-compat and @dimforge/rapier3d-compat (dist/rapier.mjs,
 * WASM inlined as base64 — see CLAUDE.md's "Deterministic Rapier build is
 * imported via a non-literal specifier") into public/vendor/rapier/ so they
 * are served as ordinary static assets by both the Vite dev server and any
 * static production host.
 *
 * This exists to give the preview iframe's import map (PlayRunner.ts) a real
 * URL to resolve the bare specifiers "@dimforge/rapier2d-compat" and
 * "@dimforge/rapier3d-compat" against. `PhysicsSystem.init()`'s
 * `await import(moduleName)` uses a *runtime string*, not a literal, so no
 * bundler (Vite/Rollup/esbuild) can rewrite it at build time — only a
 * browser-native <script type="importmap"> resolves a bare specifier a
 * dynamic import() sees at runtime, and the import map needs a real URL to
 * point at, hence this copy step.
 *
 * Only the two always-installed compat packages are vendored — the
 * `-deterministic-compat` variants are optionalDependencies most games never
 * install (see engine's CLAUDE.md), so there is nothing to copy for them;
 * the IDE simply has no import-map entry for those specifiers, matching
 * "most games never pay for it."
 *
 * Run automatically via the predev / prebuild npm scripts, same as
 * copy-docs.mjs.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/vendor/rapier");

// Resolve relative to packages/engine (the actual dependent of these
// packages — apps/ide itself does not declare them) rather than this
// script's own module scope, since pnpm's workspace layout does not
// necessarily hoist @dimforge/* into apps/ide's own resolution path.
const engineDir = path.resolve(__dirname, "../../../packages/engine");
const require = createRequire(path.join(engineDir, "package.json"));

fs.mkdirSync(outDir, { recursive: true });

const packages = [
  { pkg: "@dimforge/rapier2d-compat", outFile: "rapier2d-compat.mjs" },
  { pkg: "@dimforge/rapier3d-compat", outFile: "rapier3d-compat.mjs" },
];

let copied = 0;

for (const { pkg, outFile } of packages) {
  let entryPath;
  try {
    // Resolve the package's own package.json rather than `require.resolve(pkg)`
    // directly — that would follow the "require" condition (dist/rapier.cjs),
    // and we specifically need the real ESM entry (dist/rapier.mjs, importable
    // via a browser <script type="importmap">). Read `exports["."].import`
    // (falling back to the "module" field) so this never hardcodes a dist
    // layout that could silently drift from what the package actually ships.
    // The package's own "exports" map doesn't expose "./package.json" as a
    // subpath, so `require.resolve(`${pkg}/package.json`)` is refused by
    // Node's exports-map enforcement. Resolve the package's main (CJS) entry
    // instead — always permitted — and walk up two directories
    // (dist/rapier.cjs -> dist -> package root) to find package.json, then
    // read it directly with `fs` (a plain file read, not a module
    // resolution, so the exports map doesn't apply).
    const mainEntryPath = require.resolve(pkg);
    const pkgDir = path.dirname(path.dirname(mainEntryPath));
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const importEntry =
      pkgJson.exports?.["."]?.import ?? pkgJson.module ?? pkgJson.main;
    if (!importEntry) {
      throw new Error(`no ESM entry found in ${pkg}'s package.json`);
    }
    entryPath = path.join(pkgDir, importEntry);
  } catch (err) {
    console.warn(
      `[copy-rapier-vendor] could not resolve "${pkg}" — skipping (physics in the browser preview will not have this specifier available). ${err instanceof Error ? err.message : String(err)}`,
    );
    continue;
  }

  const dst = path.join(outDir, outFile);
  fs.copyFileSync(entryPath, dst);
  copied++;
  console.log(
    `[copy-rapier-vendor] ${pkg} → public/vendor/rapier/${outFile} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`,
  );
}

if (copied === 0) {
  console.warn(
    "[copy-rapier-vendor] no rapier packages vendored — physics import map will be empty.",
  );
}
