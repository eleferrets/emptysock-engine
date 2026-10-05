# IDE Tour

The IDE is a dockable, rearrangeable panel environment. Every panel is a tab inside a `DockLayout`. Drag a tab's header to move it, drag to a panel edge to split, or drag it out to the desktop area to float it.

This page is an orientation, it covers what each panel does. For the full panel reference, see [Building and Exporting](../guides/building-and-exporting.md) and the detailed sections below.

---

## Keyboard shortcuts

| Shortcut                         | Action                                |
| -------------------------------- | ------------------------------------- |
| `Ctrl+Enter`                     | Play / Stop                           |
| `Ctrl+S`                         | Save current file                     |
| `Ctrl+Z` / `Ctrl+Y`              | Undo / Redo in Monaco                 |
| `Ctrl+Shift+F`                   | Format document (Prettier via Monaco) |
| `F2`                             | Rename symbol under cursor            |
| `Ctrl+Click`                     | Go to definition                      |
| `Ctrl+Enter` (in Git commit box) | Commit                                |
| `Esc` (in Localisation cell)     | Discard cell edit                     |
| `Enter` (in Localisation cell)   | Commit cell edit                      |

---

## Code Editor

Powered by Monaco (the same editor as VS Code). TypeScript language services run in-browser via the Monaco TypeScript worker.

- **Multi-file tabs:** All open files appear as tabs above the editor. Click to switch, click the × to close.
- **Virtual filesystem:** Relative imports between open files resolve through the in-browser module graph — no bundler server required.
- **Font:** JetBrains Mono is bundled.

---

## Canvas Preview

The sandboxed iframe that runs your compiled game. Press `Ctrl+Enter` or the Play button to build and run.

- `fps`, `frametime`, `draws` messages feed the Profiler panel.
- `log` / `error` messages appear in the Console panel.
- `ready` fires when the scene's `onLoad()` resolves.

If the WebGL context crashes, the ErrorBoundary shows a recovery button instead of crashing the IDE.

---

## Files Panel

Shows the virtual project file tree. Click a file to open it in the Code Editor. Files created here are held in-memory until you export the project.

---

## Inspector Panel

Shows the properties of the selected entity or scene. Entity properties are editable as key-value pairs.

---

## Tilemap Editor

A canvas-based tile painter for building 2D Tilemaps.

- **Palette** (left): click a color to select the active tile.
- **Tools** (toolbar): paintbrush, eraser, flood fill.
- **Layers**: add layers, click to select the active layer. Layers are drawn bottom-to-top.
- **Zoom slider**: 0.25× to 4×.

Export the Tilemap as `.esmap` JSON to use with `TilemapSystem.load()` at runtime.

---

## Particle Editor

Live particle system preview with editable emitter parameters. Export settings as JSON to pass directly to `addComponent(ParticleSystem, config)`.

---

## Story Graph

An SVG-based node graph editor for branching dialogue trees. Open via **Module → Story Graph**.

**Node types:** Dialogue, Choice, Condition.

**Canvas controls:**

| Action        | Input                                                |
| ------------- | ---------------------------------------------------- |
| Pan           | Middle-click drag, Space + drag, or two-finger swipe |
| Zoom          | Scroll wheel or pinch                                |
| Move node     | Drag the node's header bar                           |
| Connect nodes | Drag from an output port to an input port            |
| Edit node     | Double-click the node body                           |
| Delete node   | Select then press `Delete`                           |

Export via **Export JSON** in the toolbar. Load at runtime with `VNSystem`.

---

## Audio Mixer

Volume, mute, and solo controls for audio bus groups. Changes apply in real time.

**Default buses:** Master, Music, SFX, Voice, Ambient.

---

## Profiler

Frame-time bar chart updated every frame while the game is playing.

- Green: < 16.7 ms (above 60 fps)
- Yellow: 16.7–33.3 ms (30–60 fps)
- Red: > 33.3 ms (below 30 fps)

---

## Localisation Editor

Spreadsheet-style table for managing translation strings. Columns: `key` + one column per locale.

- Click any cell to edit inline. Press `Enter` or click away to commit, `Esc` to discard.
- **CSV import/export:** Expects a header row `key,en,fr,...`.

---

## Git Panel

Lightweight git commit helper. **Tauri desktop only** — shows placeholder UI in browser mode.

Shows staged and unstaged files with status indicators. Click **+** to stage, **-** to unstage, type a commit message, and click **Commit**.

---

## Visual Script Editor

A node graph panel for wiring component logic without writing TypeScript. Open via **View → Panels → Visual Script Editor**.

Saved as `.esvs` files. Referenced at runtime via `VisualScriptComponent`.

> **Note:** Visual scripts run through a graph interpreter, so expect roughly 10× slower execution than native TypeScript for heavy per-frame computation. Reach for TypeScript when performance actually matters.

---

## Sequence Editor

A keyframe timeline panel for authoring animation sequences and cutscenes. Open via **View → Panels → Sequence Editor**.

Export as `.esseq` and load with `SequencePlayer.load()`.

---

## Settings

Open via **IDE → Settings** or the gear icon.

- **Power Saver mode:** Throttles the Canvas Preview to 30 fps when unfocused, reducing battery drain.
- **Download Engine** (web version only): Downloads the current engine bundle as a `.js` file.

---

## Mobile and Tablet Layout

When the IDE loads in a browser narrower than 1024 px, it switches to a compact layout:

- **Phone (< 768 px):** Bottom navigation bar with Code, Scene, Files, Console tabs.
- **Tablet (768–1023 px):** Left column for file browser, right column for Code/Preview/Console.

Touch input in the preview iframe is handled natively by `InputSystem` — no configuration needed.

---

Next: [Engine Overview](./engine-overview.md) — the ECS core and module packages.
