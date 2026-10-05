# Included Files

"Included Files" is the build-time mechanism for shipping arbitrary, non-code
files alongside your game — config, licence text, data files, a platform-only
DLL — with control over which build targets actually get each one.

This is a project-authoring convention plus a real build step, not an engine
runtime system — there is no `IncludedFilesSystem` to import. You author a
manifest, and `emptysock-toolchain export` copies the matching files into your
build output.

---

## The manifest

Create `build-included-files.json` at your project root (next to your entry
script), or point `--included-files` at a manifest somewhere else:

```json
{
  "files": [
    "README.txt",
    { "path": "config/default-settings.json" },
    { "path": "licences/win-only.dll", "platforms": ["windows"] },
    { "path": "licences/mac-only.dylib", "platforms": ["mac"] },
    { "path": "shared-data" }
  ]
}
```

Each entry is either:

- a plain string — a shorthand for `{ "path": "<string>" }`, which ships to
  every platform, or
- an object `{ "path": string, "platforms"?: string[] }`.

`path` is relative to the project directory (the manifest's own directory
unless you pass `--included-files` pointing somewhere else) and can name a
single file or a whole directory — a directory is copied recursively.

`platforms` accepts any of `"all"`, `"windows"`, `"mac"`, `"linux"`, `"web"`,
`"android"`, `"ios"`, `"raspi"`. Omitting it (or including `"all"`) means every
platform. A file tagged for platforms your current export target isn't one
of is simply left out of that build — not an error.

---

## What happens at build time

`emptysock-toolchain export --platform <platform> ...` (real desktop export —
see [Building and Exporting](./building-and-exporting.md) for how that
pipeline works) loads `build-included-files.json`, filters it down to the
entries tagged for the platform you're building, and copies each matching
file/directory into the packaged app's own `dist/included/` directory — the
same directory Tauri's `frontendDist` config bundles alongside your compiled
`game.js` and `index.html`. Your own game code reads these back at runtime
via a relative fetch (browser/Tauri WebView) or `@tauri-apps/plugin-fs` on
desktop, the same "engine defines no opinion, your game code reads the
files" split `SaveSystem`'s `StorageAdapter` uses.

### Android, iOS and Raspberry Pi

`--platform android|ios|raspi` bundles your entry to `<out>/game.js`, stages
that platform's files, and writes `<platform>-export.json` listing what was
staged. It does not run Gradle or Xcode, so no apk/aab/ipa is produced by this
command. Included Files land where each platform's packaging expects extra
resources:

| Platform | Directory                   |
| -------- | --------------------------- |
| android  | `<out>/assets/included/`    |
| ios      | `<out>/Resources/included/` |
| raspi    | `<out>/included/`           |

`--format zip` on `raspi` zips the whole output directory.

No manifest present is a silent no-op — most projects have nothing to
include, and this feature never becomes mandatory just by existing.

A missing source path, or a copy that fails partway, is reported as a real
warning printed to the console — never a silent drop, and never something
that aborts the whole build over one bad entry.

```bash
emptysock-toolchain export \
  --platform linux \
  --entry src/scenes/GameScene.ts \
  --out dist/ \
  --included-files build-included-files.json
```

Omitting `--included-files` looks for `build-included-files.json` right next
to your entry script's own directory.

---
