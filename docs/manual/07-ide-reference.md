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

Shows the properties of the selected entity (or entities). A component whose `ComponentDef` carries a `.schema` (see `EntityProperties.tsx`'s `V2_COMPONENT_METADATA`) gets real typed controls — a checkbox for a boolean field, a `<select>` for an enum, a number input for a number — plus a small icon per field (a move-arrows icon for a position/vector-shaped field, a palette icon for a colour field, a link icon for an asset/path field, and a kind-based icon otherwise). A component with no schema entry, or an individual field the schema doesn't cover, falls back to the plain raw-text editor and no icon — this is the intended non-error path, not a bug.

**Multi-select.** Click an entity in the Scene panel to select it, Ctrl/Cmd-click to toggle one in or out of the selection, Shift-click to range-select. Selecting more than one entity switches the Inspector to a combined view: it lists every component type present across the selection with an "N/M" share count, and for a schema'd component every selected entity has, shows its fields with live values fetched per entity over the engine bridge. A field whose value differs across the selection shows a "Mixed" placeholder instead of picking one arbitrarily; typing a new value there applies it to every selected entity that has the component. This is a v1: it edits every selected entity uniformly rather than diffing and re-applying each entity's own prior value.

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

## 7.7 RoomEditor

A canvas-based editor for placing and moving a scene's instances — the visual counterpart to a `.scene.json` file (see `RoomLayer`/`SceneFilePrefabInstance` in `@emptysock/engine`).

**Controls:**

- **File picker** (top-left): every open `*.scene.json` file is listed; pick one to edit its room layout.
- **Canvas**: each placed instance renders as a labeled box at its `(x, y)` position. Click to select, drag to move.
- **Grid/snap/ruler** (top-right, per the IDE's per-tool convention): toggle the grid overlay and snap-to-grid; dragging with snap enabled rounds to the current grid size.
- **Position panel** (right, appears once an instance is selected): numeric X/Y, Rotation (degrees), and Scale X/Scale Y fields for precise placement — the same field names `Transform` uses, written straight into the instance's `props` so they round-trip through `loadSceneFile()` with no translation step.
- **Undo/Redo**: toolbar buttons, also bound to Ctrl+Z / Ctrl+Shift+Z, capped at 50 steps per the IDE's shared `useHistory` convention.

Every edit (drag, or a typed X/Y/Rotation/Scale field) writes the updated `.scene.json` straight back into the IDE's open-file store (its `prefabInstances` array).

### Nine-slice and tiled instances

An instance can be marked **Nine-slice** or **Tiled** with the side panel's **Slicing** select (writes `sliceMode` 1 or 2 into the instance's `props`; the matching `Sprite` fields are `sliceMode`, `sliceLeft/Right/Top/Bottom`, `width`, `height`). Such instances draw at their real `width` x `height`: nine-slice keeps corners at the guide sizes and stretches edges and centre (guides default to a third of the texture when all zero, like a real project's `draw_9slice`); tiled repeats the texture clipped to the box. The texture comes from the instance's or its open `*.prefab.json`'s `Sprite.texturePath` (a `data:` URL in an open file, else the path as a URL); until it loads, a labeled placeholder box of the real size is drawn.

Select a nine-slice/tiled instance to get eight drag handles (corners and edge midpoints). The opposite edge stays fixed, the dragged edge snaps to the grid when Snap is on, and the result is written back to the `.scene.json` (`x`/`y` stay the centre) and is undoable. **Width**, **Height** and, for nine-slice, the four guide fields are also editable numerically. Saving preserves every other top-level field of the scene file (`entities`, `views`, ...).

---

## 7.8 Particle Editor

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

The panel has two modes, switched with the tabs at the top of the panel:

- **Scene Scaffold** — a node graph for sketching a scene's entity/component tree (Scene → Entity → Component nodes). "Export Code" generates a starter `Scene` subclass from the graph; it is a code-scaffolding aid, not a runtime graph.
- **Logic Script** — authors a real `VisualScriptGraph`, the exact shape `VisualScriptComponent` (`packages/engine/src/components/VisualScriptComponent.ts`) interprets at runtime. Anything built here can be dropped straight into `new VisualScriptComponent({ graph })` with zero translation — the panel's save path (`toVisualScriptGraph()` in `visual-script/logicHelpers.ts`) is proven equal to the code-first `VisualScriptGraphBuilder` output by test (`apps/ide/src/__tests__/logicScriptGraph.test.ts`).

**Opening the panel:** Drag the Visual Script Editor tab from the tab bar into a docked pane, or open it via View → Panels → Visual Script Editor.

**Logic Script canvas controls:**

| Action          | Input                                                |
| --------------- | ---------------------------------------------------- |
| Zoom            | Ctrl/Cmd + scroll wheel                              |
| Select node     | Click                                                |
| Move node       | Drag                                                 |
| Delete selected | `Delete` or `Backspace` (when not editing a field)   |
| Connect ports   | Click an output port, then click a target input port |
| Disconnect      | Click the connection line                            |
| Undo / redo     | `Ctrl+Z` / `Ctrl+Shift+Z`                            |

**Node palette:** `On Update`, `On Event`, `Sequence`, `Branch`, `Get Variable`, `Set Variable`, `Get Switch`, `Set Switch`, `Send Message` — added from the "+ Node" picker in the toolbar. `Branch` nodes expose two output ports (`true`/`false`). Selecting a node opens its property panel on the right for kind-specific fields (comparator, variable/switch index, target actor id, and so on).

**Saving:** The graph and each node's canvas position are kept in `logicScriptStore.ts` (Zustand) as the source of truth, synced on every edit. Canvas position is editor-only state — the graph handed to `VisualScriptComponent` never carries `x`/`y`.

**Limitations:** Visual scripts run through a graph interpreter at runtime — expect slower execution than native TypeScript for hot paths (e.g., heavy per-frame computation). Use TypeScript for performance-critical logic; use Logic Script for event-driven, low-frequency logic (cutscenes, dialogue triggers, UI flows).

---

## 7.15 Sequence Editor

A keyframe timeline panel for authoring numeric property animations (position, rotation, scale, opacity) plus marker lanes for dialogue, expression, audio, and wait events. Playback drives a real `TweenManager`/`SequenceSystem` pair from `@emptysock/engine` — the same classes a developer would call from code — so what plays in the panel is what plays in the game, not a separate simulation.

**Opening the panel:** View → Panels → Sequence Editor.

**Layout:**

- **Playhead** (red vertical line): current time cursor. Drag the ruler to seek.
- **Track list** (left column): one row per track. Use the **Add Track** dropdown to add "Position X", "Position Y", "Rotation", "Scale", "Opacity", or "Custom". Each track's lane-type selector switches it between `keyframe` (numeric, tween-driven) and `dialogue`/`expression`/`audio`/`wait` (marker lanes with a text/duration payload, not animated).
- Each `keyframe`-lane track also has an **ease** selector (`linear`, `sineIn/Out/InOut`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `bounceOut`, `elasticOut` — the exact `EasingName` union from `packages/engine/src/core/easing.ts`).
- **Keyframe area** (right): the timeline canvas. Each diamond marker is a keyframe; click a row to add one at that time, drag a diamond to retime it, select it to edit its value (or Delete/Backspace to remove).
- **Toolbar:** Play/Pause, Stop, duration input, undo/redo.

**Playback:** clicking **Play** converts the panel's `keyframe`-lane tracks into a `SequenceDefinition` (via `tracksToSequenceDefinition()`) and calls `SequenceSystem.play()` against a live `TweenManager` instance, resuming from the current playhead position. Each animation frame calls `tweens.update(dt)`; the numeric badge shown next to a playing track is read straight off the tween-driven target object, not a separately computed formula. Scrubbing while paused uses the engine's own `evaluateTrackAt()` for the same reason — one evaluation path, not two.

**Using a sequence in code**, matching the panel's saved shape exactly:

```typescript
import {
  TweenManager,
  SequenceSystem,
  type SequenceDefinition,
} from "@emptysock/engine";

const def: SequenceDefinition = {
  duration: 2,
  tracks: [
    {
      property: "x",
      ease: "quadOut",
      keyframes: [
        { time: 0, value: 0 },
        { time: 1, value: 120 },
      ],
    },
    {
      property: "opacity",
      keyframes: [
        { time: 0, value: 0 },
        { time: 0.5, value: 1 },
      ],
    },
  ],
};

const tweens = new TweenManager();
const seq = new SequenceSystem();
seq.play(tweens, myEntitySprite, def); // properties are set directly on the target object

// per frame:
tweens.update(deltaTime);
```

`property` is the key `SequenceSystem` sets on the target object — "Position X"/"Position Y"/"Rotation"/"Scale"/"Opacity" map to `x`/`y`/`rotation`/`scale`/`opacity` respectively (see `TRACK_TYPE_TO_PROPERTY` in `apps/ide/src/store/sequenceStore.ts`).

---

## 7.16 Shader Editor

A Monaco-based GLSL editor with a live WebGL preview, for authoring custom post-process shaders. The preview compiles and renders through `CustomShaderFilter` (`@emptysock/engine`) — the exact class `RenderSystem.addLayerShaderFilter()` attaches at runtime — so there is one shader-compile path, not a separate "preview" implementation that could drift from production behaviour.

**Opening the panel:** View → Panels → Shader Editor.

**Layout:**

- **Vertex / Fragment tabs:** switch which shader the Monaco editor shows. Both are kept in state (`useShaderStore` + `useHistory`) so switching tabs doesn't lose edits.
- **Compile & Run:** compiles both shaders through `createCustomShaderFilter()` and renders a full-screen quad with the result. Compile/link errors are PixiJS's own diagnostics, captured from the console during the real compile — not a separately maintained error checker.
- **Undo/redo:** `Ctrl+Z` / `Ctrl+Shift+Z`, disabled while a Monaco editor has focus (Monaco keeps its own per-file undo stack).

**Uniform/attribute contract** (must match exactly — see the [CustomShaderFilter reference](../reference/systems/custom-shader-filter.md)):

- Attributes: `aPosition`, `aUV`
- Vertex uniforms: `uProjectionMatrix`, `uWorldTransformMatrix`, `uTransformMatrix`
- Fragment: `uTexture` (input texture), `uTime` (seconds)
- GLSL ES 3.00 style: `in`/`out`, `texture()` — not `attribute`/`varying`/`texture2D()`

**Using a shader in code:**

```typescript
import { createCustomShaderFilter } from "@emptysock/engine";

const filter = createCustomShaderFilter({ vertexSrc, fragmentSrc });
renderSystem.addLayerShaderFilter("default", filter);
filter.setTime(elapsedSeconds); // once per frame, if the shader reads uTime
```

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

## 7.18a Game Globals Panel

Open via **Module → Game Globals** (enable it in the module list first).

Declares the typed game-wide globals that `ctx.globals.get("name")` / `game.globals` return. Each row is a name and a TypeScript type expression (`number`, `string`, `boolean`, `number[]`, `Record<string, number>`, or any type expression you type in). Adding, renaming, retyping or removing a global updates the Code editor's declarations straight away, so `ctx.globals.get("score")` is typed `number` as soon as you declare it.

- **Add**: type a name and a type at the bottom, press Enter or **+ Add**. Names must be identifiers and unique.
- **Rename / retype**: edit the cell and press Enter or click away; each commit is one undo step.
- **Undo / redo**: the toolbar buttons or Ctrl+Z / Ctrl+Shift+Z (50 steps, session only) while the panel is on screen.
- **Filter**: narrows the list by name.

The declarations are saved in the project file (`gameGlobals`, name to type expression) and restored when the project is opened.

---

## 7.19 UI Placement Panel

Open via **Module → UI Placement** in the menu bar.

A canvas editor for `Widget`/`UISystem` layouts that produces the exact same
constructor-options shape a developer would hand-write in code — see
[Building UI: visual vs code](../guides/ui-visual-vs-code.md) for the full
round-trip explanation.

**Palette types (every `Widget` subclass the engine ships):** `PanelWidget`,
`ButtonWidget`, `LabelWidget`, `ProgressBarWidget`, `SliderWidget`,
`CheckboxWidget`, `ImageWidget`. Drag a type from the palette onto the canvas,
or click it to arm placement and click the canvas.

**Property panel:** every constructor option for the selected widget's type is
editable — for example `ButtonWidget` exposes `label`, `background`,
`hoverBackground`, `pressedBackground`, `borderRadius`, `fontSize`,
`disabled`, and `animateOnHover`, in addition to position, size and anchor.
The 9-way `WidgetAnchor` is set from the anchor grid above the canvas.

**Live preview is real, not a mockup.** The canvas constructs actual
`Widget` instances through the real `UISystem` (`uiSystem.render()`) on every
change — the same render path the game uses, not a hand-drawn approximation.

**Canvas controls:**

- Click or drop a palette item to place it at the cursor.
- Click an existing widget to select it; `Delete`/`Backspace` removes it.
- Toggle grid size, ruler and snap-to-grid in the toolbar. Alignment guides
  appear automatically while placing near another widget's edges.

**Code:** the **Insert** / **Copy** buttons on a selected widget emit the
`new XWidget({ ...opts })` construction for that widget from its exact saved
`opts` object; **Insert all** emits the whole layout. There is no separate
IDE-only export format — the panel's saved layout (`PlacedWidget[]`, from
`apps/ide/src/components/panels/ui-placement/layout.ts`) stores each widget's
real constructor-options object, and `layoutToWidgets()` turns that layout
into `Widget[]` with one call, identical to constructing them by hand.

Undo/redo works within the panel session (`Ctrl+Z` / `Ctrl+Shift+Z`), backed
by the shared `useHistory` hook.

---

## 7.20 NavMesh Editor

Open via **Module → NavMesh Editor** in the menu bar (docks next to the
TilemapEditor tab). A canvas editor for hand-authoring the convex polygon
graph `@emptysock/tilemap`'s `NavMeshSystem` consumes — per CLAUDE.md's
"NavMesh data is offline", there is no runtime generation from a tilemap, so
this panel is how that polygon data actually gets built.

**Tools (toolbar, left panel):**

- **Select** — drag a vertex handle to reshape a polygon, or drag inside a
  polygon (away from its vertices) to translate the whole shape. `Delete`/
  `Backspace` removes the selected polygon.
- **Draw** — click to place vertices one at a time; **Finish polygon**
  (or `Enter`) closes the loop once at least 3 vertices are placed and
  assigns a new `id` and computed `centroid`. `Escape` cancels the
  in-progress draft.
- **Connect** — click one polygon, then a second, to toggle a neighbour
  link between them. Links are drawn as lines between centroids so the
  adjacency graph is visually inspectable. A link is written to both
  polygons' `neighbours` arrays — `NavMeshSystem.findPath()`'s traversal
  only walks the edges a polygon's own `neighbours` list names, so the
  editor keeps both directions in sync rather than leaving a one-way edge.
- **Delete** — click a polygon to remove it. Any other polygon's
  `neighbours` entry pointing at the removed id is cleaned up in the same
  operation — no dangling ids are left behind.

Grid, snap-to-grid and rulers use the shared `ViewControls` cluster
(top-right of the canvas) — vertex placement and dragging snap to the grid
when snap is enabled, the same convention `TilemapEditor` uses.

**Load / Export:** **Load navmesh.json…** reads an existing `NavMeshData`
file from disk; **Export navmesh.json** downloads the current polygons in
the exact `NavMeshData` shape (`{ polygons: NavPolygon[] }`) — it round-trips
directly into `NavMeshSystem.load()` with zero transformation.

Undo/redo works within the panel session (`Ctrl+Z` / `Ctrl+Shift+Z`), backed
by the shared `useHistory` hook, capped at 50 steps.

**Known limitation:** there is no background tilemap/level image shown under the
navmesh layer yet — the canvas is a plain grid. A navmesh is normally
authored over a level's tile layout, so this is a known limitation.

---

## 7.21 VN Preview Panel

Shown in the Canvas Preview while the Story Graph panel is open. Renders an in-editor preview of the VN scene: background, character sprites, and textbox, using placeholder assets from the script.

The preview updates automatically as you edit nodes in the Story Graph panel — no build step required. Click **Advance** in the preview to step through the script from the selected node.

The panel is view-only; edit the script in the Story Graph panel and edit assets in the Asset Browser.

---

## 7.22 Mobile / Tablet Layout

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

---

## 7.23 Asset Browser

Double-clicking (or right-click → "Open in …") an asset dispatches to whichever editor actually exists for that asset type:

| Asset type    | Opens                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| image         | Image Editor                                                                                         |
| script / json | Code tab, with that file's content loaded                                                            |
| scene         | The Scene panel (there is no per-scene-file loader yet — this just brings the Scene panel into view) |
| audio, font   | Nothing — no dedicated editor exists for either yet; the asset stays selected                        |

Hovering an asset (without opening it) shows a lightweight preview popover: a real thumbnail for an image, the first few lines of source for a script (when it's already open in a Code tab), and for a scene/prefab JSON that's open in a Code tab, an entity-count and component-type-count summary parsed from its `PrefabFile`/`SceneFile` shape. Audio gets a placeholder waveform, not a real one — there is no audio-decoding/waveform library in this IDE. Any asset type without a richer preview falls back to its path and size.

---

## 7.24 Room Editor

Open via **Module → Room** and pick a `*.scene.json` from the file list (open it in the Files panel first).

The canvas draws three things, all in room pixels:

- **Instances** (`prefabInstances`) as labelled boxes; drag to move, rotation/scale/slicing in the side panel.
- **Direct entities** (`entities`: converted backgrounds, room-layer sprite and sequence elements) as faint boxes behind the instances, sized from their `Sprite` width/height, `Transform` scale and anchor. Drag to move.
- **Camera views** (`views`): the world rectangle each _visible_ view looks at, in green (dashed while **Enable views** is off), with a `View n` chip at its top-left corner (`*` when it follows an object). Drag the border or the chip to move it; click the chip to select it, then drag a corner or edge handle to resize. A click inside a view still hits whatever is under it. Invisible views are drawn dimmed and dotted with an `off` chip and can be selected, moved and resized like any other; double-click a view (or tick **Visible** in the side panel) to toggle it.

**Pan and zoom.** Scroll to zoom about the cursor; middle-drag, Space-drag, or drag empty background to pan. The buttons at the bottom-left zoom out/in, reset to 100%, or **Fit** the whole room. **Game window overlay.** A view's screen (port) rectangle is not in room space, so it is edited in the small _Game window_ overlay at the bottom-right: drag a port to move it, drag its handles to resize it (whole pixels).

With **Snap to grid** on (grid button on the tab), positions and view edges snap to the grid size. Each drag or resize is one undo step: use the **Undo**/**Redo** buttons or Ctrl+Z / Ctrl+Shift+Z (text fields keep their own undo). Undo and redo write the file back, so the editor and the `.scene.json` never disagree.

The **Views** section of the side panel has numeric fields for every view value and a **followObject** field: type an object-type name (the datalist offers every prefab placed in the room) and press Enter or click away; clear it to stop following. The **Entities** section has x/y fields per entity.

---
