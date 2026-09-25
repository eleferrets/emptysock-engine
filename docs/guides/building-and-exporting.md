# Building and Exporting

Use the `emptysock-toolchain` CLI, or the Export dialog in the desktop IDE, to export your game. Web export needs nothing beyond `pnpm install`. **Desktop export (Windows/macOS/Linux) compiles a real native binary and needs the Rust toolchain and the Tauri CLI installed locally** — there is no way around this for native compilation, and this tool does not pretend otherwise.

---

## What actually works today

| Target                                                   | Status                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Web (`--platform web`)                                   | Works out of the box. Bundles with esbuild, zips on request.                                   |
| Windows / macOS / Linux                                  | Works, **only when run on that same OS**, and only once `cargo` + `cargo tauri` are installed. |
| Android / iOS                                            | Not implemented. Selecting it in the IDE's Export dialog is disabled and says so.              |
| Cross-compiling another OS's installer from this machine | Not supported anywhere in this pipeline — see "Why no cross-compiling" below.                  |

---

## Desktop prerequisites (one-time, per machine)

```bash
# 1. Rust toolchain (if you don't already have it)
curl https://sh.rustup.rs -sSf | sh

# 2. Tauri's CLI, as a cargo subcommand
cargo install tauri-cli --version "^2"

# 3. On Linux only — Tauri's system dependencies (webkit2gtk etc.)
#    See https://v2.tauri.app/start/prerequisites/ for the current package list.
```

Run `pnpm emptysock-toolchain detect` to check what's already installed.

## How desktop export actually builds

The CLI's desktop export step and the IDE's Export dialog aren't the exact same pipeline: the CLI (`emptysock-toolchain export --platform windows|mac|linux`) bundles your game's entry point with Rolldown, not esbuild — esbuild is what the IDE's in-browser build uses, and the two are kept separate on purpose. Broadly, the desktop path looks like:

1. Bundle your game's entry point (via Rolldown, for the CLI's desktop export) into a single IIFE `game.js`.
2. Scaffold a minimal, disposable Tauri v2 project (a plain HTML/JS "shell" with no custom native code) in a temp directory, with your `game.js` as its frontend.
3. Run `cargo tauri build` against that scaffold.
4. Copy whatever Tauri's bundler wrote into `src-tauri/target/release/bundle/<type>/` — its standard output location — into your requested `--out` directory.

That means the output is a real installer produced by Tauri's own bundler, not a hand-rolled approximation of one — but it also means the same constraints Tauri itself has apply here:

- **No code signing or notarisation.** A macOS `.app`/`.dmg` built this way will trigger a Gatekeeper warning on any Mac other than the one that built it. A signed, notarised build needs a paid Apple Developer account and a separate signing step this tool does not perform.
- **Built for the host machine's own CPU architecture only.** There is no `--arch` flag that actually cross-compiles a different architecture's binary.

## Why no cross-compiling

You cannot reliably build a Windows `.exe`/`.msi` from Linux or macOS, a macOS `.app`/`.dmg` from Windows or Linux, or a Linux `.deb`/`.AppImage` from Windows or macOS on a single developer machine. Tauri's bundler shells out to platform-native tools (`makensis` on Windows, `hdiutil`/`codesign` on macOS, `dpkg-deb`/`appimagetool` on Linux) that only exist, and only work correctly, on their own OS. If you request a platform export that doesn't match the host OS, both the CLI and the IDE fail immediately with an explanation, rather than running for several minutes and failing partway through (or, worse, silently producing nothing).

If you need to ship all three platforms from one push, set up a CI matrix build — one job per OS, each running `emptysock-toolchain export` (or `cargo tauri build`) natively on that OS's own runner. GitHub Actions' `windows-latest` / `macos-latest` / `ubuntu-latest` runners are the standard way to do this; this repo does not currently ship such a workflow, but the CLI's exit codes and output paths are meant to be scriptable.

---

## Portable zip (recommended for sharing on one OS)

`--format zip` still runs the real desktop build above, then wraps whatever came out of it (installer, `.app`, `.AppImage`, …) into one zip file for handing around. It is not a substitute for the installer — Tauri's bundler doesn't produce a truly-portable no-install binary — it just saves you attaching multiple files.

```bash
# Web — zips the Vite dist/ folder; serve with any static host
pnpm emptysock-toolchain export --platform web     --format zip --entry src/scenes/GameScene.ts --out dist/

# Linux — builds an AppImage, then zips it (run on Linux)
pnpm emptysock-toolchain export --platform linux   --format zip --entry src/scenes/GameScene.ts --out dist/

# macOS — builds the .app + .dmg, then zips them (run on macOS)
pnpm emptysock-toolchain export --platform mac     --format zip --entry src/scenes/GameScene.ts --out dist/

# Windows — builds the NSIS/MSI installer, then zips it (run on Windows)
pnpm emptysock-toolchain export --platform windows --format zip --entry src/scenes/GameScene.ts --out dist/
```

> **Web zip note:** The web build needs a static file server because browsers block `file://` requests for WASM files. After unzipping: `npx serve dist` (Node) or `python3 -m http.server --directory dist` (Python).

---

## Included Files (per-platform bundled files)

Need to ship a config file, licence text, or a platform-only binary alongside your game? See [Included Files](./included-files.md) — a `build-included-files.json` manifest plus a real `--included-files` export flag, wired into the desktop export pipeline above.

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

Formats map directly to Tauri's own bundle targets — there is nothing else this pipeline can produce:

```bash
pnpm emptysock-toolchain export --platform linux   --format appimage --entry src/scenes/GameScene.ts --out dist/
pnpm emptysock-toolchain export --platform linux   --format deb      --entry src/scenes/GameScene.ts --out dist/
pnpm emptysock-toolchain export --platform windows --format nsis     --entry src/scenes/GameScene.ts --out dist/
pnpm emptysock-toolchain export --platform windows --format msi      --entry src/scenes/GameScene.ts --out dist/
pnpm emptysock-toolchain export --platform mac      --format dmg     --entry src/scenes/GameScene.ts --out dist/
```

`--format flatpak` is no longer accepted as a real target — Tauri's bundler has no Flatpak output. Use `appimage` and build a Flatpak manifest around the resulting binary yourself if you need one.

Android and iOS export (`--platform android` / `--platform ios`) do not exist in this CLI or the IDE. There is no Gradle/Xcode integration anywhere in the toolchain today.

---

## Common flags

| Flag                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `--entry src/scenes/GameScene.ts` | Entry point. Accepts `.ts` or `.js`.                          |
| `--out dist/`                     | Output directory — the real build artifacts land here         |
| `--format zip`                    | Build normally, then zip whatever the platform build produced |
| `--minify`                        | Minify the JS bundle                                          |
| `--drop-console`                  | Strip all `console.*` calls                                   |
| `--sourcemap`                     | Emit source maps alongside the bundle                         |
| `--aggressive`                    | Enable aggressive tree-shaking / property mangling            |

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
