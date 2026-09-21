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

- [ ] **Red line artifact in Code tab.** A thin red horizontal bar renders under the tab strip in the IDE's Code tab, near the `{}` icon area. Cause unknown — not yet investigated. Reproduce, find the source (likely a Monaco decoration, a CSS border/underline leaking from a diagnostics marker, or a stray element in the tab header), and fix.
- [ ] **Grid/Snap/Ruler belongs per-tab, not in the global toolbar.** Currently these are global pill/toggle buttons in the IDE's top toolbar, next to Debug/Export/theme controls. Remove that global instance entirely. Reimplement as small icon+tooltip controls placed inline next to the tab name, shown only on tabs/tools that actually use grid/snap/ruler concepts — at minimum the Tilemap editor, the Room/Scene editor, and the UI editor. See the new convention added to `CLAUDE.md` under "IDE UI checklist (every new panel)".
- [ ] **Monaco theme should track IDE light/dark mode by default.** Right now Monaco's editor theme is independent of the IDE's `data-theme` (it stayed dark in both light and dark IDE screenshots). Default behaviour should be: Monaco follows the IDE's light/dark mode automatically. If the user explicitly picks a specific Monaco theme themselves, that explicit choice should stick and stop auto-following. Design problem not yet solved: need a stored preference that distinguishes "user never touched Monaco theme (follow IDE theme)" from "user explicitly set a Monaco theme (keep it)" — e.g. a `monacoThemeOverride: string | null` in the IDE store, only set when the user picks a theme through an explicit UI action, with the default renderer picking `vs`/`vs-dark` (or custom equivalents) from `data-theme` whenever it's `null`.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.
