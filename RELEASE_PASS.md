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

- [x] `PhysicsBody.test.ts`/`PhysicsBodyCallbacks.test.ts` — `PhysicsBody` now owns `bodyHandle`/`colliderHandle` (set by `PhysicsSystem.registerEntity()`) and `onCollisionEnter`/`onCollisionExit`/`onSensorEnter`/`onSensorExit`/`onSensorStay` registration methods, plus matching `dispatch*` methods that `PhysicsSystem` calls when it drains real Rapier collision/intersection events in `_drainCollisionEvents()`. `CollisionCallback`/`SensorCallback` exported from `PhysicsBody.ts`.
- [x] `Widget.test.ts` — bug was a unit mismatch: `animate()`'s `duration` option is documented/used in milliseconds everywhere else in the widget API, but `_tick(dt)` receives `dt` in seconds. Fixed by converting `durationMs` to seconds once in `animate()`.
- [x] `apps/ide/src/__tests__/ideStore.test.ts` — real bug: entity ids were `ent-${Date.now()}`, so two `addEntity()` calls in the same millisecond (routine in tests, possible in real fast interaction) collided. A colliding child id equal to its own parent id made `mapTree`'s transform match and re-nest the same node as its own child forever. Fixed with a monotonic `entityIdCounter` suffix.
- [x] `apps/ide/src/__tests__/editorGrid.test.ts` — fixed `-0` AND a correctness bug the naive fix would have introduced: `Math.round` rounds `-0.5` toward `-0`/`0`, not away from zero, so `snapToGrid(-16, 32)` must round half away from zero (matching `+16 → +32`) via `Math.ceil(cells - 0.5)` for negative values, then normalize any resulting `-0` to `0`.
- [x] `GPUTier.test.ts` — narrowed `detectGPUTier`'s parameter to a new `GPUTierAdapter = Pick<HostAdapter, "detectGPUTier">` type (interface segregation) instead of requiring the full `HostAdapter`; updated the test's mock to match.
- [x] `SceneManager.test.ts` / `PostProcessSystem.ts` — implemented real `fade`/`wipe`/`slide`/`none` transition effects. `SceneManager` gained `TransitionEffect`, `effect` on `TransitionOptions`, and `attachPostProcess(sink)` to drive a `PostProcessSystem`-shaped sink's `beginTransition`/`transitionProgress`/`endTransition` without importing pixi (environment boundary preserved). `RenderPipeline.renderTransitionOverlay()` actually paints the effect with a `Graphics` overlay each frame.
- [x] `TweenSystem.ts` — added a real `import type { EasingName }` alongside the re-export.
- [x] `ui/widgets/image.ts` — added `clip(): void` to `IUIRenderer` in `@emptysock/types`; `CanvasRenderingContext2D` already satisfies it structurally, no concrete renderer needed changes.
- [x] `index.ts` — `CollisionCallback`/`SensorCallback` now genuinely exported from `PhysicsBody.ts`.
- [x] `behaviors/BulletBehavior.ts` / `DestroyOutsideBehavior.ts` — added `ctx.scene !== undefined` guards (no non-null assertion) before `removeEntity()`.
- [x] `systems/VNTextbox.ts` — `namePlateColor` was computed but never applied. Wired it in for real as the fill of a new `_namePlateBg` `PanelWidget` sitting behind the speaker-name label.
- [x] `packages/export-utils/` — fixed the three lint errors (unused `mkdirSync` import via a proper `import type { Dirent }`, non-null assertions replaced with `expect(...).toBeDefined()` + optional chaining, `import()` type annotation replaced with a top-level `import type`). Deleted the dead, unwired `exportWindows`/`exportMacOS`/`exportLinux` (fake NSIS script, empty `.app` bundle, hand-rolled `.AppImage`/`.deb` — nothing called them and none could produce a real signed/working desktop build); `packages/toolchain/src/desktopBuild.ts`'s real `cargo tauri build` pipeline is the only desktop export path now. `exportWeb`/`exportAndroid`/`exportIOS`/`exportRaspi` were kept — `desktopBuild.ts` doesn't cover those platforms.
- [x] `templates/platformer/src/scenes/GameScene.ts` — split into a value import (`Scene`, `Transform`, `Sprite`, `PhysicsBody`, `CharacterController`, `InputSystem`) and `import type { Entity }`.

All of the above verified together: full-repo `eslint` is clean, and every package's `vitest run`/`tsc --noEmit` is green (engine 382/382, apps/ide 92/92, toolchain 19/19, export-utils 23/23) — no more "known, pre-existing" carve-outs.

### Debug-mode visibility

- [x] `DebugOverlaySystem` itself was already correct (disabled by default, invisible-not-empty when off). The real bugs were in the IDE: `CanvasPreview.tsx`'s debug overlay rendered on a UI toggle alone with no check on `playState`/`buildMode`, so it could show while editing or during a release-mode run; `ConsolePanel.tsx`'s Debugger tab always showed a live "Running" status with enabled Pause/Step regardless of whether a game was actually running. Both gated to `playState === "playing" && buildMode === "debug"` now; `setPlayState("stopped")` also clears stale paused/inspector state.

### Theme, responsiveness, and developer feedback

- [x] Theme audit: CSS-variable infrastructure (`--es-*`, light+dark) is solid; every hardcoded color found was a legitimate exception already (canvas/SVG game-data drawing, modal scrims, box-shadows, the brand logo mark) — none needed fixing under CLAUDE.md's actual "surrounding UI" rule.
- [x] Responsiveness wiring: confirmed correct by design, not a gap — the IDE preview runs the developer's own compiled bundle inside a real iframe, so any game using `RenderPipeline` + `ViewportSystem` gets the same live rescaling a shipped game gets, with zero IDE-side plumbing needed (`ViewportSystem` installs its own resize listener on the iframe's `window`).
- [x] Dev feedback: `ExportModal.tsx` (web+desktop) and the GMS2 import flow already surface specific errors, not silent failures. Empty-state coverage finished across VNEditor/GitPanel/LocalisationEditor (already fine) and `VisualScriptEditor.tsx` (was missing — added).

### Visual editors — code/visual parity, no stubs

- [x] Visual Script Editor: the existing panel is a scene/entity/component _scaffold_ graph (generates a `Scene` subclass), not a logic-scripting graph — there was **zero engine-side runtime** for executing node graphs at all. Built one for real: `VisualScriptComponent` (a genuine `Component` + interpreter: onUpdate/onEvent triggers, sequence, branch, get/set variable, get/set switch, sendMessage via `ActorSystem`, cycle-guarded) plus a `VisualScriptGraphBuilder` code-first API producing the identical graph shape. Rewiring the existing panel's UI to author _this_ graph type (vs. its current scene-scaffold graph) is separate, larger UI work — tracked below, not done.
- [x] Story Graph: found and fixed a real data-loss bug, not just a missing feature — `dialogueTreeToStoryGraph` had no `"condition"` branch, so importing a `.vnscript` containing a condition node silently dropped it. Added `'condition'` node + `ChoiceOption.when` support end to end: converter, visual authoring UI (new node type, condition fields, reused existing add/edit patterns), and a lossless round-trip proven by test.
- [x] ParticleEditor: was maintaining its own ad hoc shape and a hand-rolled Canvas2D simulation that diverged from the real `ParticleEmitter`. Now edits `ParticleEmitterOptions` directly (zero translation) and previews through a real `ParticleEmitter` instance.
- [x] UI maker (`UIPlacementPanel`): was drawing hand-rolled rectangles from a flat, lossy shape. Now constructs real `Widget` instances via a real `UISystem` for preview, and the saved layout _is_ the real per-type `*WidgetOpts` constructor shape — proven equal to hand-written code in a test.
- [x] ShaderEditor / SequenceEditor: fully audited, both had real gaps, both fixed.
  - **ShaderEditor**: its uniform contract (`projectionMatrix`, `uSampler`, `attribute`/`varying` GLSL ES1 syntax) matched nothing — `PostProcessSystem` has no custom-GLSL hook at all, and the panel's own call-to-action, `RenderSystem.addShaderFilter()`, did not exist anywhere in the engine. There was no code path a shader written in the panel could ever run through. Added `CustomShaderFilter` (`packages/engine/src/systems/CustomShaderFilter.ts`) with the same uniform/attribute contract `LightingFilter` already uses (`uProjectionMatrix`/`uWorldTransformMatrix`/`uTransformMatrix`, `aPosition`/`aUV`, `uTexture`, plus `uTime`), and real `RenderSystem.addLayerShaderFilter()`/`removeLayerShaderFilter()` methods. Rewrote the panel's placeholders and preview to that same contract, and rewrote the preview itself to render through `createCustomShaderFilter()` via a real PixiJS renderer (was raw hand-rolled WebGL1 calls) — same compile path as production, errors are PixiJS's own diagnostics. State moved off untracked local-only `useHistory` into a new `shaderStore.ts` (Zustand), matching the ParticleEditor pattern, so edits survive remount.
  - **SequenceEditor**: its playback loop was a bare `requestAnimationFrame` that only advanced a `currentTime` number and moved the playhead — no `TweenManager`/`CoroutineSystem` involved, and the value badge used a local linear-only `interpolate()` helper with no easing support at all (a hand-written `TweenManager.to()` with an ease would never match panel playback). There was also no engine-side system to load the saved `Track[]`/keyframe shape at all. Added `SequenceSystem` (`packages/engine/src/systems/SequenceSystem.ts`, with `evaluateTrackAt()` for pure scrubbing and `play(tweens, target, def, startAt)` that schedules real `TweenManager.to()` calls, one per keyframe segment, matching what a developer would hand-write). Added a per-track `ease` field (`EasingName`, editable in the panel) and `tracksToSequenceDefinition()` producing the exact `SequenceTrackDef[]` shape. Play now schedules through a real `TweenManager`/`SequenceSystem` pair and drives them via `tweens.update(dt)` every frame; the value badge is read off the tween-driven target, not a separate formula.
  - Tests: `packages/engine/src/__tests__/CustomShaderFilter.test.ts`, `packages/engine/src/__tests__/SequenceSystem.test.ts` (incl. a hand-written-vs-`play()` parity test and a mid-sequence resume test), `apps/ide/src/__tests__/sequenceEditorPlayback.test.ts`. Full engine (392) + IDE (96) suites, `tsc --noEmit` (both packages — IDE's pre-existing `MonacoSetupService.ts` monaco-editor@0.56 typings gap is unrelated, see below), and `eslint packages/engine/src apps/ide/src` all clean.
- [ ] Rewire `VisualScriptEditor.tsx`'s panel UI to author `VisualScriptComponent` graphs (branch/sequence/variable/message nodes), not just the existing scene-scaffold graph — the interpreter and code-first builder exist and are tested; only the visual-authoring UI for _this_ graph type is outstanding.

### Known follow-up (not part of this pass's checklist, found during verification)

- [ ] `apps/ide/src/services/MonacoSetupService.ts` — `tsc --noEmit` fails on `monaco.languages.typescript.*` accesses; `monaco-editor@0.56.0`'s root `monaco.d.ts` no longer includes the TypeScript-language-service namespace declarations that used to live there (a real upstream restructuring, not a code bug — the runtime calls are correct, this is types-only). Needs investigating whether a separate type-only import path exists in 0.56, or whether this needs a local type augmentation / pinning to an earlier monaco-editor version.

---

## Decisions a future agent cannot read from code

### Collision/sensor callbacks live on PhysicsBody, dispatched by PhysicsSystem

Registration (`onCollisionEnter`, `onSensorEnter`, etc.) belongs on `PhysicsBody` because that's the value component game code already holds a reference to after `entity.getComponent("PhysicsBody")` — no second lookup, no event-bus indirection. Dispatch (`dispatchCollisionEnter`, etc.) is `PhysicsSystem`'s job because it owns the Rapier `World`/`EventQueue` and is the only thing that ever observes a real collision. `PhysicsSystem._drainCollisionEvents()` still also emits `entity.emit("collisionEnter", ...)` for existing consumers of the old entity-event path — both fire side by side, no behavioural regression for code written against the old API.

### Scene transitions: SceneManager times them, RenderPipeline paints them

`SceneManager.transition()` takes an `effect: TransitionEffect` but never imports pixi — it stays inside the engine environment boundary (Node/browser/Tauri all run it). It drives a minimal `TransitionEffectSink` interface (`beginTransition`/`transitionProgress`/`endTransition`) via `attachPostProcess()`; `PostProcessSystem` satisfies that shape structurally. Actual pixels come from `RenderPipeline.renderTransitionOverlay(postProcess)`, which reads `PostProcessSystem`'s `transitionEffect`/`transitionProgress`/`transitionColour` and draws a full-screen `Graphics` rect — a triangle wave for `fade`, a growing rect for `wipe`, a rect sweeping across the screen for `slide`. This is an overlay-based transition (one rect on top of whatever's currently rendered), not a true two-scene crossfade — RenderPipeline doesn't keep two scenes' sprites live simultaneously. Good enough for a cut-covering transition; revisit if a game needs to see both scenes blending.

### export-utils no longer has a desktop path

`packages/export-utils`'s `exportWindows`/`exportMacOS`/`exportLinux` were deleted — they were a second, unwired, non-functional desktop packaging implementation (fake NSIS script, an empty `.app` directory with no compiled binary, a hand-assembled `.AppImage`). `packages/toolchain/src/desktopBuild.ts` is the one real desktop export path: it scaffolds an actual Tauri v2 project and runs `cargo tauri build`. If desktop export logic needs to change, change it there — don't resurrect the export-utils versions. `exportWeb`/`exportAndroid`/`exportIOS`/`exportRaspi` still live in export-utils since desktopBuild.ts doesn't cover those targets, but nothing currently calls them from the CLI either — that's flagged here for whoever picks up mobile/web export next, not fixed in this pass.

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
