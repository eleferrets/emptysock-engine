# Release Pass

Cross-session task log. Before starting any work, write open items here with `[ ]`.
Mark `[x]` when done. Keep this file next to `CLAUDE.md` so it survives context compaction.

This is the canonical log — it does not live in companion repos.

Durable architectural decisions that a future agent can't read from the code belong in
`CLAUDE.md`'s "Non-obvious decisions" section, not here — that section is the permanent
record; this file is scratch space for the pass currently in flight. Clear this file
once a pass's items are all `[x]` and anything worth keeping has been migrated there.

---

## Status key

- [x] Done
- [ ] Open
- [~] Partial

---

## Current pass — open items

- [x] **Red line artifact in Code tab.** Root cause: `.dock-tabpane` (rc-dock's tab content wrapper) is `display: block`, so `CodeEditor`'s root div relying on Tailwind's `flex-1` (flex-grow) had no flex parent to grow within, and collapsed to its content height (~38px, just the file-tab bar). Monaco then mounted into a ~5px-tall container; the "red line" was the minimap's error/warning decorations rendered inside that collapsed sliver. Fixed by giving the root div `h-full` (matching the working pattern already used by `LeftSidebar`) instead of relying on inert `flex-1`. Also added `automaticLayout: true` to the Monaco options as a defensive measure for future container resizes. Verified with a screenshot: editor now renders full height with a normal vertical minimap.
- [x] **Grid/Snap/Ruler belongs per-tab, not in the global toolbar.** Removed the global pill/toggle group from `Toolbar.tsx`. Per user clarification, implemented as a small GMS2-style icon cluster pinned to the top-right corner of each relevant panel's canvas (not in the rc-dock tab title) — new shared `components/panels/shared/ViewControls.tsx`. Wired into `TilemapEditor` (also fixed grid/snap there, which were previously hardcoded `true`/ignored the store), `CanvasPreview` (replaced its redundant in-panel Grid/Rulers/Snap buttons with the shared cluster), and `UIPlacementPanel` (replaced its toolbar checkboxes). See the updated convention in `CLAUDE.md` under "IDE UI checklist (every new panel)".
- [x] **Monaco theme should track IDE light/dark mode by default.** Auto-follow was already implemented (`isDark` derived from the IDE `theme`/system preference, verified live via the theme toggle). What was missing was the explicit-override escape hatch: added `editorMonacoThemeOverride: "vs" | "vs-dark" | "hc-black" | "hc-light" | null` to `IDESettingsSchema` (default `null` = follow IDE theme), a "Monaco theme" dropdown in `SettingsModal` ("Follow IDE theme" + the four Monaco themes), and `CodeEditor` now resolves `monacoTheme` as `settings.editorMonacoThemeOverride ?? (isDark ? "vs-dark" : "vs")`.
- [ ] **Every `@emptysock/engine` call in the Code tab shows a false "Property X does not exist" / "Cannot find module" squiggle.** Root cause confirmed live (F8 → marker text) on `GameScene.ts extends Scene`: Monaco reports `TS2792: Cannot find module '@emptysock/engine'` on the import line, then treats `Scene` as an error type, so every inherited method call (`createEntity`, `addTag`, `getEntities`, ...) reports `Property 'X' does not exist on type 'GameScene'`. `apps/ide/vite.config.ts`'s `engineTypesPlugin` feeds `packages/engine/dist-types/**/*.d.ts` into Monaco as `addExtraLib` entries at `file:///node_modules/@emptysock/engine/...`, but the bundled Monaco TypeScript worker (`monaco-editor@0.56`'s `languages/features/typescript/register.d.ts`) only exposes `ModuleResolutionKind.Classic | NodeJs` — no `NodeNext`/`Bundler` — and apparently still can't resolve the bare specifier `@emptysock/engine` from extraLibs alone. Tried and **ruled out** as a full fix: (1) stripping the `.js` extensions dist-types emits on relative specifiers (necessary for Classic/NodeJs resolution, but not sufficient on its own), (2) injecting a synthetic `file:///node_modules/@emptysock/engine/package.json` extra lib with `types`/`main` pointing at `index.d.ts` (TS2792 persisted even with this in place — Monaco's extraLib virtual FS doesn't seem to feed package.json into its module-resolution probing the way a real `LanguageServiceHost.fileExists`/`readFile` would). Both attempts were reverted rather than landed half-working. Next thing to try: skip bare-specifier resolution entirely — synthesize one flattened `declare module "@emptysock/engine" { ... }` ambient block (a known-reliable pattern for Monaco) instead of relying on relative-file + package.json resolution, since Monaco's extraLibs mechanism is designed for ambient globals/module blocks, not for emulating a real `node_modules` layout.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.
