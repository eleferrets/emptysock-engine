# EmptySock QoL Pass

Status markers: ✅ done · ⬜ todo · 🔴 blocked · 🔍 verify

---

## UI & Scene

- ⬜ **[P2]** Debugger integration — breakpoints + variable inspector in preview  
  iframe DevTools protocol bridge or log-based step debugger in ConsolePanel.

- ⬜ **[P2]** Turn-based battle system module  
  Party vs enemy encounter, action menu, formula damage from database, status effects. Opt-in module flag.

---

## Undo / Redo

- ⬜ AutoTileRulesModal — rule add/edit/delete (modal not yet implemented)

---

## TypeScript config hardening

- ⬜ `"noPropertyAccessFromIndexSignature": true` — not yet enabled; low priority
- ⬜ `"declaration": true` + `"declarationMap": true` on engine + types packages — needed for IDE go-to-definition to land in source
- ⬜ `"stripInternal": true` on packages/engine — removes `@internal` JSDoc from emitted `.d.ts`

---

## Vite config improvements

- ⬜ `build.cssCodeSplit: false` — not yet set; low priority
- ⬜ `build.sourcemap: false` explicit in production — not yet verified

---

## ESLint / code quality

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

## Next priorities (suggested order)

1. **React ErrorBoundary per panel** — highest leverage safety net; one file, low risk
2. **`declaration: true` + `declarationMap: true`** on engine + types — unblocks external consumers and IDE go-to-definition
3. **AutoTileRulesModal undo/redo** — last panel missing history; implement modal first if not yet done
4. **CGGallery → VariableStore migration** — removes the corrupted-save-file appearance in gallery listings
5. **SceneInspector search/filter** — becomes painful at 30+ entities; pure UI, no store changes
6. **Unit tests for ideStore, GameBuildService, editorGrid** — these are the highest-risk untested files
