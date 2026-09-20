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

## Current pass — open items

### Fix remaining pre-existing test/type failures (previously catalogued as "known, unrelated" — now being fixed for real)

- [ ] `PhysicsBody.test.ts`/`PhysicsBodyCallbacks.test.ts` — tests reference `bodyHandle`/`colliderHandle`/`onCollisionEnter`/`dispatchCollisionEnter`/`onSensorEnter`/`onSensorExit`/`dispatchSensorEnter`/`dispatchSensorExit`/`onSensorStay`/`dispatchSensorStay` on `PhysicsBody`, none of which exist on the component. Determine whether the callback API belongs on `PhysicsBody` (value component) or `PhysicsSystem` (owns the Rapier handles) and implement for real — no `any`, no stub.
- [ ] `Widget.test.ts` — `fadeIn`/`fadeOut`/`animEnd`/`shake` animation assertions fail; real timing/state bug in `ui/Widget.ts`, not a flaky test.
- [ ] `apps/ide/src/__tests__/ideStore.test.ts` — `addEntity` with `parentId` stack-overflows in `mapTree` (`ideStore.ts:371`) — real infinite-recursion bug.
- [ ] `apps/ide/src/__tests__/editorGrid.test.ts` — `snapToGrid(-15, 32)` returns `-0` instead of `0`; normalize negative zero.
- [ ] `GPUTier.test.ts` — test's `HostAdapter` mock is missing required members; either complete the mock or (if `detectGPUTier` shouldn't require a full `HostAdapter`) narrow its parameter type.
- [ ] `SceneManager.test.ts` / `PostProcessSystem.ts` — `TransitionOptions.effect`/`TransitionEffect` were deliberately left out of `SceneManager.ts` per the old comment "re-add when effects can actually be rendered" — `RenderPipeline` now exists, so implement real transition effects (fade/wipe/slide at minimum) instead of leaving the field/type undefined.
- [ ] `TweenSystem.ts` — `EasingName` used but not imported; fix the import.
- [ ] `ui/widgets/image.ts` — references `IUIRenderer.clip`, which doesn't exist on the interface; add it (in `@emptysock/types`) and implement in the concrete renderer(s).
- [ ] `index.ts` — exports `CollisionCallback`/`SensorCallback` from `components/PhysicsBody.js`, which doesn't export them; resolve as part of the PhysicsBody callback fix above.
- [ ] `behaviors/BulletBehavior.ts` / `DestroyOutsideBehavior.ts` — `ctx.scene` is possibly `undefined`; fix the type-unsafe access.
- [ ] `systems/VNTextbox.ts` — unused `namePlateColor` var (lint).
- [ ] `packages/export-utils/` — lint errors (unused `mkdirSync`, non-null assertions, `import()` type annotations) **and** the latent duplicate/inconsistent per-platform export implementation flagged in the desktop-export work (nothing calls it; nothing in it produces a real signed/working macOS `.app`) — resolve by deleting it if `packages/toolchain/src/desktopBuild.ts` fully supersedes it, or wiring it in for real if it does something the new pipeline doesn't.
- [ ] `templates/platformer/src/scenes/GameScene.ts` — `Entity` imported as a value but only used as a type (lint).

### Debug-mode visibility

- [ ] Audit `DebugOverlaySystem`'s default-enabled state and every IDE debug-facing panel (Profiler, Debugger, console/log views) — debug/profiling UI must be visible only when the game or IDE is actually running in a debug/dev build, never by default in a release export. Confirm this against how it worked before this pass (something regressed or was inconsistent) and fix the gating, not just the default value.

### Theme, responsiveness, and developer feedback

- [ ] Audit every IDE panel against the IDE UI checklist in `CLAUDE.md` (CSS variables only, empty states, conditional UI, action-hint copy) — fix any panel that hardcodes colors or breaks in light mode.
- [ ] Verify `ViewportSystem`/`PointerSystem`/`RenderPipeline` are actually wired into the IDE's live preview iframe end to end (not just available to game code) so the preview itself is responsive.
- [ ] Verify build/export/import flows surface clear status and error feedback to the developer (per CLAUDE.md's "Status / feedback copy" personality guidance) — a failed build, a missing asset, a broken GMS2 import resource should never fail silently.

### Visual editors — code/visual parity, no stubs

- [ ] Audit every node/visual editor panel (Visual Script Editor / `VisualScriptComponent`, the Story Graph panel, ParticleEditor, ShaderEditor, SequenceEditor) for: (a) whether it's a functional editor over a real data model or a stub/placeholder, (b) whether that data model has a first-class code-equivalent API so a developer can construct/edit the same thing programmatically without the visual editor, and (c) whether visual-editor edits and code edits round-trip losslessly.
- [ ] Confirm there is a UI-building path that is both visual (a panel) and code-first (the existing `Widget`/`UISystem` API) with the two kept in sync, per the same round-trip requirement.

---

## Decisions a future agent cannot read from code

### ES target is es2024 everywhere, not es2026

TypeScript 6.0.3 (in use) only supports `--target ES2024` at most. esbuild 0.28 names targets up to `es2024`; `es2026` is silently treated as `esnext` which changes the output in unpredictable ways. All three locations must stay at `es2024`:

- `apps/ide/src/services/GameBuildService.ts` — default target param and `transformOnly()`
- `apps/ide/src/services/MonacoSetupService.ts` — `ScriptTarget.ES2024`

### Top-level await IS supported in game code

ESM format + ES2022+ target enables it. The IDE builds game code as `format: "esm"` with `target: ["es2024"]`, so developers can use `await` at the top level of their entry file.

### ESLint game-code rules must be excluded from engine implementation files

`eslint.config.mjs` has a block of rules meant to catch mistakes in _game developer_ code (e.g. no `localStorage`, no direct pixi/howler imports). The engine itself uses those things legitimately. Do not remove entries from that block's `ignores` array or the engine package itself will fail lint. As of this pass the exclusion list includes (check the file for the current, authoritative list — it grows as new engine-internal wrapper files are added): `SaveSystem.ts`, `VariableStore.ts`, `AudioSystem.ts`, `RenderSystem.ts`, `RenderPipeline.ts`, `LightingSystem.ts`, `PhysicsSystem.ts`, `CameraSystem.ts`, `IDEBridge.ts`, `types/aliases.ts`, `VNTextbox.ts`, and the test files that legitimately import pixi.js directly (`RenderPipeline.test.ts`, `ViewportSystem.test.ts`, `AssetManifest.test.ts`).

### Fixed timestep default is 1/60 (60 Hz)

`SceneManager.fixedTimeStep = 1/60`. This is a public field; games can override it. The accumulator pattern means `_fixedUpdate()` may fire 0, 1, or multiple times per rendered frame depending on how the clock drifts. Physics-based games should move body stepping into `_fixedUpdate()`; rendering stays in `update()`.

### Vec2 canonical home is `core/Entity.ts`

`Vec2` is declared once in `packages/engine/src/core/Entity.ts`. `NavMeshSystem` imports and re-exports it from there. Do not declare a second `Vec2` anywhere in the engine package.

### `Engine.loadScene()` was removed — use `SceneManager.transition()`

Do not re-add `loadScene` — it had subtle divergence (synchronous vs queued) that confused users.

### MCP server has no 3D physics tool

`physics_raycast_3d` is listed in the tool registry but explicitly throws "not implemented". The MCP test asserts this behaviour. Do not implement it without a Rapier3D WASM build available server-side.

### GMS2 `.yyp`/`.yy` real-format quirks (learned by testing against a real project, then deleting it — see below)

The importer was validated once, end to end, against a real full GameMaker export provided temporarily by the user solely for that purpose; the project data was deleted from disk immediately after and was never committed. These quirks were confirmed against real files, not guessed, and are permanently captured as synthetic regression tests in `packages/toolchain/src/__tests__/gms2-import.test.ts`:

- `.yyp`/`.yy` files are **not strict JSON** — GameMaker's IDE always writes a trailing comma before the final `}`/`]` of every object and array. Strip `,(\s*[}\]])` → `$1` before parsing.
- The project's own display name lives at `.yyp` root under `"%Name"`, not `"name"`.
- Object events go well beyond `Create_/Step_/Draw_/Destroy_`: collision handlers are `Collision_<other object name>.gml`, keyboard handlers are `KeyPress_<vk code>.gml`/`KeyRelease_<vk code>.gml` (37-40 = arrow keys). Emit `onCollideWith<Other>()`/`onKeyPress<Name>()`/`onKeyRelease<Name>()`.
- Room `.yy` layers identify their kind via `resourceType` (`"GMRInstanceLayer"`, `"GMRTileLayer"`, `"GMRBackgroundLayer"`, …), never `"layerType"`.
- Sprites store one PNG per frame at the sprite directory root, named by that frame's own UUID (`.yy` `frames[].name`), never `<sprite name>.png`.
- `defaultScriptType: 1` does **not** reliably mean "uses GML Visual" — do not warn on it alone.
- Real projects carry legacy GameMaker 8.1 DnD-compatibility symbols (`action_move`, `gml_pragma`, etc.) in compiled action lists — leave these untranspiled (surface as unresolved identifiers) rather than faking them.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.
