# EmptySock Engine — Claude / AI Agent Guide

This monorepo contains the EmptySock game engine IDE. Use this file as the primary reference when making changes.

## Repo layout

```
packages/
  engine/        — @emptysock/engine  (runtime, systems, Actor Model)
  types/         — @emptysock/types   (shared TS interfaces)
  toolchain/     — @emptysock/toolchain + emptysock-toolchain CLI
app/
  ide/           — Tauri v2 + React/Vite IDE
```

## Key architecture rules

1. **Engine is environment-agnostic** — no DOM, no Tauri APIs in `packages/engine/`.
2. **Actor Model** — all game state flows through `ActorSystem`. Actors communicate only via typed `Message` objects. No shared mutable state.
3. **Pluggable Transport** — `NetworkActor` takes any `Transport` implementation. Never import a concrete transport into the engine.
4. **PluginSystem singleton** — `pluginSystem` from `@emptysock/engine`; call `pluginSystem.inject<T>('key')` to get services.
5. **IDE store** — `useIDEStore` (Zustand) is the single source of truth for editor state. Multi-file editing goes through `openFile` / `closeFile` / `setFileContent`.
6. **GameBuildService** — esbuild-wasm; `virtualFiles` map enables multi-file module graphs. Always pass `openFiles` from the store.
7. **Tauri detection** — `'__TAURI_INTERNALS__' in window` at runtime. Never hard-require Tauri in React code; always provide a browser fallback.
8. **rc-dock layout** — App.tsx uses `DockLayout` from `rc-dock`. Add new panels as tabs in `DEFAULT_LAYOUT`. Do not add fixed flex children to `<App>`.
9. **GPU flags** — `NvOptimusEnablement` and `AmdPowerXpressRequestHighPerformance` are `#[no_mangle] pub static` in `lib.rs`. Never remove them.
10. **Conventional commits** — enforced via Husky + commitlint. Format: `type(scope): subject`.

## Engine systems quick-ref

| System | Import | Init |
|--------|--------|------|
| Actor Model | `Actor`, `ActorSystem`, `NetworkActor` | `new ActorSystem()` |
| Plugin | `pluginSystem` | singleton, no init |
| NavMesh | `NavMeshSystem` | `navMesh.load(data)` |
| Physics 2D | `PhysicsSystem` | sync, no init needed |
| Physics 3D | `PhysicsSystem3D` | `await physics.init()` |
| Input | `InputSystem` | `input.attach(canvas)` |
| Touch | `InputSystem` | same; call `input.flush()` per frame |

## Adding a new engine feature

1. Create `packages/engine/src/systems/MySystem.ts` or `packages/engine/src/core/My.ts`.
2. Export from `packages/engine/src/index.ts`.
3. Add a skill to `eleferrets/emptysock-ai-skills/skills/`.

## Adding a new IDE panel

1. Create `apps/ide/src/components/panels/MyPanel.tsx`.
2. Import into `apps/ide/src/App.tsx` and add a `makeTab('my-panel', 'My Panel', <MyPanel />)` entry to `DEFAULT_LAYOUT`.
3. If the panel needs store state, use `useIDEStore`.

## Commit convention

```
feat(engine): add something new
fix(ide): correct something broken
docs: update readme
chore: dependency update
```

## Running locally

```bash
pnpm install
pnpm dev          # all packages in parallel (Turbo)
pnpm test         # all tests
pnpm typecheck    # all type checks

# IDE only:
cd apps/ide
pnpm dev          # Vite dev server on :5173
pnpm tauri:dev    # Tauri desktop
```
