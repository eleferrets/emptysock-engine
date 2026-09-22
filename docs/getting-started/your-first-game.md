# Your First Game

By the end of this page you'll have the IDE running and a square moving across the screen, a complete, working mini-game. Every step is a single action.

> **Heads up:** this page uses the classic v1 API (`Scene`, `Entity`, `addComponent`), and that's exactly right for a first project. There's also a newer, faster `@emptysock/engine/v2` core built for games with a lot of entities, it's optional and doesn't replace anything here. See [What's New in v2](./whats-new-v2.md) once you're comfortable with the basics.

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

Launches the Tauri desktop app. Requires Rust installed (see [Installation](./installation.md)). The first compilation of the Rust backend takes 2–5 minutes; subsequent hot-reloads are fast.

---

## Step 3: Write your first scene

The IDE opens with a code editor panel on the right. The default file is `src/scenes/GameScene.ts`. Delete everything in it and paste this:

```typescript
import { Scene, Entity, Transform } from "@emptysock/engine";

export class GameScene extends Scene {
  private square!: Entity;
  private x = 100;
  private speed = 200; // pixels per second

  override async onLoad(): Promise<void> {
    // Create an entity. Think of it as an empty container.
    this.square = this.createEntity("Square");

    // Add a Transform to give it a position and size.
    this.square.addComponent(Transform, {
      x: this.x,
      y: 200,
      width: 48,
      height: 48,
    });
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

Press the **Play** button (or `Ctrl+Enter`). The square appears and slides back and forth. That's a complete game loop, and yes, it really is that short.

---

## Step 4: What you just wrote

| Code                           | What it means                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `extends Scene`                | Your game screen is a **Scene** — it runs the game loop                           |
| `createEntity('Square')`       | An **Entity** is a named container. It holds components                           |
| `addComponent(Transform, ...)` | A **Component** is data attached to an entity. Transform stores position and size |
| `onLoad()`                     | Runs once before the first frame. Set up entities and systems here                |
| `onUpdate(dt)`                 | Runs every frame. `dt` = seconds since last frame. Move things here               |
| `onDestroy()`                  | Runs when the scene ends. Cancel timers and free resources here                   |

---

## Project layout

```
emptysock-engine/
├── packages/
│   ├── engine/          @emptysock/engine — runtime systems, Actor Model, ECS core
│   ├── types/           @emptysock/types  — shared TypeScript interfaces
│   └── toolchain/       @emptysock/toolchain + emptysock-toolchain CLI
├── apps/
│   └── ide/             Tauri v2 + React/Vite IDE
│       ├── src/
│       │   ├── components/panels/   — one file per docked panel
│       │   ├── services/            — GameBuildService, etc.
│       │   ├── store/               — Zustand IDE state
│       │   └── App.tsx              — rc-dock layout root
│       ├── src-tauri/   — Rust Tauri backend
│       └── public/      — static assets, PWA manifest
└── docs/                — this documentation
```

---

## Working with multiple files

The IDE supports multi-file projects via a virtual file system. Use the **Files** panel (left dock) to add new files. The editor tracks all open files — relative imports between them resolve through the in-browser module graph:

```typescript
// src/entities/Player.ts
export class Player {
  x = 0;
  y = 0;
}

// src/scenes/GameScene.ts
import { Player } from "../entities/Player";
// Works — the virtual file system resolves the import from the open-files map.
```

Supported file types: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`.

---

## Playing and hot-reloading

The **Play** button compiles all open files with esbuild-wasm and injects the result into a sandboxed iframe.

While playing, editing code triggers a **hot-reload**: the scene is recompiled and the iframe refreshes without a full page reload.

---

## Running tests

```bash
pnpm test              # all packages
cd packages/engine && pnpm test   # engine only
```

Tests use Vitest with jsdom environment.

---

## Type checking

```bash
pnpm typecheck
```

Runs `tsc --noEmit` across all packages. Always pass before committing.

---

Next: [IDE Tour](./ide-tour.md) — a walkthrough of every panel and shortcut.
