# EmptySock QoL Pass 2

Status markers: ✅ done · ⬜ todo · 🔴 blocked · 🔍 verify

Source docs: `improvements.md`, `apps/ide/HANDOFF.md`, `docs/ui-widgets.md`, MCP audit, IDE audit.

---

## MCP — correctness and security (`emptysock-mcp`)

- ✅ **[P1]** `save.ts` — `save_read`, `save_write`, `save_delete` have no try/catch around I/O

- ✅ **[P1]** `save.ts:27` — `slotPath()` throws `new Error()` on traversal instead of `invalidParams()`

- ✅ **[P2]** Default branch in five handlers throws `new Error()` instead of `notFound()`  
  Fixed in `save.ts`, `physics.ts`, `navmesh.ts`, `vn.ts`, `particle.ts`.

- ✅ **[P2]** `gms2.ts` — synchronous `fs.readFileSync` blocks the event loop

- ✅ **[P2]** Six handler files missing explicit return types  
  `actor.ts`, `scene.ts`, `navmesh.ts`, `physics.ts`, `save.ts`, `gms2.ts`.

- ✅ **[P2]** `env.ts:8–11` — `apiToken` and `mcpAuthToken` defined but never consumed  
  Both removed from `env.ts` and `.env.example`.

- ✅ **[P3]** `README.md` config table omits `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`

- ✅ **[P3]** `CLAUDE.md` architecture table omits `particle.ts` and `vn.ts`

---

## MCP — test coverage (`emptysock-mcp`)

- ✅ **[P2]** No tests for `save_read`, `save_write`, `save_delete`  
  25 new test cases added; 47/47 passing.

- ✅ **[P2]** No tests for `physics_raycast_2d`, `physics_raycast_3d`, `physics_body_state`

- ✅ **[P2]** No test for `navmesh_nearest_node`

- ✅ **[P2]** No tests for `scene_entity_info`, `scene_get_component`, `actor_inbox_size`

- ✅ **[P3]** `gms2_inspect_project` success path untested

- ✅ **[P3]** `actor_send_message` success path untested

---

## IDE — undo / redo (`emptysock-engine`)

- ✅ **[P1]** `VisualScriptEditor.tsx` — no undo/redo  
  All graph state (`nodes`, `edges`, `pendingEdge`, canvas offset/scale) is plain `useState` with no `useHistory` wrapper, no undo/redo buttons, and no `Ctrl+Z`/`Ctrl+Shift+Z` handler. Violates the mandatory undo/redo rule.

- ✅ **[P2]** `AudioMixer.tsx` — no undo/redo  
  `audioMixerService.setVolume()` mutates channel state directly. Add `useHistory` + undo/redo buttons + keyboard handler.

- ✅ **[P2]** `AssetBrowser.tsx` — no undo/redo for asset mutations  
  `addAsset` and `deleteAsset` dispatch to the store with no history snapshot. A deleted asset cannot be recovered within the session.

---

## IDE — state and data quality (`emptysock-engine`)

- ✅ **[P1]** `VisualScriptEditor.tsx` — graph state lost on unmount  
  `nodes` and `edges` are local component state, not stored in `ideStore`. Every unmount (tab close, dock re-layout) silently discards the graph.

- ✅ **[P2]** `ideStore.ts` — initial state seeded with mock entities and assets  
  `entities: INITIAL_ENTITIES` (4 hardcoded entities) and `assets: INITIAL_ASSETS` (6 hardcoded assets) are set at startup instead of using the `initialProjectState()` factory that already returns empty arrays. Every new session opens with phantom project content.

- ✅ **[P2]** `GitPanel.tsx` — mock file diffs rendered as genuine project state  
  `MOCK_FILES` (3 entries with realistic engine file paths and diff content) renders in browser mode without any disclaimer, label, or visual distinction from real git output.

- ✅ **[P2]** `CGGallery.tsx` — CG unlock state not persisted  
  A comment in the file explicitly acknowledges this: CG entries and unlock state live in local React state and are lost on panel unmount. Needs persisting to project JSON (mapped to a switch index range in `VariableStore`).

- ✅ **[P2]** `EntityProperties.tsx:9–17` — `AVAILABLE_COMPONENTS` is a hardcoded 7-string array  
  No mechanism exists to derive the list from the engine's actual component registry. Adding a new engine component requires manually updating this array; omitting it silently hides the component from the Add Component menu.

---

## IDE — hardcoded hex colors on DOM elements (`emptysock-engine`)

All items below apply inline `color`, `background`, or `stroke` values to DOM or SVG elements
(not canvas). They break in light mode. Migrate each to an existing `--es-*` CSS variable
(or create a new one following the `--es-` prefix convention).

- ✅ **[P2]** `VisualScriptEditor.tsx:32–38` — `NODE_COLORS` map applies background/border hex to node `<div>` elements  
  Six raw hex values per node type. Use `--es-accent-*` or new semantic tokens.

- ✅ **[P2]** `VisualScriptEditor.tsx:644,669` — SVG edge strokes hardcoded  
  Committed edge: `stroke="#7c6af7"`. Pending edge: `stroke="#ef4444"`. Use `var(--es-accent)` and `var(--es-red)`.

- ✅ **[P2]** `VNEditor.tsx:764,778,1013` — `+ Choice` button, Delete button, and node label text hardcoded  
  Background `"#7c3aed"`, `"#dc2626"`, and text `"#e2e8f0"` on DOM elements. Use `--es-accent`, `--es-red`, `--es-text`.

- ✅ **[P2]** `GitPanel.tsx:154–159` — `statusColor()` returns raw hex for modified/added/deleted/untracked  
  Inline `color` on DOM `<span>`. Replace with `var(--es-yellow)`, `var(--es-green)`, `var(--es-red)`, `var(--es-text-muted)`.

- ✅ **[P2]** `GitPanel.tsx:110–118` — diff-view add/remove line colors hardcoded  
  `color: "#4ade80"` and `color: "#f87171"` on DOM `<span>`. Use `var(--es-green)` / `var(--es-red)`.

- ✅ **[P2]** `GitPanel.tsx:426,492` — stage and commit buttons hardcode `color: "#fff"`  
  Use `var(--es-text-on-accent)` or a token so the text remains readable if the accent color changes.

- ✅ **[P2]** `SequenceEditor.tsx:49–55` — `TYPE_COLORS` map applies background hex to DOM badge elements  
  Six raw hex values used as `background: TYPE_COLORS[track.type] + "33"`. Replace with `--es-track-*` semantic tokens.

- ✅ **[P2]** `SequenceEditor.tsx:983,1207–1208,1235` — OK button, keyframe delete X, and playhead hardcoded  
  Three separate DOM elements with raw `#2563eb`, `#ef4444`, and `color: "#fff"`. Use `--es-accent`, `--es-red`, `--es-text-on-accent`.

- ✅ **[P2]** `Profiler.tsx:155–159,178` — FPS tier colors and Draws count hardcoded  
  `color` on DOM elements: `#4ade80`, `#fbbf24`, `#ef4444` for FPS tiers; `#60a5fa` for Draws. Use `--es-green`, `--es-yellow`, `--es-red`, `--es-blue`.

- ✅ **[P2]** `ShaderEditor.tsx:337–358` — error/success status bars hardcoded  
  `rgba(225,112,85,0.12)` / `#e17055` and `rgba(0,184,148,0.1)` / `#00b894` on DOM `<div>`. Use `--es-red` / `--es-green` tokens.

- ✅ **[P2]** `AssetBrowser.tsx:1008,1103` — selected item tint not using a CSS variable  
  `rgba(124,106,247,0.15)` hardcoded. `SceneInspector` uses `var(--es-selection-bg, rgba(124,106,247,0.15))` for the same purpose. Unify.

- ✅ **[P2]** `AssetBrowser.tsx:1282` — strip preview container background hardcoded  
  `background: "#0e0e10"` on a DOM layout `<div>`. Use `var(--es-surface-deep)` or similar.

- ✅ **[P3]** `UIPlacementPanel.tsx:~744` — Insert button confirmation state hardcoded  
  `background: "#16a34a"` on a DOM `<button>`. Use `var(--es-green)`.

---

## IDE — polish (`emptysock-engine`)

- ✅ **[P2]** `VisualScriptEditor.tsx` — canvas fixed at 800×480, does not resize to container  
  `canvasWidth = 800` / `canvasHeight = 480` are hardcoded constants. Content is clipped in narrow dock layouts. Read the container's `clientWidth`/`clientHeight` via `ResizeObserver` and update the canvas dimensions.

- ✅ **[P2]** `ShaderEditor.tsx:309` — GLSL source editor is a plain `<textarea>`  
  Every other code-adjacent editor in the IDE uses Monaco. A bare textarea has no syntax highlighting, no line numbers, no GLSL keyword completion. Wire Monaco with a GLSL language config (or the existing shader syntax highlight extension).

---

## HANDOFF — unimplemented PRD items (`emptysock-engine`)

These are larger than a single checklist item; each needs its own scoped agent session.
Tracked here so they are visible alongside the QoL items.

- 🔴 **[P1]** Scene Inspector real ECS binding  
  Shows hardcoded mock entities. Needs a message channel from the iframe runner back to the IDE to stream live entity/component state.

- 🔴 **[P1]** Entity Properties real ECS binding  
  Shows mock component fields. Needs the same channel as Scene Inspector; transform mutations must reach the running ECS world.

- 🔴 **[P2]** Asset Browser backend storage  
  Operates on in-memory mock data. Needs real file I/O (File System Access API in browser; Tauri `fs` plugin on desktop).

- 🔴 **[P2]** Project save/load  
  No concept of a project directory or file. The editor only operates on a single `.ts` file at a time.

- 🔴 **[P2]** Multi-file project tree (real, not mock)  
  The file tree reflects the in-memory `openFiles` record, not a real on-disk directory listing.

- 🔴 **[P2]** Hot-reload on code change  
  Code edits require a full manual rebuild. Needs a debounced watcher that rebuilds incrementally on changes and patches the iframe or reloads it.

- ✅ **[P2]** `HANDOFF.md §2` — esbuild.wasm should be self-hosted, not fetched from unpkg  
  Copy `node_modules/esbuild-wasm/esbuild.wasm` into `public/` via a `postinstall`/`predev` script. Change `wasmURL` in `GameBuildService.ts` to `/esbuild.wasm`. Eliminates the CDN dependency and fixes the dev-server blank canvas bug.

- ✅ **[P3]** `engine-runtime.build.mjs` — engine bundle not minified  
  Built unminified (~3 MB). Set `minify: true` in production to reduce iframe startup time.

---

## UI widget system — new feature (`emptysock-engine`)

Design spec: `docs/ui-widgets.md`. Implementation order is specified there.

- ✅ **[P2]** UISystem default `ImageLoader`  
  Remove the mandatory `imageLoader` constructor parameter. Construct a default loader internally using `createImageBitmap` + `fetch`. Keep the parameter optional for override.

- ✅ **[P2]** `engine.pushScene()` / `engine.popScene()` — scene stack  
  Added `pushScene`/`popScene` to `SceneManager` and delegated via `Engine`. `Scene.engine` and `Scene.uiSystem` accessors expose both.

- ✅ **[P2]** Base `Widget` class + layout pass in UISystem  
  Anchor-based layout. `UISystem.add(widget)` / `UISystem.removeWidget(widget)` wire into render/update/hit-test.

- ✅ **[P3]** Widget primitives: `LabelWidget`, `ImageWidget`, `ButtonWidget`, `PanelWidget`, `ProgressBarWidget`, `SliderWidget`, `CheckboxWidget`  
  All in `packages/engine/src/ui/Widget.ts`. 35 tests passing.

- ✅ **[P3]** Named animations: `fadeIn`, `fadeOut`, `slideIn`, `slideOut`, `pop`, `shake`  
  Implemented in `Widget._tick()`. All accept `{ duration, easing, direction }`.

- 🔴 **[P3]** IDE visual editor for UISystem widgets  
  Drag-and-drop widget palette, anchor picker, property panel, widget tree. Undo/redo mandatory. CSS variables only. Empty state: "No widgets yet — drag one from the palette."

---

## ai-skills — API correctness (`emptysock-ai-skills`)

High items below document wrong class names, wrong method signatures, or banned patterns that agents
will act on immediately. Fix `ai/api-reference.json` first, then update the skill files.

- ✅ **[P1]** `skills/00-quickstart.md` — banned `any` cast in Actor Model example  
  `(msg as any).type` violates the zero-`any` rule. Cast to a typed union instead.

- ✅ **[P1]** `skills/02-navmesh.md` — wrong class name, instantiation model, and method signatures  
  Skill documents `new NavMeshSystem()` / `navMesh.findPath(from, to)`. `api-reference.json` defines
  `PathfindingSystem` — a static class with `PathfindingSystem.findPath(opts)`. Fix skill and
  update `skills/gms2-migration.md` (asset-status table Paths row uses same wrong name).

- ✅ **[P1]** `skills/04-plugin-system.md` / `skills/05-touch-input.md` — `InputSystem` documented as instantiated class with non-existent methods  
  Skill has `attach()`, `flush()`, `touchCount`, `primaryTouch`. `api-reference.json` defines
  the static `Input` class. Rewrite to match the static API.

- ✅ **[P1]** `skills/07-save-localisation.md`, `skills/08-story-graph.md`, `skills/00-quickstart.md` — `i18n` API does not exist  
  Three files call `i18n.load()`, `i18n.setLocale()`, `i18n.t()`. The API reference documents
  `LocalisationSystem` + standalone `t()`. `i18n.load()` is not defined anywhere.

- ✅ **[P1]** `skills/10-window-system.md` — compile-time constants example calls `document.getElementById()`  
  Explicitly banned in `api-reference.json` and `AGENTS.md`. Remove the DOM call.

- ✅ **[P1]** `skills/15-map-events.md` — two non-existent API calls  
  `SceneManager.loadScene(cmd.scene)` (correct: `SceneManager.load(name)`) and
  `input.isJustPressed('KeyZ')` (correct: `Input.isPressed()`). Fix both.

- ✅ **[P1]** `skills/12-vn-textbox.md` — `vnSystem.selectOption()` does not exist  
  Method appears in neither `VNController` (api-reference) nor `VNSystem` (skills). Remove or replace.

- ✅ **[P1]** `VNSystem` vs `VNController` mismatch  
  `VNSystem` is the primary runtime class across three skill files and the quickstart but has
  **no entry in api-reference.json**. `VNController` is fully documented in api-reference but
  referenced by **zero** skill files. Added `VNSystem` to api-reference.json as the canonical
  standalone runtime; `VNController` clarified as the entity-component variant.

- ✅ **[P2]** `skills/14-character-stage.md` — `bg.hideCG()` should be `clearCG()`  
  api-reference.json defines `clearCG()` on `VNBackgroundLayer`. Fix the skill file.

- ✅ **[P2]** `skills/13-variable-store.md` — `variableStore.reset()` not in api-reference  
  Added `reset()` to api-reference.json with signature and description.

- ✅ **[P2]** `skills/15-map-events.md` — `events.toJSON()` not in api-reference  
  Removed "Persisting events" section; replaced with correct `SaveSystem` + Zod pattern.

- ✅ **[P2]** `skills/06-ide-panels.md` — VNEditor called by undocumented name  
  Referred to as "VNEditor (Visual Novel Node Graph)". Canonical name is "Story Graph"; the
  deprecated alias is "VN Graph". "VNEditor" appears in neither.

- ✅ **[P2]** `README.md` skills table is completely out of date  
  Rebuilt from actual directory — 23 entries, no phantom rows.

- ✅ **[P2]** Missing skill files for documented systems  
  Added `skills/17-auto-tile.md`, `skills/18-cg-gallery.md`, `skills/19-tweens.md`.

- ✅ **[P2]** `README.md` docs/ block lists four non-existent files  
  Removed phantom entries; only actual files listed.

- ✅ **[P3]** `docs/getting-started.md` — `scene.createEntity()` should be `this.createEntity()`  
  Fixed scope error and related issues in the file.

---

## Done this pass

_(Items moved here as they are resolved.)_
