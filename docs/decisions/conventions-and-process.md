## Canonical terms

All documentation, skill files, and agent prompts must use the canonical spelling from [`docs/glossary.md`](docs/glossary.md). That file lists every term with its deprecated aliases and a one-line definition. Key points:

- `ActorSystem` — one word, never "Actor System"
- `NavMeshSystem` / `NavMesh` — capital M, never "navmesh" or "Navmesh"
- `PluginSystem` — one word; a `Game` service (`game.services.get(PluginSystem)` / `ctx.plugins`), not a module-level singleton
- `Story Graph` — two words with spaces; the runtime is `VNSystem` (not "VN System"); the deprecated panel name "VN Graph" must not appear in new docs
- `VisualScriptState`/`VisualScriptSystem` — the Visual Script Editor panel authors a `VisualScriptGraph`; the panel label "Visual Script Editor" uses spaces only in prose, not in class names
- `Tilemap` — one word, capital T; not "TileMap" or "tile map"
- `Localisation` — British spelling throughout; never "Localization"
- `esbuild` — all lowercase, one word; never "ESBuild" or "Esbuild"

---

## Between-session task tracking

`RELEASE_PASS.md` (next to this file) is the canonical task checklist for work that spans agent sessions. Before starting any multi-step pass, write open items there with `[ ]` so context compaction cannot lose them. Mark `[x]` when done. Do not duplicate it in companion repos. `RELEASE_PASS.md` is a dated, cross-session scratch log, not a decision record — unlike this file, it keeps its dates, checkpoints, and historical framing.

---

## Conventions

**Commits** follow the Conventional Commits spec, enforced by Husky and commitlint. The format is `type(scope): subject`. Valid types: feat, fix, docs, chore, refactor, test, perf, ci. Never bypass the hook with `--no-verify`; it also runs lint-staged (ESLint + Prettier), so bypassing it leaves unformatted code in git.

**File placement:** engine systems go in `packages/engine/src/systems/`, engine core primitives directly in `packages/engine/src/`, IDE panels in `apps/ide/src/components/panels/`. New exports from the engine must be re-exported from `packages/engine/src/index.ts`.

**Adding a new engine system:** create the file, export from `packages/engine/src/index.ts`, add an entry to `ai/api-reference.json` in `eleferrets/emptysock-ai-skills`, add a page under `docs/reference/systems/`, add a row to `docs/reference/index.md`, add a section to `docs/manual/05-systems-reference.md`, and add a skill file to `eleferrets/emptysock-ai-skills`. All five locations in a single commit — never land a new system without docs.

**Adding a new IDE panel:** create the component file, add a makeTab entry to DEFAULT_LAYOUT in App.tsx, document it in docs/manual/07-ide-reference.md. If the panel needs store state, use useIDEStore — never local useState that other panels cannot read.

**Keeping docs in sync with engine changes:** any commit that adds, removes, or changes a public engine API must also update the corresponding page in `docs/manual/` (offline manual source) and `docs/reference/` (the Ctrl+F reference). Method signature changes update the reference page. Behaviour changes update both. Never merge an engine change that leaves the docs describing the old shape.

**Undo / redo is mandatory in every panel that mutates editor data.** Use a shared `useHistory<T>` hook that snapshots state before each mutation and exposes `undo()` / `redo()` / `canUndo` / `canRedo`. Wire `Ctrl+Z` / `Ctrl+Shift+Z` globally. Cap history at 50 steps per panel (session-only, never persisted). Monaco has its own per-file undo stack — do not replace it. Every panel added going forward must ship with undo/redo on day one, not as a follow-up.

**Naming:** TypeScript files use PascalCase for classes and camelCase for modules. Tauri commands in lib.rs use snake_case. CSS variables use the `--es-` prefix to avoid collisions with third-party stylesheets.

**Versioning:** the monorepo uses [changesets](https://github.com/changesets/changesets) (`.changeset/`) to track package version bumps. Run `pnpm changeset` when your PR changes a published package's public behavior, following the prompts to pick a bump type and write a summary. `apps/ide` is excluded (it's an app, not a published package). All packages are currently `private: true`, so `access: restricted` is the default in `.changeset/config.json` until one is actually published to npm.

---

## IDE UI checklist (every new panel)

- **CSS variables only.** Never hardcode colors for surrounding UI (backgrounds, borders, text, header bars). Canvas drawing (WebGL previews, profiler charts) may use semantic hex values for clarity. The IDE supports light and dark themes; hardcoded hex colors will break in light mode.
- **Empty states.** Every list, table, or grid must show a helpful message when empty — not a blank box. The message should tell the user what to do next (e.g., "No assets yet — drag files here or click Upload."). Search results with no matches need a separate "No results" message, not silence.
- **Conditional UI.** A control tied to absent data must not render as a broken/empty element. For example, a `<select>` with no `<option>` elements must be hidden, not shown as an empty picker.
- **Action hint copy.** Instructional text in a panel should be an action ("Click the canvas to place a component") not a state description when the user has nothing yet ("placed: 0 components").
- **commitlint subject-case.** The commitlint `subject-case` rule rejects any uppercase letter in the commit subject, including camelCase or PascalCase identifiers. Rewrite them lowercase (e.g., `outDir` → `outdir`, `ES2025` → `es2025`) or rephrase around them. Test with `echo "type(scope): subject" | npx commitlint` before committing.
- **Tool-specific controls (grid/snap/ruler and similar) live on the tab, not the global toolbar.** Concepts that only apply to some editors — grid, snap, ruler, and anything else scoped to a specific tool rather than the whole IDE — must not be added as global buttons in the top toolbar next to Debug/Export/theme. Render them as a small icon with a tooltip, placed inline next to that tab's name, and only on the tabs/tools that actually use the concept (e.g. grid/snap/ruler belong on the Tilemap editor, the Room/Scene editor, and the UI editor — not on the Code tab or the Console). The top toolbar is for IDE-wide actions; a control that only means something in one panel does not belong there even if it would be convenient to have visible at all times.

---

## Personality

The IDE has a voice: dry, a little self-aware, never annoying. Think a senior dev who's seen things but still enjoys the work. Use it in:

- **Empty-state quips** — idle panels with nothing to show can rotate through a short array of sardonic one-liners picked at `useRef` initialisation (so the quip is stable for the session but varies across opens). Keep the array to 8–12 entries. Tone: deadpan, observational, never cute-overload. Good: `"All quiet. Your game is probably fine."` / `"Zero logs. Zero regrets. Probably."`. Bad: `"Wow, so empty! Let's fill it up! 🎉"`.
- **Status / feedback copy** — build success doesn't need to shout. `"Built in 340 ms."` beats `"✅ Build successful!"`. Error states can acknowledge the pain briefly: `"Something broke. Check above."`.
- **Tooltips and placeholder text** — a tooltip on the Clear button can just say `"Clear"`. A placeholder in a search field can say `"Filter assets…"` rather than `"Search for an asset by name"`.

Rules:

- One quip array per panel maximum. Don't force it into every surface.
- Never use the personality to bury useful information. The quip sits _beneath_ the functional hint, or replaces a purely generic message. If there's a real action to communicate, say it plainly first.
- No exclamation marks in quips. No emoji unless it's a single, well-chosen one in a serious context (e.g., a skull ☠ on a crash panel).
- Keep every quip under 60 characters so it fits on one line at panel width.

