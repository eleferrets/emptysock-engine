# EmptySock IDE — Handoff Notes

Non-obvious architectural decisions and unimplemented PRD items for the next session.

---

## Non-obvious decisions

### 1. Engine prebundle (engine-runtime.build.mjs)

The engine cannot be imported by user code inside an iframe because there is no module resolver available there. Instead:

- `engine-runtime.build.mjs` runs at `predev`/`prebuild` (via package.json scripts) using Vite's programmatic `build()` API. It produces a self-contained IIFE that assigns `window.EmptySockEngine = ...`.
- The output is written to `src/runtime/engineBundle.generated.ts` (gitignored) as a quoted string: `export const ENGINE_BUNDLE: string = "..."`.
- PlayRunner injects this as the first `<script>` block in the iframe HTML, before user code.
- The file is gitignored because it is a build artifact (~3 MB unminified). Every developer must run `pnpm engine-runtime` (or just `pnpm dev`) before working.

### 2. esbuild-wasm WASM URL

`GameBuildService.ts` fetches `esbuild.wasm` from `https://unpkg.com/esbuild-wasm@0.25.5/esbuild.wasm` at runtime. This works in production but:

- **Dev server**: Blocked by CORS or slow CDN → blank canvas when playing. To fix for dev, copy `node_modules/esbuild-wasm/esbuild.wasm` into `public/` and change `wasmURL` to `/esbuild.wasm`. Add a `postinstall` or `predev` script to do the copy automatically.
- **Version pinning**: The version in the URL must match `esbuild-wasm` in package.json exactly. If you bump esbuild-wasm you must also update the URL.

### 3. engineGlobalPlugin (virtual module resolution)

esbuild-wasm's `build()` API runs in a browser Web Worker with no Node.js module resolution. User code that writes `import { World } from '@emptysock/engine'` would fail. The `engineGlobalPlugin` intercepts that import and replaces it with `module.exports = window.EmptySockEngine` — the global set by the prebundled IIFE. This is the only way to make npm imports work inside a browser-only build pipeline.

### 4. COOP/COEP headers (SharedArrayBuffer)

esbuild-wasm uses `SharedArrayBuffer` internally, which requires:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
These are set in `netlify.toml` for production. For local dev they are set in `vite.config.ts` under `server.headers`. If you remove or soften these headers, esbuild-wasm will throw `SharedArrayBuffer is not defined` and the build pipeline will break.

### 5. isTauri() detection

`'__TAURI_INTERNALS__' in window` is the officially documented way to detect a Tauri v2 runtime. Do not use `window.__TAURI__` (removed in v2) or try to import tauri packages unconditionally (they throw in the browser). File and export services branch on this flag to choose between Tauri invoke commands and browser File System Access API.

### 6. AppImage on Linux — bundleMediaFramework

`tauri.conf.json` sets `"bundleMediaFramework": true` under the Linux bundle config. This tells Tauri's linuxdeploy plugin to bundle WebKitGTK and GTK3 `.so` files directly into the AppImage, making it fully standalone — no system packages needed. Without this flag, the AppImage requires the user to have `libwebkit2gtk-4.1` installed, which breaks on many distros.

### 7. Windows WebView2 embedBootstrapper

`tauri.conf.json` sets `"installMode": "embedBootstrapper"` for the Windows WebView2 config. This bundles a tiny installer stub that silently downloads and installs the WebView2 runtime if it is not present. The alternative `"offlineInstaller"` bundles the full 100 MB runtime, making the installer much larger. Most Windows 10/11 machines already have WebView2 (it ships with Edge), so `embedBootstrapper` is the right tradeoff.

### 8. File System Access API fallback

`BrowserFileService` uses `showOpenFilePicker`/`showSaveFilePicker` when available (Chrome, Edge, Safari 15.2+). For save in Firefox (which does not implement the API), it falls back to creating a Blob URL and clicking a hidden `<a download>` link. For open in Firefox, there is currently no fallback — an error is returned. This is surfaced to the user in the command palette and menu bar.

### 9. Netlify deployment

`netlify.toml` is at the repo root but sets `base = "apps/ide"`. Netlify runs the build from inside `apps/ide`. The SPA redirect (`/* → /index.html`) is required because Vite's router would 404 on direct URL loads.

### 10. emptysock-toolchain CLI (stub)

The Rust `export_game` command in `src-tauri/src/lib.rs` shells out to an `emptysock-toolchain` binary to perform cross-compilation for non-web targets (Windows exe, macOS app, Android, iOS). This binary **does not exist yet**. The command degrades gracefully — if the binary is not found it returns an error string rather than crashing. Non-web desktop/mobile exports are entirely non-functional until the toolchain is implemented.

### 11. BouncingBalls demo

`CanvasPreview.tsx` shows `BouncingBallsDemo` when `playState === 'stopped'`. This is a placeholder that uses the engine's ECS directly in the preview pane. When `playState === 'playing'`, the real esbuild-wasm pipeline runs and the iframe replaces the demo canvas. The demo canvas is hidden (not unmounted) during play to avoid losing its WebGL context.

---

## Unimplemented PRD items

| Item | Status | Notes |
|------|--------|-------|
| **Scene Inspector** | Placeholder UI | Shows hardcoded mock entities. Not wired to a running ECS world. Needs a message channel from the iframe runner back to the IDE to stream entity/component state. |
| **Entity Properties panel** | Placeholder UI | Same as above — shows mock component fields with no real data binding. |
| **Asset Browser** | Placeholder UI | No real asset loading, importing, or management. No backend storage. |
| **Left sidebar file tree** | Placeholder | Shows a hardcoded list of fake project files. Needs real filesystem integration (File System Access API directory picker for browser; Tauri `fs` plugin for desktop). |
| **Project save/load** | Not implemented | No concept of a project directory or project file. The editor only operates on a single `.ts` file at a time. |
| **Non-web exports** | Stub only | Windows `.exe`, macOS `.app`, Linux binary, Android APK, iOS IPA all require the `emptysock-toolchain` CLI which does not exist. |
| **Android / iOS targets** | Not started | Tauri v2 has mobile support but it is not scaffolded here. Separate `src-tauri` configuration is needed. |
| **Multi-file projects** | Not implemented | The code editor is a single file. No module graph, no import resolution between user files. |
| **Real-time collaboration** | Not started | No design exists. |
| **Plugin/extension system** | Not started | No design exists. |
| **Undo/redo in editor** | Depends on Monaco | Monaco (not integrated) has built-in undo. The current CodeMirror-based editor has basic undo but no history panel. |
| **esbuild.wasm self-hosted** | Partial | `wasmURL` points to unpkg CDN. Should copy `node_modules/esbuild-wasm/esbuild.wasm` into `public/` and serve locally to avoid CDN dependency and fix dev-server blank canvas. |
| **Engine bundle minification** | Not done | `engine-runtime.build.mjs` builds unminified (~3 MB). Set `minify: true` in production to reduce iframe startup time. |
| **Hot-reload on code change** | Not implemented | Clicking Play rebuilds from scratch every time. Could debounce and rebuild automatically on code changes, diffing the output to decide whether to reload the iframe or patch state. |
| **Screenshot / blank canvas bug** | Unresolved | Playwright screenshot of the dev server returns white. Likely caused by esbuild-wasm WASM fetch being blocked in headless Chrome (no unpkg access or COOP header prevents cross-origin WASM). Fix: self-host the WASM file. |
