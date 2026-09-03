# EmptySock QoL Pass

Status markers: ✅ done · ⬜ todo · 🔴 blocked

---

## Remaining backlog

### UI & Scene

- ✅ Alignment guides in scene editor
  Shared editorGrid.ts: drawGrid, drawRulers (adaptive ticks, scroll+zoom-aware), drawGuides, snapToGrid, computeAlignmentGuides. Applied to UIPlacementPanel, TilemapEditor, VNEditor, CanvasPreview.

- ⬜ **[P2]** Debugger integration — breakpoints + variable inspector in preview
  iframe DevTools protocol bridge or log-based step debugger in ConsolePanel.

- ⬜ **[P2]** Turn-based battle system module
  Party vs enemy encounter triggered from map events. Action menu (attack, skill, item, flee). Formula-based damage from database entries. State effects (poison, stun). Opt-in module flag.

---

## Undo / Redo

Every editor that mutates data needs a history stack. The pattern is a shared `useHistory<T>` hook (or Zustand middleware) that records snapshots on each mutation and exposes `undo()` / `redo()` / `canUndo` / `canRedo`. Keyboard: `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`. Panels:

- ⬜ TilemapEditor — paint, erase, fill, flood-fill, layer add/remove/reorder
- ⬜ VNEditor (Story Graph) — node add/move/delete, edge add/delete, node content edits
- ⬜ UIPlacementPanel — component place, move, delete
- ⬜ SequenceEditor — keyframe add/move/delete, track add/delete, value edits
- ⬜ LocalisationEditor — key add/edit/delete, locale add/remove
- ⬜ DatabaseEditor — row add/edit/delete across all four tables
- ⬜ VariablesPanel — variable/switch add/edit/delete
- ⬜ EntityProperties — transform edits, component add/delete, entity rename
- ⬜ SceneInspector — entity add/delete/reorder
- ⬜ ParticleEditor — emitter config changes (every slider/picker interaction)
- ⬜ ShaderEditor — vertex/fragment source edits (distinct from Monaco's built-in undo which is file-scoped)
- ⬜ AutoTileRulesModal — rule add/edit/delete

Implementation note: Monaco already has its own undo stack per file — don't replace it. For canvas editors a snapshot of the tile data array is sufficient; for graph editors snapshot the node+edge list. Cap history at ~50 steps per panel to bound memory. Persist nothing — undo history is session-only.

---

## TypeScript config hardening

Changes apply to the tsconfig.json at each package root. All flags are already valid in TypeScript 5.7.

### packages/engine/tsconfig.json

- ⬜ `"noUncheckedIndexedAccess": true` — every array index access (`arr[i]`) becomes `T | undefined`; eliminates the entire class of `!` assertion bugs the audit found in LightingSystem, NavMeshSystem, etc. **Highest priority.** Expect ~20 fixups on first enable.
- ⬜ `"exactOptionalPropertyTypes": true` — prevents assigning `undefined` to an optional field that doesn't declare `| undefined`; catches a class of subtle state-mutation bugs.
- ⬜ `"noPropertyAccessFromIndexSignature": true` — forces `obj['key']` over `obj.key` when the type is an index signature; makes dynamic property access explicit and auditable.
- ⬜ `"verbatimModuleSyntax": true` — requires `import type` for type-only imports; produces cleaner output for bundlers and esbuild's type-strip path.

### apps/ide/tsconfig.json

- ⬜ `"noUncheckedIndexedAccess": true` — same as above; the panel audit found multiple unguarded index accesses.
- ⬜ `"verbatimModuleSyntax": true` — Vite already supports this; keeps the IDE bundle lean.
- ⬜ `"moduleDetection": "force"` — treats every `.ts`/`.tsx` file as a module even without imports/exports; prevents accidental global scope pollution in isolated panel files.
- ⬜ `"isolatedModules": true` — already implied by Vite but making it explicit catches any file that relies on const enum or namespace merging which Vite's single-file transpile can't handle.

### packages/toolchain/tsconfig.json

- ⬜ `"noUncheckedIndexedAccess": true`
- ⬜ `"verbatimModuleSyntax": true`

### All packages

- ⬜ `"target": "ES2026"` and `"lib": ["ES2026"]` — Node 22 and all current Tauri WebViews / evergreen browsers support the full ES2026 set. Enables `Array.prototype.toSorted`, `toReversed`, `with`, `Object.groupBy`, `Promise.withResolvers`, `Set` union/intersection/difference, `Float16Array`, and explicit resource management (`using` / `Symbol.dispose`). Use `ES2026` literally — never `ESNext`, which is a moving target that changes meaning with each TypeScript release.
- ⬜ `"noImplicitOverride": true` — requires the `override` keyword on any method that overrides a base-class method. Without it, renaming a base-class method silently turns the subclass method into a new method rather than an override; the compiler gives no warning. Particularly relevant for Scene, Behavior, and Component subclasses.
- ⬜ `"noImplicitReturns": true` — all code paths in a non-void function must return a value. Catches the common pattern of an if/else chain where one branch forgets to return.
- ⬜ `"allowUnreachableCode": false` — error on code after a `return`/`throw`/`continue`; catches dead branches that accumulate silently.
- ⬜ `"allowUnusedLabels": false` — error on unused labels; mostly cosmetic but keeps code clean.
- ⬜ `"forceConsistentCasingInFileNames": true` — prevents import path case mismatches that work on macOS (case-insensitive) but break on Linux CI. Should already be set; verify it is.
- ⬜ `"declaration": true` and `"declarationMap": true` on `packages/engine` and `packages/types` — the type declaration output and source maps for `.d.ts` files; required for IDE go-to-definition to land in source rather than compiled output when consuming `@emptysock/engine` from game code.
- ⬜ `"stripInternal": true` on `packages/engine` — removes `@internal` JSDoc declarations from the emitted `.d.ts`; keeps the public API surface clean and prevents agents from calling implementation details.

---

## Vite config improvements

Applies to `apps/ide/vite.config.ts`.

### Build output quality

- ⬜ `build.target: 'es2026'` and `esbuild.target: 'es2026'` — stops Vite from downcompiling modern syntax (top-level await, `using`, logical assignment) that is natively supported in the Tauri WebView and current browsers. Use the literal year string, never `'esnext'`. Note: game builds compiled by `GameBuildService` should also target `es2026`, not `esnext`.
- ⬜ `build.sourcemap: false` (explicit) — no source maps in shipped IDE or compiled game builds. Source maps expose your full source to anyone with devtools and bloat the output. Keep `sourcemap: 'inline'` only in the Vite dev server config block, never in `build`.
- ⬜ `build.cssCodeSplit: false` — consolidate CSS into one file; avoids a class of flash-of-unstyled-content issues with rc-dock's dynamic panel insertion.
- ⬜ `build.modulePreload: { polyfill: false }` — the Tauri WebView and target browsers all support native module preload; the polyfill adds ~1.5 kB for nothing.
- ⬜ `build.reportCompressedSize: false` — skips the gzip-size calculation Vite prints after each build; saves ~2 s per build for no practical benefit in a Tauri app that is never served over HTTP.

### Development experience

- ⬜ `css.lightningcss: true` (Vite 5.4+) — drop-in replacement for PostCSS for standard transforms; 50–100× faster CSS processing. Requires removing postcss.config.js if present.
- ⬜ `server.warmup: { clientFiles: ['./src/App.tsx', './src/store/ideStore.ts', './src/lib/editorGrid.ts'] }` — pre-transforms the heaviest entry files on dev-server start so first load isn't slow.
- ⬜ `optimizeDeps.include: ['react', 'react-dom', 'zustand', 'rc-dock']` — force pre-bundling of packages that would otherwise be discovered lazily and stall the first HMR.

### Worker config

- ⬜ `worker.format: 'es'` — emit game build workers as ES modules instead of IIFE; consistent with the `format: 'esm'` setting in GameBuildService and required for `import.meta` inside workers.

---

## Architectural debt (found during audit, not yet tracked)

- ⬜ AudioSystem ↔ AudioMixerService bridge — the IDE mixer panel sets volumes on `AudioMixerService` (a Web Audio GainNode graph) which has no connection to the engine's `AudioSystem`. Volume changes in the IDE have zero effect on in-game sounds. Fix: route IDE mixer through `AudioSystem.setBusVolume` via the preview iframe `postMessage` channel, same as the draw-call counter.
- ⬜ CGGallery uses SaveSystem with dummy `scene: ''` and `playtime: 0` fields — makes gallery entries look like corrupted save files in any listing UI. Migrate to VariableStore which already serialises boolean flags.
- ⬜ SequenceEditor track types are generic numeric keyframes (Position X/Y, Rotation, Scale, Opacity) — not the dialogue/movement/audio/wait lanes described in the original spec. Either rename the panel to "Keyframe Animator" to reflect what it is, or add the VN/RPG lane types.
- ⬜ `GameBuildService.transformOnly()` uses `format: 'iife'` — inconsistent with the ESM main build pipeline; any top-level await in transformed code silently breaks. Change to `format: 'esm'`.
- ⬜ No validation that compile-time defines (`PROJECT_TITLE`, `GAME_WIDTH`, `GAME_HEIGHT`, `DEBUG`) are passed before `GameBuildService.buildNow()` — a caller that omits them produces a bundle with undefined references and no warning.
- ⬜ `CLAUDE.md` says `getComponent` uses constructor function as key — actually uses a string `component.type`. Any agent reading docs before code generates wrong call patterns. Update the doc.
- ⬜ UISystem `image` component renders a grey placeholder box — no actual image loading. Needs an `ImageLoader` callback interface (defined in `@emptysock/types`) injected at construction time so the DOM implementation can be provided by game code without the engine importing DOM APIs.

---

## Nice-to-have QoL

Low-cost additions that would noticeably improve daily use:

- ⬜ Asset preview on hover in AssetBrowser — tooltip showing the image at a fixed size; zero backend work, pure UI
- ⬜ Minimap in VNEditor — a small SVG overview of the full graph in the corner; essential once a script has 30+ nodes
- ⬜ Error overlay in preview iframe — when game code throws an uncaught error, show a red banner with the stack trace instead of a silent blank canvas
- ⬜ Multi-select in SceneInspector — Shift/Ctrl+click to select multiple entities for bulk move/delete
- ⬜ SceneInspector filter/search — text input that filters entity list by name; important at 50+ entities
- ⬜ VNPreviewPanel — show visual indicator for `event` and `jump` node types instead of blank canvas (currently silent)
- ⬜ Git diff view in GitPanel — currently shows status only; inline diff of changed files
- ⬜ FPS target setting — let the game preview run at 30/60/120 fps cap; useful for mobile perf testing on desktop
- ⬜ Code snippet palette — right-click in CodeEditor to insert common patterns (create entity, add component, start coroutine, etc.)
