# EmptySock IDE — Handoff Notes

Non-obvious architectural decisions and unimplemented PRD items for the next session.

---

## Non-obvious decisions

### 1. Engine prebundle (engine-runtime.build.mjs)

The engine cannot be imported by user code inside an iframe because there is no module resolver available there. Instead:

- `engine-runtime.build.mjs` runs at `predev`/`prebuild` (via package.json scripts) using Vite's programmatic `build()` API. It produces a self-contained IIFE that assigns `window.EmptySockEngine = ...`.
- The output is written to `src/runtime/engineBundle.generated.ts` (gitignored) as a quoted string: `export const ENGINE_BUNDLE: string = "..."`.
- PlayRunner injects this as the first `<script>` block in the iframe HTML, before user code.
- The file is gitignored because it is a build artifact (~3 MB unminified). Every developer must run `pnpm engine-runtime` (or just `pnpm dev`) before working. Pass `--minify` or set `NODE_ENV=production` for a smaller production bundle.

### 2. esbuild-wasm WASM URL

`GameBuildService.ts` initialises esbuild-wasm with `wasmURL: "/esbuild.wasm"` — served from the local `public/` directory, not from a CDN. The file is copied there by the `predev`/`prebuild` script (`copy-wasm.mjs`) which runs `cp node_modules/esbuild-wasm/esbuild.wasm public/esbuild.wasm` automatically before every dev or build invocation.

- **Version pinning**: when you bump `esbuild-wasm` in `package.json`, `pnpm install` triggers `copy-wasm.mjs` via the `postinstall` hook and the WASM file is replaced in lock-step. No manual URL update needed.
- **`public/esbuild.wasm` is gitignored** — it is a build artifact, not source.

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

| Item                              | Status      | Notes                                                                                                                                                        |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scene Inspector**               | ✅ Done     | Live ECS binding via `ideBridge`. Streams entity/component state from running game iframe to IDE store.                                                      |
| **Entity Properties panel**       | ✅ Done     | Real component field editing; changes dispatched as live patches through the iframe bridge.                                                                  |
| **Asset Browser**                 | ✅ Done     | `AssetStore.ts` — `BrowserFileStore` (File System Access API) with `MemoryFileStore` fallback. Drag-drop import, folder picker, delete.                      |
| **Left sidebar file tree**        | ✅ Done     | Real filesystem tree via `ProjectService.openDirectory()` — File System Access API in browser, Tauri `fs` plugin on desktop.                                 |
| **Project save/load**             | ✅ Done     | `.emptysock` project files via File System Access API (browser) and Tauri dialog/fs plugins (desktop). Multi-file `openFiles` map persisted in project JSON. |
| **Multi-file projects**           | ✅ Done     | Multiple editor tabs backed by `openFiles` map. All open files passed to esbuild `virtualFiles` for cross-file import resolution.                            |
| **Non-web exports**               | Stub only   | Windows `.exe`, macOS `.app`, Linux binary, Android APK, iOS IPA all require the `emptysock-toolchain` CLI which does not exist.                             |
| **Android / iOS targets**         | Not started | Tauri v2 has mobile support but it is not scaffolded. Separate `src-tauri` configuration is needed.                                                          |
| **Real-time collaboration**       | Not started | No design exists.                                                                                                                                            |
| **Plugin/extension system**       | Not started | No design exists.                                                                                                                                            |
| **Undo/redo in editor**           | Partial     | `useHistory<T>` hook exists and is wired in panels that mutate data. Monaco has its own per-file undo stack. No history panel.                               |
| **esbuild.wasm self-hosted**      | ✅ Done     | Vite `?url` import serves WASM from the local package — no CDN dependency.                                                                                   |
| **Engine bundle minification**    | ✅ Done     | `engine-runtime.build.mjs` minifies when `--minify` is passed or `NODE_ENV=production`. The `prebuild` script sets production mode automatically.            |
| **Hot-reload on code change**     | ✅ Done     | `CanvasPreview.tsx` debounces 500 ms on `openFiles` changes, rebuilds via `GameBuildService`, and reloads the iframe when the build succeeds.                |
| **Screenshot / blank canvas bug** | Unresolved  | Playwright screenshot of the dev server returns white. Likely a COOP/COEP header issue in headless Chrome preventing SharedArrayBuffer.                      |
