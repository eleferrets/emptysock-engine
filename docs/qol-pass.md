# EmptySock QoL Pass

Status markers: ✅ done · ⬜ todo · 🔴 blocked · 🔍 verify

> **Handoff note — read before continuing.** This file is the living backlog for the QoL pass that ran across sessions. All branches have been merged into `main` on all three repos (`emptysock-engine`, `emptysock-ai-skills`, `emptysock-mcp`). The section at the bottom of this file lists what the next agent should verify before picking up new work.

---

## UI & Scene

- ✅ Alignment guides in scene editor  
  `apps/ide/src/lib/editorGrid.ts`: `drawGrid`, `drawRulers` (adaptive ticks, scroll+zoom-aware), `drawGuides`, `snapToGrid`, `computeAlignmentGuides`. Wired into UIPlacementPanel, TilemapEditor, VNEditor, CanvasPreview.

- ✅ Error overlay in preview iframe  
  `CanvasPreview.tsx` shows a red banner with message + stack when game code throws. `RunnerMessage` extended with `"game-error"` type and `stack?: string`. Overlay dismissible.

- ✅ FPS target setting  
  `CanvasPreview.tsx` FPS selector (Unlimited / 30 / 60 / 120). `PlayRunner` sends `set-fps-cap` message to iframe; iframe patches `requestAnimationFrame` to throttle accordingly.

- ✅ VNPreviewPanel  
  `apps/ide/src/components/panels/VNPreviewPanel.tsx` added — renders the selected node's dialogue with speaker name, avatar placeholder, and choice buttons.

- ⬜ **[P2]** Debugger integration — breakpoints + variable inspector in preview  
  iframe DevTools protocol bridge or log-based step debugger in ConsolePanel.

- ⬜ **[P2]** Turn-based battle system module  
  Party vs enemy encounter, action menu, formula damage from database, status effects. Opt-in module flag.

---

## Undo / Redo

Shared `useHistory<T>` hook: `apps/ide/src/hooks/useHistory.ts`. 50-step cap, session-only, functional updater supported (`set(prev => next)`). `Ctrl+Z` / `Ctrl+Shift+Z` wired per-panel.

- ✅ TilemapEditor — paint, erase, fill, flood-fill, layer add/remove/reorder
- ✅ VNEditor (Story Graph) — node add/move/delete, edge add/delete, node content edits
- ✅ UIPlacementPanel — component place, move, delete
- ✅ SequenceEditor — keyframe add/move/delete, track add/delete, value edits
- ✅ LocalisationEditor — key add/edit/delete, locale add/remove
- ✅ DatabaseEditor — row add/edit/delete across all four tables
- ✅ VariablesPanel — variable/switch add/edit/delete
- ✅ EntityProperties — transform edits, component add/delete
- ✅ SceneInspector — entity add/delete/reorder
- ✅ ParticleEditor — emitter config changes (pointer-up batched; RAF-decoupled live preview)
- ✅ ShaderEditor — vertex/fragment source edits (distinct from Monaco's built-in per-file stack)
- ⬜ AutoTileRulesModal — rule add/edit/delete (modal not yet implemented)

---

## TypeScript config hardening

### Target / lib

- ✅ `"target": "ES2025"` and `"lib": ["ES2025"]` across all packages and `apps/ide`  
  ES2026 was attempted but rejected by the installed `tsc` binary (TypeScript 6.0.3 CLI enumerates targets only up to ES2025). ES2025 is the current maximum. Revisit when tsc supports ES2026.
- ✅ `"noImplicitOverride": true` — all packages
- ✅ `"noImplicitReturns": true` — all packages
- ✅ `"allowUnreachableCode": false` — all packages
- ✅ `"allowUnusedLabels": false` — all packages
- ✅ `"forceConsistentCasingInFileNames": true` — all packages
- ✅ `"exactOptionalPropertyTypes": true` — apps/ide, packages/engine
- ✅ `"verbatimModuleSyntax": true` — all packages
- ✅ `"moduleDetection": "force"` — apps/ide
- ✅ `"isolatedModules": true` — apps/ide

- 🔍 `"noUncheckedIndexedAccess": true` — applied to tsconfigs but verify zero remaining errors; the engine had ~20 expected fixups. Run `pnpm --filter @emptysock/engine tsc --noEmit` and confirm clean.
- ⬜ `"noPropertyAccessFromIndexSignature": true` — not yet enabled; low priority
- ⬜ `"declaration": true` + `"declarationMap": true` on engine + types packages — needed for IDE go-to-definition to land in source
- ⬜ `"stripInternal": true` on packages/engine — removes `@internal` JSDoc from emitted `.d.ts`

---

## Vite config improvements

- ✅ `build.target: 'es2025'` and `esbuild.target: 'es2025'`
- ✅ `css.lightningcss: true` — PostCSS dropped, `postcss.config.js` deleted
- ✅ `optimizeDeps.exclude: ['@tauri-apps/api', 'monaco-editor']`
- ✅ `build.modulePreload: { polyfill: false }`
- ✅ `build.reportCompressedSize: false`
- ✅ `server.warmup` for App.tsx, ideStore.ts, editorGrid.ts
- ✅ `worker.format: 'es'`
- ✅ `rollup-plugin-visualizer` wired (`stats.html`, `open: false`)
- ✅ `@/` path alias for `src/`
- ⬜ `build.cssCodeSplit: false` — not yet set; low priority
- ⬜ `build.sourcemap: false` explicit in production — not yet verified

---

## Dynamic imports

- ✅ `@tauri-apps/api` excluded from `optimizeDeps`
- ✅ `MobileLayout.tsx` — `React.lazy()` calls moved to module scope
- ✅ `GameBuildService.transformOnly()` — changed from `format: 'iife'` to `format: 'esm'`
- ✅ `GameBuildService.buildNow()` — `validateDefines()` guard added; warns on missing compile-time defines

---

## AudioMixer bridge

- ✅ IDE mixer sends `es-audio-bus` postMessage to preview iframe; iframe routes to `AudioSystem.setBusVolume`  
  Previously volume changes had zero effect on in-game sounds.

---

## New panels / systems added this pass

- ✅ `DatabaseEditor.tsx` — four-table RPG database (Items, Skills, Enemies, Classes)
- ✅ `UIPlacementPanel.tsx` — drag-and-drop UI component layout with snap grid
- ✅ `VNPreviewPanel.tsx` — live dialogue preview for selected VN node
- ✅ `VariablesPanel.tsx` — global variables and switches editor
- ✅ `MobileLayout.tsx` — full mobile/tablet layout with bottom sheet panels
- ✅ `AutoTileSystem.ts` — 47-tile Wang-set autotile rule engine
- ✅ `CGGallery.ts` — CG/illustration gallery system
- ✅ `CharacterStage.ts` — character sprite positioning and expression system
- ✅ `MapEventSystem.ts` — tile-triggered event system (touch, interact, autorun)
- ✅ `VNBackgroundLayer.ts` — parallax background management for VN scenes
- ✅ `VNScriptConvert.ts` — plain-text screenplay → VNSystem node graph converter
- ✅ `VNTextbox.ts` — dialogue rendering with typewriter effect and rich text
- ✅ `VariableStore.ts` — global boolean switches + numeric variables with persistence
- ✅ `GridMovementBehavior.ts` — tile-aligned movement behavior
- ✅ Skills 11–15 in `emptysock-ai-skills` (UISystem, VNTextbox, VariableStore, CharacterStage, MapEvents)
- ✅ MCP tools: `particle_*`, `vn_*` in `emptysock-mcp`

---

## ESLint / code quality

- ✅ `@typescript-eslint/no-floating-promises` — enabled, `MapEventSystem.ts` fixed
- ✅ `@typescript-eslint/consistent-type-imports` — enabled, type-only imports converted across 6 engine files
- ✅ `@typescript-eslint/no-unnecessary-condition` — enabled; redundant guards removed across engine, toolchain, IDE
- ✅ `vite-env.d.ts` added (`/// <reference types="vite/client" />`) — fixes CSS import TS error in App.tsx
- 🔍 `typecheck: true` in Vitest config — added to `apps/ide/vitest.config.ts`; verify it runs cleanly (`pnpm --filter ide test --run`)
- ⬜ Unit tests for `ideStore.ts`, `GameBuildService.ts`, `editorGrid.ts` — not yet written
- ⬜ React `<ErrorBoundary>` per panel tab — not yet added; one panel crash currently kills the whole IDE
- ⬜ `pnpm catalog` for dependency version consistency

---

## Architectural debt still open

- ⬜ CGGallery uses `SaveSystem` with dummy fields — migrate to `VariableStore`
- ⬜ SequenceEditor track types are generic numeric keyframes, not VN/RPG dialogue lanes — rename panel or add lane types
- ⬜ `UISystem` `image` component renders grey placeholder — needs `ImageLoader` callback interface injected at construction
- ⬜ `CLAUDE.md` says `getComponent` uses constructor as key — actually uses `component.type` string. Update the doc.
- ⬜ Asset preview on hover in AssetBrowser
- ⬜ Minimap in VNEditor
- ⬜ Multi-select in SceneInspector (Shift/Ctrl+click)
- ⬜ SceneInspector filter/search by entity name
- ⬜ Git diff view in GitPanel (currently status-only)
- ⬜ Code snippet palette in CodeEditor (right-click insert)

---

## Handoff — verify before continuing

The next agent should run through this checklist before picking up new work. Each item is a quick check that the session's changes are actually wired up correctly.

### 1. Type-check all packages

```bash
cd /home/user/emptysock-engine
pnpm --filter @emptysock/engine tsc --noEmit
pnpm --filter @emptysock/toolchain tsc --noEmit
pnpm --filter @emptysock/types tsc --noEmit
pnpm --filter ide tsc --noEmit
```

All four must exit 0. If `noUncheckedIndexedAccess` introduced new errors in engine or toolchain they will show here.

### 2. Engine tests

```bash
pnpm --filter @emptysock/engine test --run
```

Expect 143 tests across 28 files, all passing. Any failures indicate a regression from the ES2025 target upgrade or the strict-TS fixes.

### 3. IDE type check specifically

```bash
pnpm --filter ide exec tsc --noEmit
```

Known pre-existing issue: `CodeEditor.tsx` references `SNIPPETS` which was mentioned by the ES2026 agent as missing — verify whether this is now fixed or still outstanding.

### 4. Toolbar.tsx build-status pill

`apps/ide/src/components/panels/Toolbar.tsx` — the `BuildStatusPill` function. Verify it has the correct structure: three early `return` branches (`idle → null`, `building → yellow pill`, `success → green pill`) followed by a final `return` for the error button. The `if (buildStatus === "error")` guard was removed, leaving `return null` unreachable; a subsequent commit removed that `return null`. Check the file ends cleanly with no dead code.

### 5. RunnerMessage type

`apps/ide/src/services/PlayRunner.ts` — confirm `RunnerMessage.type` includes `"game-error"` and that `stack?: string` is present. The iframe HTML in the same file only posts `type: "error"` (not `"game-error"`), so both branches in `CanvasPreview.tsx` are semantically equivalent — this is intentional, keeping the door open for structured game-level error events.

### 6. ParticleEditor liveConfig

`apps/ide/src/components/panels/ParticleEditor.tsx` — the UX agent found that `liveConfig` and `setLiveConfig` were used in JSX but undeclared. Verify the file now has `const [liveConfig, setLiveConfig] = React.useState<EmitterConfig>(DEFAULT_CONFIG)` and that `canUndo` / `canRedo` are destructured from `useHistory`.

### 7. useHistory functional updater

`apps/ide/src/hooks/useHistory.ts` — `set` signature must be `(next: T | ((prev: T) => T)) => void`. Confirm the implementation uses `typeof next === "function"` to branch.

### 8. MobileLayout lazy import

`apps/ide/src/components/MobileLayout.tsx` — `LazyCanvasPreview` must be declared at module scope (outside any component function). Grep for `React.lazy` inside the file and confirm it appears before the first function/component definition.

### 9. All branches merged to main

All three repos should have `main` as the only active branch:

```bash
# emptysock-engine
git -C /home/user/emptysock-engine branch -r | grep -v 'main\|HEAD'

# emptysock-ai-skills
git -C /home/user/emptysock-ai-skills branch -r | grep -v 'main\|HEAD'

# emptysock-mcp
git -C /home/user/emptysock-mcp branch -r | grep -v 'main\|HEAD'
```

The remote branches `claude/*` will still exist on the remote until explicitly deleted — that is fine. What matters is that `main` on all three repos contains the commits from all merged branches.

### 10. qol-pass.md is up to date

This file. Verify that the status markers reflect reality before marking any `⬜` item as done or starting a new one.

---

## Next priorities (suggested order)

1. **React ErrorBoundary per panel** — highest leverage safety net; one file, low risk
2. **`declaration: true` + `declarationMap: true`** on engine + types — unblocks external consumers and IDE go-to-definition
3. **AutoTileRulesModal undo/redo** — last panel missing history; implement modal first if not yet done
4. **CGGallery → VariableStore migration** — removes the corrupted-save-file appearance in gallery listings
5. **SceneInspector search/filter** — becomes painful at 30+ entities; pure UI, no store changes
6. **Unit tests for ideStore, GameBuildService, editorGrid** — these are the highest-risk untested files
