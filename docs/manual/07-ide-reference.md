# 7 — IDE Reference

The IDE is a dockable, rearrangeable panel environment. All panels are tabs inside a `DockLayout` (rc-dock). Drag a tab's header to move it, drag to a panel edge to split, or drag to the desktop area to float it.

---

## 7.1 Keyboard shortcuts

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

The panel edits a real `ParticleEmitterOptions` object (see `packages/engine/src/systems/ParticleSystem.ts`) — the exact shape `new ParticleEmitter(options)` accepts in code. There is no separate editor-only format and no translation step: copy the options straight into `particleSystem.create(options)`.

The live preview instantiates a real `ParticleEmitter` and calls `emitter.update(dt)` every animation frame, drawing from `emitter.getParticles()`. It is not a separate hand-rolled canvas simulation.

**Emitter properties (all fields of `ParticleEmitterOptions`):**

| Property               | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| Texture                | Sprite name (`options.texture`); preview-only upload                   |
| Emission Rate          | Particles spawned per second                                           |
| Max Particles          | Pool cap (`options.maxParticles`)                                      |
| Lifetime Min / Max     | Random lifetime range (seconds)                                        |
| Velocity X/Y Min / Max | Random initial velocity range per axis                                 |
| Acceleration X / Y     | Constant per-frame acceleration (Y acts as gravity)                    |
| Scale Start / End      | Size interpolation over lifetime                                       |
| Alpha Start / End      | Opacity interpolation over lifetime                                    |
| Colour Gradient        | Arbitrary number of colour stops (`options.colorGradient`), add/remove |
| Rotation Speed         | Radians per second                                                     |
| Shape                  | `point`, `circle` (radius), `rectangle` (width/height), `line` (width) |

State lives in `useParticleStore` (`apps/ide/src/store/particleStore.ts`), a Zustand store holding the actual `ParticleEmitterOptions`, so other panels and the Code Editor can read the same data. Undo/redo is wired via the shared `useHistory` hook (Ctrl+Z / Ctrl+Shift+Z), committed on control release so drags don't spam history.

---

## 7.8 Story Graph (formerly VN Graph)

An SVG-based node graph editor for branching dialogue trees. Open it via **Module → Story Graph** in the menu bar, or drag its tab from the panel bar.

**Node types:**

- **Dialogue** — speaker name + text body. One output port (continues to next node).
- **Choice** — array of option strings. One output port per option (fan-out). Any option can be gated with a `when` condition (check "Only show when…" in the edit modal) — the option is hidden from the player at runtime unless the switch/variable check passes.
- **Condition** — checks a `VariableStore` switch or variable (double-click to configure kind, index, and comparison) and routes to a "True" or "False" port. Leave the False port unconnected to end the story there when the check fails.

**Canvas controls:**

| Action        | Input                                                         |
| ------------- | ------------------------------------------------------------- |
| Pan           | Middle-click drag, Space + drag, or two-finger trackpad swipe |
| Zoom          | Scroll wheel or trackpad pinch                                |
| Move node     | Drag the node's header bar                                    |
| Connect nodes | Drag from an output port to an input port                     |
| Disconnect    | Click a connected port and drag off it                        |
| Edit node     | Double-click the node body                                    |
| Delete node   | Select then press `Delete` or `Backspace`                     |

> **Touchpad and touch pan:** On a trackpad, two-finger swipe pans the canvas. On a touch device (tablet, touch monitor), use two fingers to pan and pinch to zoom. Single-touch always drags the selected node; no modifier needed.

**Export:** Click **Export JSON** in the toolbar to save the graph as a `.vnscript` file. Load it at runtime with `VNSystem.loadScript(path)`.

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

---

## 7.14 Visual Script Editor

A node graph panel for wiring component logic without writing TypeScript. Nodes represent entities, components, events, and operations; edges represent data or control flow between them.

**Opening the panel:** Drag the Visual Script Editor tab from the tab bar into a docked pane, or open it via View → Panels → Visual Script Editor.

**Canvas controls:**

| Action          | Input                                     |
| --------------- | ----------------------------------------- |
| Pan             | Middle-click drag, or Space + drag        |
| Zoom            | Scroll wheel                              |
| Select node     | Click                                     |
| Multi-select    | Shift-click or drag a selection box       |
| Move nodes      | Drag selected nodes                       |
| Delete selected | `Delete` or `Backspace`                   |
| Connect ports   | Drag from an output port to an input port |
| Disconnect      | Click a connected port and drag off       |

**Adding nodes:**

Right-click the canvas (or press `Tab`) to open the node picker. Categories:

- **Entity** — `Get Entity`, `Create Entity`, `Destroy Entity`
- **Component** — `Add Component`, `Get Component`, `Set Property`, `Get Property`
- **Events** — `On Update`, `On Collision Enter`, `On Message`
- **Flow** — `Branch` (if/else), `Sequence`, `For Each`
- **Math** — `Add`, `Subtract`, `Multiply`, `Compare`, `Lerp`
- **Output** — `Log`, `Play Audio`, `Load Scene`

**Edges:** A yellow edge carries a control-flow signal (execution order). A white edge carries a data value. Ports are colour-coded by type — connecting incompatible types shows a red error indicator on the edge.

**Saving:** The graph is saved as a `.esvs` JSON file. Use the **Save** button in the toolbar or `Ctrl+S`. The saved file can be referenced by the engine as a component behaviour via `VisualScriptComponent`.

**Limitations:** Visual scripts run through a graph interpreter at runtime — expect ~10× slower execution than native TypeScript for hot paths (e.g., heavy per-frame computation). Use TypeScript for performance-critical logic; use visual scripts for event-driven, low-frequency logic (cutscenes, dialogue triggers, UI flows).

---

## 7.15 Sequence Editor

A keyframe timeline panel for authoring animation sequences, cutscenes, and timed events. Each sequence drives properties on entities and components over time without per-frame code.

**Opening the panel:** View → Panels → Sequence Editor.

**Layout:**

- **Playhead** (red vertical line): current time cursor. Drag it or click the timeline ruler to seek.
- **Track list** (left column): one row per animated property. Click **+ Track** to add a track and pick an entity, component, and property to animate.
- **Keyframe area** (right): the timeline canvas. Each diamond marker is a keyframe.
- **Toolbar:** Play, Stop, Loop toggle, duration input, snapping controls.

**Adding keyframes:**

1. Move the playhead to the desired time.
2. In the track list, click the keyframe button (◆) next to a track — this records the property's current value at that time.
3. Repeat at other times to create a curve.

**Editing keyframes:**

- Click a diamond to select it; its value and easing appear in the property panel below.
- Drag a diamond horizontally to shift its time.
- Right-click a diamond → Easing to choose `linear`, `sineIn/Out`, `cubicIn/Out`, `step`.

**Exporting:** Click **Export** to save the sequence as a `.esseq` JSON file. Load it at runtime:

```typescript
import { SequencePlayer } from "@emptysock/engine";

const seq = await SequencePlayer.load("assets/cutscene-intro.esseq");
seq.bind("Player", playerEntity);
seq.bind("Camera", cameraEntity);
seq.play(); // plays once
seq.play({ loop: true }); // loops
seq.onComplete(() => SceneManager.load("GameScene"));
seq.stop(); // stops and rewinds
```

**GMS2 note:** Sequences in GameMaker Studio 2 map directly to this panel — see section 11 for the migration guide.

---

## 7.16 Settings

Open the Settings panel via **IDE → Settings** or the gear icon in the top-right toolbar.

### Power Saver Mode

When **Power Saver** is enabled, the IDE throttles the Canvas Preview's requestAnimationFrame loop to a maximum of 30 fps while the canvas is not the active focus window. This reduces CPU/GPU load and battery drain on laptops during extended editing sessions.

Power Saver does **not** affect the game loop when the game is focused — only the background render rate. Disable Power Saver if you are testing animations that require consistent frame timing even when the canvas is unfocused (for example, cutscene timing tests).

Toggle: **Settings → Performance → Power Saver**. The setting is persisted in the IDE store and survives page refreshes.

### Download Engine (web version only)

The **Download Engine** button appears in Settings only when the IDE is running in the browser (not in the Tauri desktop app). It downloads the current engine bundle as a `.js` file for offline use or for embedding in a project outside the IDE.

This button is hidden in the desktop app because the engine bundle is already bundled inside the Tauri binary. If you do not see the button, you are running the desktop version — use the export pipeline (`pnpm emptysock-toolchain export`) instead.

---

## 7.17 Database Editor

Open via **Module → Database** in the menu bar.

A spreadsheet-style editor for game data: actors, classes, items, and enemies. Each category is a tab. Click a row to select it; edit fields in the property panel on the right. Add rows with the **+** button; delete with the **×** column.

**Actors** — playable characters and NPCs. Fields: name, class ID, level, base HP/MP/ATK/DEF, equipment list.

**Classes** — job classes linked to actors. Fields: name, stat growth curves.

**Items** — consumable and equipment definitions. Fields: name, type, effect, price, icon path.

**Enemies** — encounter definitions. Fields: name, HP, ATK, DEF, EXP, gold, drops.

All data lives in the IDE store and is exported as `database.json` with the project. Load it at runtime with `JSON.parse` — there is no dedicated runtime system; interpret the schema in your own scene code.

---

## 7.18 Variables Panel

Open via **Module → Variables** in the menu bar.

Displays and edits the VariableStore indices (1–1000 variables, 1–1000 switches) used by the MapEventSystem and game scripts. Name each variable or switch for readability; names are stored alongside the data.

- **Variables tab**: index, name, current integer value. Click a value cell to edit inline.
- **Switches tab**: index, name, on/off toggle.

Changes take effect immediately in the running game (the VariableStore is shared). Click **Save** to persist to `localStorage`; click **Reset** to clear all values and names.

---

## 7.19 UI Placement Panel

Open via **Module → UI Placement** in the menu bar.

A WYSIWYG canvas editor for `UISystem` layouts. Drag components from the palette on the left onto the canvas. Select a component to edit its position, size, anchor, and style in the right-hand property panel.

**Palette types:** `panel`, `text`, `button`, `image`, `progressbar`, `slider`, `checkbox`.

**Canvas controls:**

- Drag a component to reposition it.
- Drag a handle on the selection border to resize.
- Hold `Shift` to snap to the grid (default 8 px).

**Export:** Click **Export JSON** to save the layout as a `.eslayout` file. Load it at runtime:

```typescript
import { UISystem } from "@emptysock/engine";
await UISystem.loadLayout("assets/ui/hud.eslayout");
```

Undo/redo works within the panel session (`Ctrl+Z` / `Ctrl+Shift+Z`).

---

## 7.20 VN Preview Panel

Shown in the Canvas Preview while the Story Graph panel is open. Renders an in-editor preview of the VN scene: background, character sprites, and textbox, using placeholder assets from the script.

The preview updates automatically as you edit nodes in the Story Graph panel — no build step required. Click **Advance** in the preview to step through the script from the selected node.

The panel is view-only; edit the script in the Story Graph panel and edit assets in the Asset Browser.

---

## 7.21 Mobile / Tablet Layout

When the IDE loads in a browser on a device narrower than 1024 px, it automatically switches to the mobile layout. The desktop dock layout (rc-dock) is not used on small screens.

**Phone (< 768 px):**

- Bottom navigation bar: Code, Scene, Files, Console.
- Swipe left/right to cycle tabs.
- **Panels** floating action button (bottom-right) opens a drawer with Assets, Inspector, Profiler, and Git.
- Run/Stop button in the top header bar.

**Tablet (768–1023 px):**

- Left column (40%): file browser.
- Right column (60%): Code / Preview / Console tab strip.

**Virtual keyboard:** The layout tracks `window.visualViewport` and adjusts bottom padding so the keyboard never covers the editor.

**Touch input in preview:** The game canvas inside the preview iframe receives touch events directly — `InputSystem` handles `touchstart`, `touchmove`, `touchend`, and `touchcancel` natively. No configuration is required.
