# EmptySock QoL Pass

Status markers: ✅ done · ⬜ todo · 🔴 blocked · 🔍 verify

---

## UI & Scene

- ✅ **[P2]** Debugger integration — breakpoints + variable inspector in preview  
  Log-based step debugger in ConsolePanel: `Engine.debugBreak(label, vars)`, pause/resume/step controls, variable inspector tab. Fully implemented in `ConsolePanel.tsx` and `EngineAPI.ts`.

- ✅ **[P2]** Turn-based battle system module  
  Party vs enemy encounter, action menu, formula damage from database, status effects. Opt-in module flag.

---

## Undo / Redo

- ✅ AutoTileRulesModal — rule add/edit/delete with undo/redo fully implemented (`AutoTileRulesModal.tsx`, uses `useHistory<RuleSets>`).

---

## TypeScript config hardening

- ✅ `"noPropertyAccessFromIndexSignature": true` — enabled in `tsconfig.base.json`
- ✅ `"declaration": true` + `"declarationMap": true` on engine + types packages — enabled in `packages/engine/tsconfig.json`
- ✅ `"stripInternal": true` on packages/engine — enabled in `packages/engine/tsconfig.json`

---

## Vite config improvements

- ✅ `build.cssCodeSplit: false` — set in `apps/ide/vite.config.ts`
- ✅ `build.sourcemap: false` explicit in production — set in `apps/ide/vite.config.ts`

---

## ESLint / code quality

- ✅ Unit tests for `ideStore.ts`, `GameBuildService.ts`, `editorGrid.ts` — all three exist with real test suites under `apps/ide/src/__tests__/`
- ✅ React `<ErrorBoundary>` per panel tab — `makeTab()` wraps every panel in `PanelErrorBoundary` + `ErrorBoundary`
- ✅ `pnpm catalog` for dependency version consistency — `pnpm-workspace.yaml` has catalog section; core shared packages (typescript, vitest, zod, pixi.js, konva, react-konva) pinned

---

## Architectural debt still open

- ✅ CGGallery uses `SaveSystem` with dummy fields — panel created with `VariableStore`-backed unlock tracking (switch key `cg_<id>`)
- ✅ SequenceEditor track types — expression, audio, wait lane editors implemented with dedicated value UIs
- ✅ `UISystem` `image` component renders grey placeholder — `setImageLoader(loader)` method added to singleton; inject at game init
- ✅ `CLAUDE.md` says `getComponent` uses constructor as key — doc already correct (uses `component.type` string)
- ✅ Asset preview on hover in AssetBrowser — `AssetPreviewPopover` fully implemented with per-type previews
- ✅ Minimap in VNEditor — canvas-based minimap at bottom-right, click/drag to pan
- ✅ Multi-select in SceneInspector (Shift/Ctrl+click) — range-select and toggle fully implemented
- ✅ SceneInspector filter/search by entity name — filter input with flat-list fallback and empty state
- ✅ Git diff view in GitPanel — inline colored diff view per file, toggle per row
- ✅ Code snippet palette in CodeEditor (right-click insert) — 8 built-in snippets, toolbar button + Monaco right-click menu

---

## Autosave / project persistence

- ✅ `recentAssetIds`, `roomOrder`, `openFiles`, `activeFilePath` added to `saveProjectJson()`
- ✅ `loadProjectFiles()` restores all four fields from project JSON (falls back to passed code files for `openFiles`)
- ✅ localStorage autosave subscriber — `useAutosave()` hook, debounced 2.5 s, wired in `App.tsx`
- ✅ Startup restore check — autosave banner in `App.tsx` via `offerRestore()` / `applyRestore()`
- ✅ Browser `showSaveFilePicker` on Ctrl+S — implemented in `MenuBar.tsx` via `BrowserFileService`
- 🔴 Tauri `write_project_file` command — no `src-tauri/` in this repo; implement in the Tauri app package when added

---

## Next priorities (suggested order)

All items resolved. Tauri desktop autosave requires the Rust backend to be added to the repo first.
