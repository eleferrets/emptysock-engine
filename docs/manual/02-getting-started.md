# 2 — Getting Started

---

## 2.1 Clone and install

```bash
git clone https://github.com/eleferrets/emptysock-engine.git
cd emptysock-engine
pnpm install
```

`pnpm install` bootstraps the entire monorepo: engine, toolchain, IDE frontend, and Tauri backend. The first install takes 1–3 minutes; subsequent installs use the pnpm store cache.

---

## 2.2 Monorepo layout

```
emptysock-engine/
├── packages/
│   ├── engine/          @emptysock/engine — runtime systems, Actor Model, ECS core
│   ├── types/           @emptysock/types  — shared TypeScript interfaces
│   └── toolchain/       @emptysock/toolchain + emptysock-toolchain CLI
├── apps/
│   └── ide/             Tauri v2 + React/Vite IDE
│       ├── src/         React frontend
│       │   ├── components/panels/   — one file per docked panel
│       │   ├── services/            — GameBuildService, etc.
│       │   ├── store/               — Zustand IDE state
│       │   └── App.tsx              — rc-dock layout root
│       ├── src-tauri/   — Rust Tauri backend
│       └── public/      — static assets, PWA manifest
├── docs/
│   └── manual/          — this manual
├── CLAUDE.md            — AI agent guide
├── api-reference.json   — machine-readable API surface
└── package.json         — workspace root with Turbo scripts
```

---

## 2.3 Running the IDE

### Browser mode (fastest, no Rust needed)

```bash
cd apps/ide
pnpm dev
```

Opens the IDE at `http://localhost:5173`. All editing, building, and play features work. Features that require the native filesystem (GitPanel, file export) show placeholder UI.

### Desktop mode (full feature set)

```bash
cd apps/ide
pnpm tauri:dev
```

Launches the Tauri desktop app. Requires Rust installed (see Section 1). The first compilation of the Rust backend takes 2–5 minutes; subsequent hot-reloads are fast.

### Running everything in parallel (development)

From the repo root:
```bash
pnpm dev
```

This uses Turborepo to run `dev` across all packages in dependency order.

---

## 2.4 Your first project file

The IDE opens with a starter scene in the code editor. The default file is `src/scenes/GameScene.ts`. To write game logic, edit this file directly in the Monaco editor.

A minimal scene:

```typescript
import { Scene } from '@emptysock/engine';

export class GameScene extends Scene {
  override async onLoad(): Promise<void> {
    // Runs once, awaited before first frame.
    // Create entities, load assets, set up systems here.
  }

  override onUpdate(dt: number): void {
    // Runs every frame. dt = seconds since last frame.
    // Never use setTimeout or setInterval here.
  }

  override onDestroy(): void {
    // Cancel timers, clean up listeners.
  }
}
```

Press the **Play** button (or `Ctrl+Enter`) to run the scene in the sandboxed preview canvas.

---

## 2.5 Adding files to your project

The IDE supports multi-file projects via virtual file system. Use the **Files** panel (left dock) to add new files. The editor tracks all open files — relative imports between them resolve through the in-browser module graph:

```typescript
// src/entities/Player.ts
export class Player {
  x = 0; y = 0;
}

// src/scenes/GameScene.ts
import { Player } from '../entities/Player';
// Works — the virtual FS resolves the import from the open-files map.
```

Supported file types: `.ts`, `.tsx`, `.js`, `.json`.

---

## 2.6 Playing and hot-reloading

The **Play** button compiles all open files with esbuild-wasm and injects the result into a sandboxed iframe. The iframe communicates back via `postMessage`:

- `fps` / `frametime` messages feed the Profiler panel.
- `log` / `error` messages appear in the Console panel.
- `ready` fires when the scene's `onLoad()` resolves.

While playing, editing code triggers a **hot-reload**: the scene is recompiled and the iframe refreshes without a full page reload.

---

## 2.7 Exporting a build

Use the `emptysock-toolchain` CLI (installed as a workspace binary):

```bash
pnpm emptysock-toolchain detect          # prints detected platform
pnpm emptysock-toolchain export --platform linux --format appimage
pnpm emptysock-toolchain export --platform windows --format installer
pnpm emptysock-toolchain export --platform android
pnpm emptysock-toolchain export --platform ios
```

Common flags:

| Flag | Purpose |
|------|---------|
| `--entry src/scenes/GameScene.ts` | Entry point (default: first scene) |
| `--out dist/` | Output directory |
| `--minify` | Minify JS bundle |
| `--drop-console` | Strip all console.* calls |
| `--sourcemap` | Emit source maps alongside bundle |
| `--aggressive` | Enable aggressive tree-shaking |

---

## 2.8 Running tests

```bash
pnpm test              # all packages
cd packages/engine && pnpm test   # engine only
```

Tests use Vitest with jsdom environment. The engine package has coverage for all core systems.

---

## 2.9 Type checking

```bash
pnpm typecheck
```

Runs `tsc --noEmit` across all packages. Always pass before committing.
