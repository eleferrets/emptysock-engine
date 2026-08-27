# 7 — IDE Reference

The IDE is a dockable, rearrangeable panel environment. All panels are tabs inside a `DockLayout` (rc-dock). Drag a tab's header to move it, drag to a panel edge to split, or drag to the desktop area to float it.

---

## 7.1 Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Play / Stop |
| `Ctrl+S` | Save current file |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo in Monaco |
| `Ctrl+Shift+F` | Format document (Prettier via Monaco) |
| `F2` | Rename symbol under cursor |
| `Ctrl+Click` | Go to definition |
| `Ctrl+Enter` (in Git commit box) | Commit |
| `Esc` (in Localisation cell) | Discard cell edit |
| `Enter` (in Localisation cell) | Commit cell edit |

---

## 7.2 Code Editor

Powered by Monaco (the same editor as VS Code). TypeScript language services run in-browser via the Monaco TypeScript worker.

**Multi-file tabs:** All open files appear as tabs above the editor. Click to switch, click the × to close. The active file is compiled by the build service.

**Virtual filesystem:** Relative imports between open files resolve through the in-browser module graph — no bundler server required.

**Font:** JetBrains Mono is bundled. All editor text uses it by default.

---

## 7.3 Canvas Preview

The sandboxed iframe that runs your compiled game. It receives the compiled IIFE bundle via Blob URL and communicates back via `postMessage`.

- `fps`, `frametime`, `draws` messages feed the Profiler.
- `log` / `error` messages appear in the Console panel.
- `ready` fires when the scene's `onLoad()` resolves.

If the WebGL context crashes, the ErrorBoundary wrapping the canvas shows a recovery button instead of crashing the entire IDE.

---

## 7.4 Files Panel

Shows the virtual project file tree. Click a file to open it in the Code Editor. Files created here are held in the IDE store's `openFiles` map — they are in-memory until you export the project.

---

## 7.5 Inspector Panel

Shows the properties of the selected entity or scene. In the current version, entity properties are editable as key-value pairs. Future: full component introspection with type-aware controls.

---

## 7.6 TilemapEditor

A canvas-based tile painter for building 2D tilemaps.

**Controls:**
- **Palette** (left): click a color to select the active tile.
- **Tools** (toolbar): paintbrush, eraser, flood fill.
- **Layers** (toolbar): add layers, click to select the active layer. Layers are drawn bottom-to-top.
- **Tile size slider**: adjusts how large each tile renders on the canvas.
- **Zoom slider**: 0.25× to 4×.
- **Mouse drag**: hold and drag to paint or erase continuously.

Data is stored as `Record<"col,row", tileIndex>` per layer. Export the tilemap JSON to use it with `TilemapSystem.load()` at runtime.

---

## 7.7 Particle Editor

Live particle system preview with editable emitter parameters.

**Emitter properties:**

| Property | Description |
|----------|-------------|
| Emission Rate | Particles spawned per second |
| Speed Min / Max | Random speed range per particle |
| Lifetime Min / Max | Random lifetime range (seconds) |
| Gravity | Downward acceleration |
| Scale Start / End | Size interpolation over lifetime |
| Color Start / End | Color interpolation over lifetime |
| Shape | `point`, `circle` (with radius), `rect` |

The preview canvas runs a requestAnimationFrame loop. Particles are updated and drawn every frame in real time.

Export settings as JSON to pass directly to the engine's ParticleSystem component.

---

## 7.8 VNEditor (Visual Novel Node Graph)

An SVG-based node graph editor for branching dialogue trees.

**Node types:**
- **Dialogue** — speaker name + text body. One output port.
- **Choice** — array of option strings. One output port per option.

**Interactions:**
- Drag a node's header to move it.
- Drag from an output port to an input port to connect nodes.
- Double-click a node to open the edit modal (change text, add/remove options).

**Export:** Click Export JSON to get a graph compatible with `VNSystem.loadScript()`.

---

## 7.9 AudioMixer

Volume, mute, and solo controls for audio bus groups. Changes are applied in real time via `Audio.setGroupVolume(bus, volume)`.

**Default buses:** Master, Music, SFX, Voice, Ambient.

**Controls per bus:**
- Vertical fader (0–100%)
- **M** button: mute (red when active)
- **S** button: solo (yellow when active; non-soloed buses are muted)

Add new buses with the **+ Bus** button.

---

## 7.10 Profiler

Frame-time bar chart updated every frame while the game is playing.

**Metrics:** frame time (ms), FPS, draw call count.

**Display:** 120-frame rolling history. Bars are colored:
- Green: < 16.7 ms (above 60 fps)
- Yellow: 16.7–33.3 ms (30–60 fps)
- Red: > 33.3 ms (below 30 fps)

Reference lines for 60 fps and 30 fps are drawn across the chart.

**Usage:** The Profiler is only active while `playState === 'playing'`. Detach it to a floating window to keep it visible while editing.

---

## 7.11 Localisation Editor

Spreadsheet-style table for managing translation strings.

**Columns:** `key` + one column per locale.

**Editing:** Click any cell to edit inline. Press `Enter` or click away to commit, `Esc` to discard.

**Filter:** The search bar filters rows by key or value substring.

**CSV import:** Expects a header row `key,en,fr,...` followed by data rows. New locales in the import are added as columns.

**CSV export:** Produces quoted, escaped CSV ready to paste into a spreadsheet or check into version control.

Keys exported from this panel are looked up at runtime via `i18n.t('key')`.

---

## 7.12 GitPanel

Lightweight git commit helper. **Tauri desktop only** — shows placeholder UI in browser mode.

Requires `git` on `PATH` and the project saved to disk.

**Shows:**
- Current branch name
- Staged files (green M / A / D indicators)
- Unstaged / untracked files (yellow M, gray ?)

**Actions:**
- Click **+** next to a file to stage it.
- Click **-** next to a staged file to unstage.
- Type a commit message in the textarea.
- Click **Commit** (or `Ctrl+Enter`) to run `git commit`.

---

## 7.13 PWA support

The IDE is a Progressive Web App. When served over HTTPS, the browser will offer to install it as a desktop shortcut. The Vite PWA plugin registers a service worker that caches the IDE shell for offline use.

The `public/manifest.webmanifest` file contains the app name, theme color (`#7c6af7`), and icon paths.
