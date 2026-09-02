# EmptySock QoL Pass

branch: `claude/emptysock-qol-pass-pcnrn9`

Status markers: ✅ done · ⬜ todo · 🔴 blocked

---

## Panels & UX

- ✅ Story Graph (VNEditor) — pan, zoom, pinch, persistence
  Wheel zoom, two-finger pinch, one-finger pan, localStorage, import/export JSON, keyboard delete, SVG grid.

- ✅ ParticleEditor — sprite/image texture support
  drawImage in RAF loop, rotation, rotationSpeed, alphaEnd, particle count overlay, color pickers hidden when sprite loaded.

- ✅ VisualScriptEditor — Ctrl+scroll zoom, correct coordinate mapping
  0.25×–2.5× zoom, toCanvas() divides by vsScale, reset view button + zoom % display.

- ✅ Module auto-open — panel appears when module is enabled
  prevModulesRef diff in App.tsx calls openPanelInLayout for newly added modules.

- ✅ DownloadEngineModal hidden in Tauri
  isTauri() early return; web-only download for linux/win-arm/win-x64/mac-universal.

- ✅ ConsolePanel — remove fabricated startup log messages
  ideStore.ts lines 424–458: replaced fake GPU/WebGPU messages with real build/runtime events from GameBuildService.

- ✅ AssetBrowser — fix file import (was a complete no-op)
  AssetBrowser.tsx lines 63 + 71 wired to ideStore.addAsset().

- ✅ SceneInspector — entities from store, not hardcoded INITIAL_ENTITIES
  loadProjectFiles restores scene entity list.

- ✅ EntityProperties — wire transform inputs and action buttons
  Inputs use controlled state; Delete and Add Component buttons wired.

- ✅ TilemapEditor — functional grid paint, tile palette, layer ops
  Tileset image support; paint/erase/fill tools; layer management; JSON export.

- ✅ SequenceEditor — functional cutscene timeline
  Track lanes (dialogue, movement, audio, wait); drag keyframes; playback preview; Sequence asset export.

- ✅ AudioMixer — wire volume/mute/solo to AudioSystem
  AudioSystem.setBusVolume(id, v) wired; real bus list from store.

- ✅ Profiler — replace Math.random() draw-call counter with real stat
  Real drawCall counter via postMessage from preview iframe.

- ✅ GitPanel — replace hardcoded stub data with real Tauri shell output

- ✅ LocalisationEditor — functional i18n string table
  Add/edit/delete keys across locales; import/export CSV; wired to engine i18nSystem.load().

- ✅ TilemapEditor, SequenceEditor, LocalisationEditor — persist state to store
  All three wired to ideStore so data survives tab switching and refresh.

- ⬜ **[P0]** Project save/load — restore scene, assets, and entity state
  loadProjectFiles only restores code files + editorCode. Must restore entities, assets, enabledModules, and panel editor data. emptysock.project.json is never written or read.

- ⬜ **[P1]** TilemapEditor — auto-tiling rule system
  Rule-based tile variant selection based on neighbour tiles. Editor UI to define rules per tileset.

- ⬜ **[P1]** Layer/window post-process filters
  GMS2-style: apply a filter (blur, colour grade, outline) to a single layer or window. Each filter has a start/stop toggle and in-engine live preview.

---

## UI & Scene

- ⬜ **[P0]** UISystem render layer — wire to Canvas 2D draw pass
  UISystemImpl tracks components and dispatches click events but nothing draws. Need a render pass walking \_roots per frame.

- ⬜ **[P1]** Built-in component animations (hover, fade-in, slide-in)
  Declarative animation options on Button/Label/Panel without requiring coroutines.

- ⬜ **[P1]** Scene editor drag-and-drop UI placement
  Drag component from palette onto preview; IDE generates UISystem.create() call. Requires UISystem render layer first.

- ⬜ **[P2]** Alignment guides in scene editor
  Toggleable snap lines (centre, edge, margin) with distance labels while dragging.

---

## Mobile & Touch

- ✅ MobileLayout — implement real panel layout for phones
  Tab-based navigation: Code | Preview | Files | Inspector. Bottom tab bar.

- ✅ Tablet layout — two-panel split with collapsible sidebar
  "tablet" breakpoint (768–1024px) with two-column layout instead of full rc-dock.

- ✅ Story Graph — one-finger pan, two-finger pinch zoom

- ✅ VisualScriptEditor — touch pan + pinch zoom

- ✅ TilemapEditor — touch-friendly tile paint

- ✅ Virtual keyboard avoidance on mobile code editor
  visualViewport API / CSS env(keyboard-inset-bottom).

---

## Naming & Theme Consistency

- ✅ "VN Graph" → "Story Graph" everywhere
  ModuleRegistry, App.tsx makeTab calls, tab labels all updated.

- ✅ Audit all CSS variables — enforce --es- prefix

- ✅ Lock down engine glossary — document canonical terms

- ✅ MenuBar module labels match ModuleRegistry labels exactly

---

## Core & Runtime

- ✅ Audit engine/src for stub exports or unimplemented methods

- ✅ PhysicsSystem3D.destroy() — verify WASM memory is freed

- ✅ engine/index.ts — ensure all systems are re-exported

- ✅ PluginSystem — confirm singleton is not constructed per scene

- ✅ Fix all TypeScript/ESLint warnings in packages/toolchain

- ✅ Installation warnings — clean pnpm install output

- ✅ WindowSystem — Tauri + browser window management API
  windowSystem.apply(), setMode(), setTitle(), setSize(), setResizable(), center(). Runtime Tauri detection via **TAURI_INTERNALS**. Shipped as packages/engine/src/systems/WindowSystem.ts.

- ✅ Behaviors system — reusable per-entity logic components
  BehaviorComponent base class; attach to entity; receives onUpdate(dt).

- ✅ Hot-reload — update running game without full restart
  esbuild incremental build + postMessage to preview iframe to swap module. Entity state preserved.

---

## Build & Compile

- ✅ GameBuildService — wire buildWorkers setting to esbuild worker count

- ✅ Compile targets — verify web / desktop / Android / iOS export flows

- ✅ File write on save — Tauri fs write, web download fallback

- ✅ virtualFiles completeness check before build

- ✅ ESM format + top-level await support in game code
  format:"esm", <script type="module"> blob URL with allow-same-origin sandbox.

- ✅ Compile-time builtins: PROJECT_TITLE, PROJECT_NAME, GAME_WIDTH, GAME_HEIGHT, DEBUG
  esbuild define option. Ambient declare const in packages/engine/src/builtins.d.ts.

---

## Performance

- ✅ Settings: powerMode selector (performance / balanced / saver)
- ✅ Settings: idleCpuCap slider (10–100%)
- ✅ Settings: buildWorkers slider (1 to hardwareConcurrency)

- ✅ Wire powerMode — throttle RAF / reduce canvas resolution in saver mode

- ✅ Wire idleCpuCap — throttle background workers when IDE is unfocused

- ✅ GPU flags in Tauri lib.rs — verify NvOptimus / AmdPowerExpress symbols present

---

## GMS2 Import

- ✅ Migration guide docs (GMS2 → EmptySock)
  docs/manual/11-gms2-migration.md: GML mapping, asset status table, import walkthrough.

- ✅ GMS2 importer — expose in IDE (Tauri command wrapper)

- ✅ MCP gms2_inspect_project — validate actual .yyp parsing

- ⬜ **[P1]** GMS2 sprite import — convert PNG sheets to engine Sprite assets
  Parse .yy sprite metadata, strip frame data, output engine-compatible asset JSON.

- ⬜ **[P1]** GMS2 room import — convert room JSON to TilemapEditor format
  Parse room layers (tiles, instances, assets), output tilemap + entity list.

- ⬜ **[P2]** GMS2 GML → TypeScript stub converter
  Class stub per GML object with mapped event method names (onCreate→onLoad, onStep→onUpdate).

---

## Documentation

- ✅ Tutorial: mini platformer (docs/manual/12-tutorial-platformer.md)
- ✅ Tutorial: visual novel (docs/manual/13-tutorial-visual-novel.md)
- ✅ Tutorial: bullet hell (docs/manual/15-tutorial-bullet-hell.md)
- ✅ docs/manual/07-ide-reference.md — Story Graph, Power Saver, web-only download
- ✅ docs/manual/05-systems-reference.md — ParticleSystem texture, updated Story Graph
- ✅ api-reference.json — ParticleSystem texture, Story Graph, WindowSystem, builtins

- ⬜ **[P2]** docs/manual/08-tutorial-pong.md — verify complete and uses current API

- ⬜ **[P1]** Add beginner "concepts" page — ECS, Scenes, Entities in plain language

---

## MCP Server

- ✅ particle_emitter_config — get/set emitter config via MCP
- ✅ story_graph_export — export Story Graph JSON via MCP
- ✅ scene_create_entity — add entity to scene via MCP

- ⬜ **[P1]** Ensure all tools documented in README.md under "Available tools"

- ⬜ **[P1]** Add tests for new MCP tools in src/tests/tools.test.ts

---

## AI Skills

- ✅ skills/08-story-graph.md — Story Graph skill file
- ✅ skills/00-quickstart.md — updated with Story Graph, particles, window system
- ✅ skills/10-window-system.md — WindowSystem skill + compile-time constants
- ✅ skills/09-particles.md — ParticleSystem with texture examples
- ✅ README.md skills table — Story Graph + WindowSystem rows
- ✅ ai/api-reference.json — WindowSystem system + builtins section

---

## GMRT Feature Backlog

- ✅ Hot-reload — GMLive-style module swap in running preview

- ⬜ **[P2]** Debugger integration — breakpoints + variable inspector in preview
  iframe DevTools protocol bridge or log-based step debugger in ConsolePanel.

- ⬜ **[P2]** Multiplayer boilerplate — NetworkActor Transport interface example (WebSocket)

- ✅ Spine / Spriter animation import — skeletal animation support (plan documented)

- ⬜ **[P2]** Shader editor — GLSL snippet editor with live preview in CanvasPreview

- ⬜ **[P2]** ds_map / ds_list compatibility shim for GML migrants

- ⬜ **[P2]** draw\_\* compatibility layer — canvas API wrappers matching GML names

---

## Ren'Py-style VN

> Uses the existing VNSystem + Story Graph as the backbone. The JSON-based .vnscript format is the authoring target; the Story Graph editor is the visual interface into it.

- ⬜ **[P0]** UISystem render layer (prerequisite — see UI & Scene above)

- ⬜ **[P1]** VN scene preview panel
  Select any Story Graph node; a preview pane renders the character sprites, background, and textbox at that exact point without running the full game.

- ⬜ **[P1]** Character sprite stage
  Built-in left/centre/right position slots with expression variants. Sprites tween in/out on show/hide. Controlled by .vnscript commands or Story Graph node metadata.

- ⬜ **[P1]** VN textbox component
  Built-in dialogue box rendered by UISystem. Auto-advance on timer or wait for click/key. Speaker name plate. Wired to VNSystem.onNode() so no boilerplate needed in game code.

- ⬜ **[P1]** Background and CG overlay layers
  Two render layers beneath the character stage: a background layer and a CG overlay. Controlled from .vnscript or Story Graph node metadata.

- ⬜ **[P1]** .vnscript ↔ Story Graph round-trip
  Export the Story Graph to .vnscript JSON; import a .vnscript JSON back into the graph. Both directions lossless for dialogue, choice, jump, and variable-set nodes.

- ⬜ **[P2]** CG gallery
  Unlock-based image gallery backed by SaveSystem boolean flags. Unlocked on first view of a tagged CG node.

---

## RPG Maker MV-style

> Tilemap layers are already shipped. Auto-tiling is tracked above (Panels P1). Items here cover the database, event, and battle systems. Each is a sizeable module; treat as a phased backlog.

- ⬜ **[P1]** Named game variable/switch store — panel UI
  Persistent numbered variables (integers) and boolean switches, editable in a dedicated panel. Backed by SaveSystem.

- ⬜ **[P1]** Map event system
  Trigger tiles on TilemapEditor maps that carry an event script (autorun, player-touch, action-button, parallel). Script commands: show dialogue, set variable/switch, play audio, transition scene, move character.

- ⬜ **[P1]** Grid-based character movement
  4-directional tile-aligned movement with collision against a solid layer flag. Step events, move routes, face-direction commands.

- ⬜ **[P2]** Database editor panel
  Actors, classes, skills, items, enemies, states with formula fields (ATK, DEF, damage expressions). Stored as project JSON.

- ⬜ **[P2]** Turn-based battle system module
  Party vs enemy encounter triggered from map events. Action menu (attack, skill, item, flee). Formula-based damage from database entries. State effects (poison, stun). Opt-in module flag.
