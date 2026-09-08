# 2 — Getting Started

---

## What you'll build

By the end of this section you will have the IDE running and a square moving across the screen — a complete, working mini-game. Every step is numbered. Each step is a single action.

If you have never used a game engine before, that is fine. Every concept is explained as you go.

---

## Step 1: Clone and install

```bash
git clone https://github.com/eleferrets/emptysock-engine.git
cd emptysock-engine
pnpm install
```

`pnpm install` bootstraps the entire monorepo: engine, toolchain, IDE frontend, and Tauri backend. The first install takes 1–3 minutes; subsequent installs use the pnpm store cache.

---

## Step 2: Run the IDE

### Browser mode — fastest, no Rust needed

```bash
cd apps/ide
pnpm dev
```

This opens the IDE at `http://localhost:5173`. All editing, building, and play features work. Features that require the native filesystem (the Git panel, file export) show placeholder UI in browser mode.

> **Tip:** Start here. You do not need to compile any Rust to start making a game.

### Desktop mode — full feature set

```bash
cd apps/ide
pnpm tauri:dev
```

Launches the Tauri desktop app. Requires Rust installed (see Section 1). The first compilation of the Rust backend takes 2–5 minutes; subsequent hot-reloads are fast.

---

## Step 3: Your first game — a moving square

The IDE opens with a code editor panel on the right. The default file is `src/scenes/GameScene.ts`. Delete everything in it and paste this:

```typescript
import { Scene, Entity, Transform } from '@emptysock/engine';

export class GameScene extends Scene {
  private square!: Entity;
  private x = 100;
  private speed = 200; // pixels per second

  override async onLoad(): Promise<void> {
    // Create an entity. Think of it as an empty container.
    this.square = this.createEntity('Square');

    // Add a Transform to give it a position and size.
    this.square.addComponent(Transform, { x: this.x, y: 200, width: 48, height: 48 });
  }

  override onUpdate(dt: number): void {
    // dt is the time in seconds since the last frame (usually ~0.016 at 60fps).
    // Move the square to the right.
    this.x += this.speed * dt;

    // Bounce off the right edge.
    if (this.x > 700) {
      this.x = 700;
      this.speed = -this.speed;
    }
    // Bounce off the left edge.
    if (this.x < 50) {
      this.x = 50;
      this.speed = -this.speed;
    }

    // Update the component's position.
    const t = this.square.requireComponent(Transform);
    t.x = this.x;
  }

  override onDestroy(): void {
    // Nothing to clean up yet.
  }
}
```

Press the **Play** button (or `Ctrl+Enter`). The square will appear and slide back and forth. That is a complete game loop.

---

## Step 4: Understanding what you just wrote

Here is what each piece does:

| Code | What it means |
|------|--------------|
| `extends Scene` | Your game screen is a **Scene** — it runs the game loop |
| `createEntity('Square')` | An **Entity** is a named container. It holds components (the actual behaviors) |
| `addComponent(Transform, ...)` | A **Component** is data attached to an entity. Transform stores position and size |
| `onLoad()` | Runs once before the first frame. Set up entities and systems here |
| `onUpdate(dt)` | Runs every frame. `dt` = seconds since last frame. Move things here |
| `onDestroy()` | Runs when the scene ends. Cancel timers and free resources here |

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

## 2.3 Adding files to your project

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

Supported file types: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`.

### TypeScript vs JavaScript

Both are first-class scripting languages. The same esbuild pipeline handles both — use whichever you prefer.

**TypeScript** (type-checked, autocompletion in Monaco):
```typescript
import { Scene, Entity, Transform } from '@emptysock/engine';

export class GameScene extends Scene {
  override onUpdate(dt: number): void {
    // dt is typed as number — TypeScript checks it at build time
  }
}
```

**JavaScript** (no explicit types, looser but still works):
```javascript
import { Scene, Transform } from '@emptysock/engine';

export class GameScene extends Scene {
  onUpdate(dt) {
    // Works identically — esbuild compiles .js through the same pipeline
  }
}
```

You can freely mix `.ts` and `.js` files in the same project. A `.js` file can import a `.ts` file and vice versa.

---

## 2.4 Playing and hot-reloading

The **Play** button compiles all open files with esbuild-wasm and injects the result into a sandboxed iframe. The iframe communicates back via `postMessage`:

- `fps` / `frametime` messages feed the Profiler panel.
- `log` / `error` messages appear in the Console panel.
- `ready` fires when the scene's `onLoad()` resolves.

While playing, editing code triggers a **hot-reload**: the scene is recompiled and the iframe refreshes without a full page reload.

---

## 2.5 Exporting a build

Use the `emptysock-toolchain` CLI (installed as a workspace binary):

```bash
pnpm emptysock-toolchain detect          # prints detected platform
```

### Portable zip (no installer required)

The `--format zip` flag produces a self-contained zip on every platform. Recipients unzip and run — no setup wizard, no registry writes, no `sudo`.

```bash
# Web — zips the Vite dist/ folder; serve with any static host
pnpm emptysock-toolchain export --platform web   --format zip --entry src/scenes/GameScene.ts --out dist/

# Linux — zips the AppImage (chmod +x, run directly)
pnpm emptysock-toolchain export --platform linux   --format zip --entry src/scenes/GameScene.ts --out dist/

# macOS — zips the .app bundle (double-click or run from anywhere)
pnpm emptysock-toolchain export --platform mac     --format zip --entry src/scenes/GameScene.ts --out dist/

# Windows — zips the portable .exe directory (no registry writes)
pnpm emptysock-toolchain export --platform windows --format zip --entry src/scenes/GameScene.ts --out dist/
```

> **Web zip note:** The web build needs a static file server because browsers block `file://` requests for WASM files.  
> After unzipping: `npx serve dist` (Node) or `python3 -m http.server --directory dist` (Python).

### Platform-specific formats

```bash
pnpm emptysock-toolchain export --platform linux   --format appimage
pnpm emptysock-toolchain export --platform linux   --format deb
pnpm emptysock-toolchain export --platform windows --format installer
pnpm emptysock-toolchain export --platform android
pnpm emptysock-toolchain export --platform ios
```

### Common flags

| Flag | Purpose |
|------|---------|
| `--entry src/scenes/GameScene.ts` | Entry point (default: first scene). Accepts `.ts` or `.js`. |
| `--out dist/` | Output directory |
| `--format zip` | Portable zip — no installer needed on any platform |
| `--minify` | Minify JS bundle |
| `--drop-console` | Strip all console.* calls |
| `--sourcemap` | Emit source maps alongside bundle |
| `--aggressive` | Enable aggressive tree-shaking |

---

## 2.6 Running tests

```bash
pnpm test              # all packages
cd packages/engine && pnpm test   # engine only
```

Tests use Vitest with jsdom environment. The engine package has coverage for all core systems.

---

## 2.7 Type checking

```bash
pnpm typecheck
```

Runs `tsc --noEmit` across all packages. Always pass before committing.
