# Release Pass

Cross-session task log. Before starting any work, write open items here with `[ ]`.
Mark `[x]` when done. Keep this file next to `CLAUDE.md` so it survives context compaction.

This is the canonical log — it does not live in companion repos.

---

## Status key

- [x] Done
- [ ] Open
- [~] Partial

---

## Pre-release quality pass — all complete

- [x] Behavior system wired (`addBehavior`/`removeBehavior`/`update`/`destroy` on `Entity`)
- [x] `BehaviorContext.scene` made optional (circular import fix)
- [x] `ParticleSystem` — `'line'` emitter shape implemented
- [x] `ImageWidget` — all four `scaleMode` values implemented
- [x] `SliderWidget` — `_resolvedX` set in `render()`; UISystem passes pointer x before click
- [x] `docs/reference/camera.md` — rewritten for real instanced `CameraSystem` API
- [x] `docs/guides/input-and-gamepad.md` — removed nonexistent `axis()`/`pointer.*`; real mouse API added
- [x] `docs/manual/12-tutorial-platformer.md` — Camera API and `CameraBounds` property names fixed
- [x] `ai/AGENTS.md` — Timer/Audio/Camera/SaveSystem class names corrected
- [x] `ai/CLAUDE.md` — Camera instanced pattern; SaveSystem synchronous; Common Mistakes table removed (enforced by lint/types instead)
- [x] `ai/api-reference.json` — CameraSystem, GamepadSystem, Widget.on, SaveSystem all corrected
- [x] `skills/00-quickstart.md` — Camera and Gamepad sections corrected
- [x] `skills/01-actor-model.md` — inbox cap caveat added
- [x] MCP particle tests — `maxParticles` → `emissionRate`/`lifetimeMin`/`lifetimeMax`
- [x] MCP `physics_raycast_3d` test — updated to assert tool not registered
- [x] `eslint.config.mjs` — `no-restricted-globals` for `setTimeout`/`setInterval`/`localStorage`/`sessionStorage`; `no-restricted-imports` for direct library imports
- [x] `eslint.config.mjs` — `no-misused-promises` (checksVoidReturn) + `require-await` catches `async onUpdate()` at lint time
- [x] `eslint.config.mjs` — excluded engine implementation files (SaveSystem, AudioSystem, RenderSystem, etc.) from game-code lint rules so they can legitimately use localStorage/pixi/howler
- [x] `packages/engine/src/core/EngineAPI.ts` — removed `Engine.loadScene()` (dead wrapper over `SceneManager.transition()`, zero callers, behavioral divergence)
- [x] `packages/engine/src/core/SceneManager.ts` — removed `queue(name)` (duplicate of `transition({duration:0})`); added fixed-timestep accumulator driving `_fixedUpdate()`
- [x] `packages/engine/src/core/Scene.ts` — `fixedUpdate()` renamed to `_fixedUpdate()` (internal convention; SceneManager now wires it)
- [x] `packages/engine/src/core/GPUTier.ts` — removed `async` from `detectGPUTier()` (all paths return synchronously)
- [x] `packages/engine/src/index.ts` — removed `EntityVec2` type alias, `WindowSystem` class, `applyEasing`, `widgetRoundRect` (all were internal helpers leaking into the public API)
- [x] `packages/engine/src/systems/NavMeshSystem.ts` — removed duplicate `Vec2` declaration; now imports from `core/Entity.ts`
- [x] `packages/engine/src/systems/CGGallery.ts` — removed `unlockFromNode()` one-liner (callers use `unlock()` directly)
- [x] `packages/engine/src/systems/CoroutineSystem.ts` — fixed misleading `destroy()` doc (system is still usable after destroy)
- [x] `packages/engine/src/systems/InputSystem.ts` — fixed tautological `getTouch()` doc
- [x] `packages/toolchain/src/cli.ts` — removed unnecessary `async` from `detect` command action callback
- [x] `apps/ide/src/services/AssetStore.ts` — `MemoryFileStore` methods de-asynced (use explicit `Promise.resolve/reject`)
- [x] `apps/ide/src/services/MonacoSetupService.ts` — Monaco `ScriptTarget` raised to `ES2024` (supports top-level await in game code)
- [x] `apps/ide/src/services/GameBuildService.ts` — default target and `transformOnly()` changed from `es2026` to `es2024` (highest supported by TS 6.0.3 and esbuild 0.28)

---

## Next pass — open items

### GMS2 importer validation

- [x] Test `gms2_inspect_project` against a real `.yyp` project file
  - Ran `importGMS2Project` end to end against a real, full GameMaker export
    ("J3 Adventure": 59 objects, 202 sprites, 10 rooms, 98 scripts),
    provided temporarily by the user solely to validate this importer. The
    project data was **deleted from disk** after use — it was never
    committed and is not kept anywhere in this repo, gitignored or
    otherwise. The learnings below, and the permanent regression tests in
    `src/__tests__/gms2-import.test.ts` (fully synthetic — small
    hand-written `.yyp`/`.yy` snippets built inline in the test file), are
    what's left to show for it.
  - **Real format quirks learned (undocumented by YoYo, confirmed against
    real files, not guessed):**
    - `.yyp`/`.yy` files are **not strict JSON** — GameMaker's IDE always
      writes a trailing comma before the final `}`/`]` of every object and
      array. `JSON.parse` throws outright on real files. Fix: strip
      `,(\s*[}\]])` → `$1` before parsing (done in `gms2-import.ts`,
      `gms2-sprite-import.ts`, `gms2-room-import.ts`, and the IDE's
      `gms2Import.ts`).
    - The project's own display name lives at `.yyp` root under `"%Name"`,
      not `"name"` — most _nested_ resources redundantly carry both, but
      the project root does not.
    - Object events are one `.gml` file per event, but naming goes well
      beyond `Create_/Step_/Draw_/Destroy_`: collision handlers are
      `Collision_<other object name>.gml` (one file per colliding object),
      and keyboard handlers are `KeyPress_<vk code>.gml` /
      `KeyRelease_<vk code>.gml`, where the code is GameMaker's virtual key
      code (37-40 = arrow keys). The importer previously dropped these
      entirely and silently — no warning, no stub, just gone. Now emits
      `onCollideWith<Other>()`, `onKeyPress<Name>()`, `onKeyRelease<Name>()`.
    - Room `.yy` layers identify their kind via `resourceType`
      (`"GMRInstanceLayer"`, `"GMRTileLayer"`, `"GMRBackgroundLayer"`, …) —
      there is no `"layerType"` field in real files, so the importer's
      layer-type detection always fell back to `"unknown"`.
    - Sprites store **one PNG per frame** at the sprite directory root,
      named by that frame's own UUID resource name (from the `.yy`
      `frames[].name` field) — never `<sprite name>.png`. The sprite
      importer previously assumed a single `<name>.png`, which does not
      exist for any real sprite, producing a dangling path.
    - `defaultScriptType: 1` at the project root does **not** reliably mean
      "this project uses GML Visual (drag-and-drop)" — the real fixture
      carries that value while being 100% text-GML. The old code emitted a
      false-positive project-wide warning from this alone; removed.
    - Real GMS2 projects carry legacy GameMaker 8.1-era compatibility
      symbols in their compiled action lists (`action_move`,
      `action_sprite_set`, `gml_pragma`, `__global_object_depths`, etc.) —
      these are GM8 DnD-compatibility internals, not modern GML builtins,
      and are intentionally left untranspiled (surfacing as unresolved
      identifiers for manual review) rather than faked with stubs.
  - Sprites and rooms are now wired into the main import path (previously
    real parsers existed in `gms2-sprite-import.ts`/`gms2-room-import.ts`
    but were never called — everything was pushed straight to `skipped`).
    Sprites produce a `.sprite.ts` descriptor plus real copied frame PNGs
    under `assets/sprites/<name>/`; rooms produce a scene loader function
    that spawns one entity per real room instance placement.
  - Deleted `gms2/spriteImport.ts` and `gms2/roomImport.ts` — near-duplicate,
    never-wired implementations of the same conversion, superseded by the
    canonical `gms2-sprite-import.ts`/`gms2-room-import.ts` pair.

### dist-types cleanup

- [ ] `packages/engine/dist-types/` currently includes `__tests__/*.d.ts` files
  - They shouldn't be in the public type declarations shipped to Monaco / consumers
  - Fix: add `"exclude": ["src/**/__tests__"]` to the `tsconfig.types.json` (or whichever tsconfig drives `build:types`)
  - After fixing, regenerate `dist-types/` and commit

### Ship-readiness remaining gaps (as of this pass)

- [ ] End-to-end Tauri desktop build not verified in CI — the GitHub Actions workflow exists but the Tauri signing keys are not configured; this blocks actual distributable `.dmg`/`.exe`/`.AppImage`
- [ ] No automated integration tests for the IDE (only unit tests for services and the engine); at minimum the `GameBuildService` round-trip (code → esbuild → iframe) should have a Playwright smoke test
- [ ] `docs/getting-started/` has stubs for "IDE tour" and "from GameMaker" — both are empty or placeholder; a user hitting them during onboarding will be confused

---

## Decisions a future agent cannot read from code

### ES target is es2024 everywhere, not es2026

TypeScript 6.0.3 (in use) only supports `--target ES2024` at most. esbuild 0.28 names targets up to `es2024`; `es2026` is silently treated as `esnext` which changes the output in unpredictable ways. All three locations must stay at `es2024`:

- `apps/ide/src/services/GameBuildService.ts` — default target param and `transformOnly()`
- `apps/ide/src/services/MonacoSetupService.ts` — `ScriptTarget.ES2024`

### Top-level await IS supported in game code

ESM format + ES2022+ target enables it. The IDE builds game code as `format: "esm"` with `target: ["es2024"]`, so developers can use `await` at the top level of their entry file. This is intentional and documented (or should be — add a note to `docs/language-reference.md` if not there yet).

### ESLint game-code rules must be excluded from engine implementation files

`eslint.config.mjs` has a block of rules meant to catch mistakes in _game developer_ code (e.g. no `localStorage`, no direct pixi/howler imports). The engine itself uses those things legitimately. The `ignores` array inside that config block excludes:

- `SaveSystem.ts`, `VariableStore.ts` — use `localStorage`/`sessionStorage`
- `AudioSystem.ts` — imports howler
- `RenderSystem.ts`, `LightingSystem.ts`, `PhysicsSystem.ts`, `CameraSystem.ts` — import pixi
- `IDEBridge.ts` — calls `window.parent.postMessage`
- `types/aliases.ts` — internal re-exports

Do not remove these ignores or the engine package itself will fail lint.

### Fixed timestep default is 1/60 (60 Hz)

`SceneManager.fixedTimeStep = 1/60`. This is a public field; games can override it. The accumulator pattern means `_fixedUpdate()` may fire 0, 1, or multiple times per rendered frame depending on how the clock drifts. Physics-based games should move body stepping into `_fixedUpdate()`; rendering stays in `update()`.

### Vec2 canonical home is `core/Entity.ts`

`Vec2` is declared once in `packages/engine/src/core/Entity.ts`. `NavMeshSystem` imports and re-exports it from there. Do not declare a second `Vec2` anywhere in the engine package — they will be structurally identical but the module identity will differ, causing TypeScript to reject passing one where the other is expected.

### `Engine.loadScene()` was removed — use `SceneManager.transition()`

The wrapper was removed in this pass. The correct call is `SceneManagerInstance.transition(scene, options)` or `Engine.pushScene()` / `Engine.popScene()` for the overlay stack. Do not re-add `loadScene` — it had subtle divergence (synchronous vs queued) that confused users.

### MCP server has no 3D physics tool

`physics_raycast_3d` is listed in the tool registry but explicitly throws "not implemented". The MCP test asserts this behaviour. Do not implement it without a Rapier3D WASM build available server-side — the engine's 3D physics runs in the browser WASM context, not in Node.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.
