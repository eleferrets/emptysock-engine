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

## Autosave / project persistence

Two-tier plan: localStorage crash buffer (always) + file system save (explicit Ctrl+S and silent autosave on desktop).

### What needs to be saved (gaps vs current `saveProjectJson`)

`saveProjectJson()` already captures most domain state. Missing fields that must be added:

- `recentAssetIds` — project-scoped, lives in store
- `roomOrder` — project-scoped, lives in store
- `openFiles` — the full `Record<string, string>` of editor tab contents (needed to restore open tabs)
- `activeFilePath` — which tab was active

### Load path gap

`loadProjectFiles()` currently expects a flat `Record<string, string>` of file contents. There is no `loadProjectJson()` inverse that accepts the envelope `saveProjectJson()` produces. This needs to be written before autosave is useful — otherwise you can save but not restore.

### Save targets

**localStorage (both browser and desktop)** — autosave crash buffer.

```ts
// Debounced Zustand subscription — fires ~2–3 s after last change
useIDEStore.subscribe(
  (s) => s, // or a shallow selector of the fields that matter
  debounce(() => {
    localStorage.setItem(
      "es-autosave",
      useIDEStore.getState().saveProjectJson(),
    );
    localStorage.setItem("es-autosave-at", String(Date.now()));
  }, 2500),
);
```

On startup: if `es-autosave` exists and is newer than the last explicit save timestamp, offer to restore.

**Browser (File System Access API)** — explicit save only, re-used within session.

```ts
// First Ctrl+S: prompt for location
const handle = await window.showSaveFilePicker({
  suggestedName: "emptysock.project.json",
});
// Store handle in a module-level ref (not the store — not serialisable)
// Subsequent saves: write without prompting
const writable = await handle.createWritable();
await writable.write(saveProjectJson());
await writable.close();
```

Handle is lost on page reload — user must re-pick next session.

**Desktop (Tauri)** — silent autosave to disk after first save dialog.

- Add a Tauri command: `write_project_file(path: String, content: String) -> Result<(), String>`
- Gate with `'__TAURI_INTERNALS__' in window` at call site (existing pattern)
- Store the chosen path in `ideStore.projectFolder` (already exists)
- After first dialog sets `projectFolder`, autosave writes `{projectFolder}/emptysock.project.json` silently

### Implementation order

1. Add `recentAssetIds`, `roomOrder`, `openFiles`, `activeFilePath` to `saveProjectJson()`
2. Write `loadProjectJson(raw: string): void` — inverse of save, calls `set()` with validated fields
3. Wire localStorage autosave subscriber (debounced ~2.5 s)
4. Add startup restore check (offer if autosave is newer than last explicit save)
5. Add browser `showSaveFilePicker` on Ctrl+S
6. Add Tauri `write_project_file` command + silent autosave on desktop

---

## Next priorities (suggested order)

1. **React ErrorBoundary per panel** — highest leverage safety net; one file, low risk
2. **`declaration: true` + `declarationMap: true`** on engine + types — unblocks external consumers and IDE go-to-definition
3. **AutoTileRulesModal undo/redo** — last panel missing history; implement modal first if not yet done
4. **CGGallery → VariableStore migration** — removes the corrupted-save-file appearance in gallery listings
5. **SceneInspector search/filter** — becomes painful at 30+ entities; pure UI, no store changes
6. **Unit tests for ideStore, GameBuildService, editorGrid** — these are the highest-risk untested files
