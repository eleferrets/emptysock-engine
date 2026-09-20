# Building and Exporting

Use the `emptysock-toolchain` CLI to export your game to any platform. It is installed as a workspace binary when you run `pnpm install`.

---

## Detect platform

```bash
pnpm emptysock-toolchain detect
```

Prints the detected platform and available targets.

---

## Portable zip (recommended for sharing)

The `--format zip` flag produces a self-contained zip on every platform. Recipients unzip and run — no setup wizard, no registry writes, no `sudo`.

```bash
# Web — zips the Vite dist/ folder; serve with any static host
pnpm emptysock-toolchain export --platform web   --format zip --entry src/scenes/GameScene.ts --out dist/

# Linux — zips the AppImage (chmod +x, run directly)
pnpm emptysock-toolchain export --platform linux   --format zip --entry src/scenes/GameScene.ts --out dist/

# macOS — zips the .app bundle
pnpm emptysock-toolchain export --platform mac     --format zip --entry src/scenes/GameScene.ts --out dist/

# Windows — zips the portable .exe directory (no registry writes)
pnpm emptysock-toolchain export --platform windows --format zip --entry src/scenes/GameScene.ts --out dist/
```

> **Web zip note:** The web build needs a static file server because browsers block `file://` requests for WASM files. After unzipping: `npx serve dist` (Node) or `python3 -m http.server --directory dist` (Python).

---

## Exporting from the IDE (web)

The IDE's **Export Project** dialog (Export button in the toolbar) can produce a web export directly in the browser, without the CLI. Choosing platform **Web** builds your entry script with esbuild-wasm, then zips `index.html`, `engine.js` (or an inlined bundle), `game.js`, and — automatically — every asset your project actually uses.

Asset bundling works by:

1. Scanning every open source file for string literals that look like asset paths (any quoted string ending in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ogg`, `.mp3`, `.wav`, `.flac`, `.ttf`, `.otf`, `.woff`, `.woff2` or `.json`) — this covers `Sprite`/`Tilemap` texture paths, `AudioSystem` sound files, fonts, and JSON data assets such as tilemap data, dialogue trees and save schemas.
2. Also including every asset registered in the Asset Browser, so data loaded indirectly (by id rather than a literal path) is still bundled.
3. Reading each referenced path's real bytes from the project's `AssetStore` (the File System Access directory or Tauri filesystem the project is rooted in) and writing them into the zip at the same relative path the compiled `game.js` requests them at — asset paths are already relative to `index.html`, both in the IDE's live preview and in the exported zip, so no path rewriting is needed.

If a referenced asset path cannot be found in the asset store, the export still completes but the dialog shows a warning listing the missing paths, so a broken reference is caught before the game ships rather than discovered as a 404 by a player. Asset-heavy projects show live progress (`n`/`total` files, KB copied) while bundling runs.

---

## Platform-specific formats

```bash
pnpm emptysock-toolchain export --platform linux   --format appimage
pnpm emptysock-toolchain export --platform linux   --format deb
pnpm emptysock-toolchain export --platform windows --format installer
pnpm emptysock-toolchain export --platform android
pnpm emptysock-toolchain export --platform ios
```

---

## Common flags

| Flag                              | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `--entry src/scenes/GameScene.ts` | Entry point. Accepts `.ts` or `.js`.               |
| `--out dist/`                     | Output directory                                   |
| `--format zip`                    | Portable zip — no installer needed on any platform |
| `--minify`                        | Minify the JS bundle                               |
| `--drop-console`                  | Strip all `console.*` calls                        |
| `--sourcemap`                     | Emit source maps alongside the bundle              |
| `--aggressive`                    | Enable aggressive tree-shaking                     |

---

## PWA support

The IDE is a Progressive Web App. When served over HTTPS, the browser will offer to install it as a desktop shortcut. The Vite PWA plugin registers a service worker that caches the IDE shell for offline use.

The `public/manifest.webmanifest` file contains the app name, theme color, and icon paths.

---

## Build pipeline internals

```
TypeScript sources (virtualFiles map)
        │
        ▼
  engineGlobalPlugin  — resolves @emptysock/engine to a UMD global
  virtualFsPlugin     — resolves ./relative imports from the open-files map
        │
        ▼
  esbuild-wasm (browser, no filesystem access)
        │
        ▼
  IIFE bundle string
        │
        ▼
  Blob URL → iframe srcdoc
```

The engine itself is pre-bundled as a UMD global in the iframe's context. User code is compiled separately and imports the engine via that global, keeping rebuild times under 200 ms even for large projects.

> **Tip:** If esbuild reports a missing import, check that the file with the broken import is open in the IDE's Files panel. Files that exist on disk but are not open in the IDE are not included in the virtual filesystem at build time.
