# 5 — Systems Reference

---

## 5.1 PhysicsSystem (2D)

The 2D physics system runs synchronously — no async init required.

```typescript
import { PhysicsBody, CharacterController } from "@emptysock/engine";

// Dynamic rigid body:
player.addComponent(PhysicsBody, {
  shape: "capsule",
  bodyType: "dynamic", // 'dynamic' | 'static' | 'kinematic'
  gravityScale: 1,
  friction: 0.2,
  restitution: 0.0,
});

// Character controller (handles slope, stairs, one-way platforms):
player.addComponent(CharacterController, { slopeAngle: 45 });

// In onUpdate:
const ctrl = player.requireComponent(CharacterController);
if (ctrl.isGrounded() && Input.isPressed("Space")) ctrl.jump(600);
ctrl.moveAndSlide({ x: Input.axis("Horizontal") * 200 * dt, y: 0 });
```

**Collision events:**

```typescript
const body = player.requireComponent(PhysicsBody);
body.onCollisionEnter((other) => {
  if (other.entity.name === "Spike") playerDie();
});
body.onCollisionExit((other) => {
  /* ... */
});
```

---

## 5.2 PhysicsSystem3D

Full Rapier3D integration. **Must `await physics.init()` before adding bodies. Must call `physics.destroy()` in `onDestroy` — omitting it leaks WASM memory permanently.**

```typescript
import { PhysicsSystem3D } from "@emptysock/engine";

const physics = new PhysicsSystem3D();
await physics.init({ x: 0, y: -9.81, z: 0 });

// Dynamic box:
const box = physics.addBody({
  bodyType: "dynamic",
  shape: "box",
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  position: { x: 0, y: 5, z: 0 },
  density: 1.0,
  restitution: 0.3,
});

// Static floor:
physics.addBody({
  bodyType: "static",
  shape: "box",
  halfExtents: { x: 50, y: 0.1, z: 50 },
  position: { x: 0, y: 0, z: 0 },
});

// In onUpdate:
physics.update(dt);
const pos = box.getPosition(); // { x, y, z }
const rot = box.getRotation(); // quaternion { x, y, z, w }
box.applyImpulse({ x: 0, y: 10, z: 0 });

// In onDestroy:
physics.removeBody(box.bodyIndex);
physics.destroy(); // REQUIRED
```

**Supported shapes:** `box` (`halfExtents: Vec3`), `sphere` (`radius`), `capsule` (`radius`, `halfHeight`), `cylinder` (`radius`, `halfHeight`), `cone` (`radius`, `halfHeight`).

**Body types:** `dynamic` (simulated), `static` (immovable collider), `kinematic` (moved by code, pushes dynamics).

**Sensor bodies** (`isSensor: true`) detect overlaps without generating forces.

---

## 5.3 InputSystem (advanced)

The high-level `Input` static class covers most cases (see Section 4.8). For direct system access inside a custom system or actor:

```typescript
import { InputSystem } from "@emptysock/engine";

const input = new InputSystem();
input.attach(canvasElement);

// Call once per frame, before reading state:
input.flush();

input.isKeyDown("Space");
input.isKeyPressed("ArrowRight");
input.isKeyReleased("Escape");
```

---

## 5.4 Touch Input

```typescript
// After input.flush() each frame:

const count = input.touchCount;
const primary = input.primaryTouch; // TouchPoint | undefined

if (primary) {
  // primary.x, primary.y  — current canvas position
  // primary.dx, primary.dy — delta since last frame
  // primary.id            — browser touch identifier
}

for (const touch of input.touches) {
  drawTouchIndicator(touch.x, touch.y);
}

if (input.isTouchStarted()) {
  /* any new touch this frame */
}
if (input.isTouchStarted(id)) {
  /* specific touch started */
}
if (input.isTouchEnded(id)) {
  /* specific touch lifted */
}
```

All listeners are `{ passive: true }`. Never call `e.preventDefault()` on events you did not add.

---

## 5.5 NavMeshSystem

Polygon-based 2D pathfinding using A\* on a convex polygon graph.

```typescript
import { NavMeshSystem, type NavMeshData } from "@emptysock/engine";

const navMesh = new NavMeshSystem();

const data: NavMeshData = {
  polygons: [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      centroid: { x: 50, y: 50 },
      neighbours: [1],
    },
    {
      id: 1,
      vertices: [
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
      ],
      centroid: { x: 150, y: 50 },
      neighbours: [0],
    },
  ],
};

navMesh.load(data);
const path = navMesh.findPath({ x: 10, y: 10 }, { x: 190, y: 90 });
// path = [{ x: 50, y: 50 }, { x: 150, y: 50 }]

navMesh.update(dt); // call each frame (reserved for dynamic obstacles)
```

**Point resolution:** `findPath` uses ray-cast point-in-polygon containment first, then centroid distance fallback for points outside all polygons.

**NavMesh data must be built offline** (in the TilemapEditor or a preprocessing step). See the CLAUDE.md decision record for why runtime generation is not supported.

---

## 5.6 Save System

```typescript
import { SaveSystem } from "@emptysock/engine";
import { z } from "zod";

const Schema = z.object({
  scene: z.string(),
  score: z.number(),
  flags: z.record(z.boolean()),
});
type SaveData = z.infer<typeof Schema>;

await SaveSystem.save("slot-1", { scene: "Level2", score: 4200, flags: {} });

const raw = await SaveSystem.load("slot-1"); // throws SlotNotFoundError if missing
const data = Schema.parse(raw.data); // always validate

await SaveSystem.delete("slot-1");
const slots = await SaveSystem.listSlots(); // string[]
```

> **Warning:** Never cast `raw.data as MyType`. Save files can be corrupt, edited, or from a different game version. Schema validation is the contract.

---

## 5.7 Localisation

```typescript
import { i18n } from "@emptysock/engine";

await i18n.load("en", () => import("./locales/en.json"));
await i18n.load("fr", () => import("./locales/fr.json"));

i18n.setLocale("fr");

i18n.t("greeting"); // → "Bonjour"
i18n.t("score", { n: 42 }); // → "Score : 42"
i18n.t("missing.key"); // → 'missing.key' (never throws)
```

Locale JSON format: `{ "key": "value", "score": "Score : {{n}}" }`. Template tokens use `{{name}}` syntax.

The LocalisationEditor panel can export CSV that maps directly to these JSON files.

---

## 5.8 Plugin System

```typescript
import {
  pluginSystem,
  type Plugin,
  type PluginContext,
} from "@emptysock/engine";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  install(ctx: PluginContext): void {
    ctx.provide("myService", new MyService());
  },
  uninstall(): void {
    /* cleanup */
  },
};

await pluginSystem.register(myPlugin);

const svc = pluginSystem.inject<MyService>("myService");
svc?.doSomething();

await pluginSystem.unregister("my-plugin");
```

`install()` may be async. Registering a duplicate name throws. `pluginSystem` is a process-global singleton — do not construct a new one.

---

## 5.9 Animator

Spritesheet animation component. Requires a `Sprite` on the same entity.

```typescript
import { Animator } from "@emptysock/engine";

player.addComponent(Animator, {
  spritesheet: "assets/hero.esanim",
  defaultClip: "idle",
});

const anim = player.requireComponent(Animator);

// Play a clip:
anim.play("run"); // loops by default
anim.play("attack", { loop: false }); // one-shot
anim.onComplete(() => anim.play("idle")); // callback when one-shot ends

// Control:
anim.pause();
anim.resume();
anim.stop(); // returns to first frame of defaultClip

// Read state:
console.log(anim.currentClip, anim.isPlaying, anim.frame);
```

**Clip names** are defined in the `.esanim` file created by the spritesheet importer. The TilemapEditor does not produce `.esanim` files — use the asset importer for that.

---

## 5.10 TilemapSystem

Loads tilemap files exported from the TilemapEditor panel.

```typescript
import { TilemapSystem } from "@emptysock/engine";

// Load (synchronous after assets are preloaded):
const map = TilemapSystem.load("assets/levels/level1.esmap");

// Enable physics colliders on a layer (static bodies):
map.getLayer("Collision").enablePhysics();

// Access spawn-point entities placed in the editor:
const spawns = map.getLayer("Spawns").entities;
for (const spawn of spawns) {
  spawnEnemy(spawn.position);
}

// Get all layers:
const layers = map.getLayers(); // TilemapLayer[]

// Unload when the scene ends:
TilemapSystem.unload("assets/levels/level1.esmap");
```

**Exporting from the editor:** In the TilemapEditor panel, use the Export button to save the map as `.esmap` JSON. Place it under `apps/ide/public/assets/` so Vite serves it. The path in `TilemapSystem.load()` is relative to the public root.

---

## 5.11 Tween

Interpolates numeric properties on any object over a duration, integrated with the game loop.

```typescript
import { Tween } from "@emptysock/engine";

// Move an entity:
Tween.to(entity, { x: 400, y: 200 }, { duration: 0.5, ease: "bounceOut" });

// Fade out a sprite and destroy on complete:
Tween.to(
  sprite,
  { alpha: 0 },
  {
    duration: 0.3,
    ease: "sineIn",
    onComplete: () => entity.destroy(),
  },
);

// Tween from a starting value:
Tween.from(entity, { y: -100 }, { duration: 0.4, ease: "cubicOut" });

// Cancel a running tween:
const handle = Tween.to(enemy, { alpha: 0.5 }, { duration: 1.0 });
Tween.kill(handle);
```

**Easing functions:** `linear`, `sineIn/Out/InOut`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `bounceOut`, `elasticOut`, `backIn/Out`.

> **Tip:** Tweens do not need to be cancelled in `onDestroy` if the target object is destroyed — the engine detects the destroyed entity and stops the tween automatically. For tweens on plain objects (not entities), cancel them manually.

---

## 5.12 UISystem

A retained-mode 2D UI layer rendered on top of the scene canvas. Widgets live in a tree separate from the entity graph; they do not participate in the physics simulation.

```typescript
import { UISystem } from "@emptysock/engine";

const ui = new UISystem();

// Build a simple health bar:
const root = ui.createPanel({ x: 16, y: 16, width: 200, height: 20 });
const label = ui.createLabel({ text: "HP", parent: root, color: "#fff" });
const bar = ui.createProgressBar({
  parent: root,
  value: 1.0, // 0.0–1.0
  fill: "#e74c3c",
  background: "#333",
});

// Update each frame:
bar.setValue(player.hp / player.maxHp);

// Button with click handler:
const btn = ui.createButton({
  text: "Retry",
  x: 320,
  y: 240,
  width: 120,
  height: 40,
  onClick: () => SceneManager.load("GameScene"),
});

// Render (called automatically if ui is passed to scene.setUI):
ui.render();

// Destroy when scene ends:
ui.destroy();
```

**Key methods:**

| Method                      | Returns         | Description                                   |
| --------------------------- | --------------- | --------------------------------------------- |
| `createPanel(opts)`         | `UIPanel`       | Container with optional background and border |
| `createLabel(opts)`         | `UILabel`       | Static or dynamic text element                |
| `createButton(opts)`        | `UIButton`      | Clickable region with text label              |
| `createProgressBar(opts)`   | `UIProgressBar` | Horizontal fill bar                           |
| `createImage(opts)`         | `UIImage`       | Texture rect                                  |
| `setVisible(node, visible)` | `void`          | Show/hide any node                            |
| `destroy()`                 | `void`          | Frees all widget state                        |

> **Note:** UI coordinates are in canvas pixels. (0, 0) is the top-left of the canvas. No layout engine runs automatically — position nodes manually or compute positions in `onUpdate`.

---

## 5.13 PostProcessSystem

Screen-space post-processing pipeline. Effects are applied as WebGL fragment shader passes after the scene is rendered to an offscreen framebuffer.

```typescript
import { PostProcessSystem } from "@emptysock/engine";

const post = new PostProcessSystem();

// Add effects (order is draw order, not importance):
const bloom = post.add("bloom", {
  threshold: 0.7,
  intensity: 0.4,
  radius: 1.0,
});
const vignette = post.add("vignette", { strength: 0.45, color: "#000" });
const chromo = post.add("chromaticAberration", { offset: 0.003 });

// Toggle at runtime:
bloom.enabled = false;

// Change parameters mid-game:
vignette.setParam("strength", 0.7);

// Remove one effect:
post.remove(chromo);

// Destroy with scene:
post.destroy();
```

**Built-in effects:**

| Effect name           | Key params                             | Description                             |
| --------------------- | -------------------------------------- | --------------------------------------- |
| `bloom`               | `threshold`, `intensity`, `radius`     | Bright-pass blur and additive composite |
| `vignette`            | `strength`, `color`                    | Screen-edge darkening                   |
| `chromaticAberration` | `offset`                               | RGB channel split                       |
| `blur`                | `radius`                               | Gaussian blur                           |
| `pixelate`            | `pixelSize`                            | Nearest-neighbour downscale             |
| `scanlines`           | `density`, `opacity`                   | CRT scanline overlay                    |
| `colorGrade`          | `saturation`, `contrast`, `brightness` | Global tone controls                    |

> **Tip:** Effects are composited in add order. Put bloom before colorGrade to grade the bloomed result.

> **Warning:** PostProcessSystem uses a second WebGL framebuffer. On low-end hardware or when rendering at native resolution on a high-DPI display, this can halve frame rate. Test on target hardware before shipping.

---

## 5.14 GamepadSystem

Provides access to the Gamepad API with normalised stick dead-zones and button mapping. Works alongside the `Input` static class — gamepad axes and buttons are also readable through `Input.axis()` and `Input.isPressed()` when a standard mapping is set.

```typescript
import { GamepadSystem } from "@emptysock/engine";

const pads = new GamepadSystem({ deadZone: 0.15 });

// In onUpdate:
pads.poll(); // must call once per frame before reading state

const p0 = pads.get(0); // GamepadState | undefined
if (p0) {
  const { lx, ly, rx, ry } = p0.axes; // -1..1, dead-zone applied
  const jump = p0.isPressed("A"); // button pressed this frame
  const attack = p0.isDown("X"); // button held
  const lt = p0.trigger("LT"); // 0..1 analog trigger
}

// Enumerate connected pads:
for (const pad of pads.connected()) {
  console.log(pad.index, pad.id);
}

// Rumble (where supported):
pads
  .get(0)
  ?.vibrate({ duration: 200, weakMagnitude: 0.3, strongMagnitude: 0.6 });
```

**Standard button names:** `A`, `B`, `X`, `Y`, `LB`, `RB`, `LT`, `RT`, `Start`, `Select`, `L3`, `R3`, `DUp`, `DDown`, `DLeft`, `DRight`.

> **Note:** `pads.poll()` calls `navigator.getGamepads()` — this is a snapshot, not event-driven. Always call it at the top of `onUpdate` before reading pad state.

---

## 5.15 ParticleSystem

Component-based particle emitter. Attach to any entity and the system drives particle emission, physics, and rendering each frame.

**Sprite-based particles:** Pass a `texture` path to render each particle as a sprite instead of a solid-colour circle. The texture is tinted by `colorStart`/`colorEnd` at runtime, so a white-on-transparent PNG gives you maximum colour flexibility. Omit `texture` entirely for the default solid-colour circle renderer.

```typescript
import { ParticleSystem } from "@emptysock/engine";

// Attach emitter to an entity:
const emitter = explosion.addComponent(ParticleSystem, {
  texture: "assets/spark.png", // sprite-based; omit for a solid-colour circle
  emissionRate: 80, // particles per second
  maxParticles: 400,
  lifetime: { min: 0.4, max: 0.9 },
  speed: { min: 120, max: 280 },
  angle: { min: 0, max: 360 },
  gravity: 200, // px/s² downward
  scaleStart: 1.0,
  scaleEnd: 0.0,
  colorStart: "#ffdd44",
  colorEnd: "#ff4400",
  blendMode: "additive", // 'normal' | 'additive'
  shape: { type: "point" }, // or { type: 'circle', radius: 24 }
});

// One-shot burst (stops emission after the burst):
emitter.burst(60);

// Stop emitting but let existing particles finish:
emitter.stop();

// Stop emitting and immediately clear particles:
emitter.clear();
```

> **Tip:** Export emitter configs from the Particle Editor panel (section 7.7) and paste them directly as the second argument to `addComponent(ParticleSystem, config)`.

> **Note:** `destroy()` is handled by `entity.destroy()` — no separate teardown is required.

---

## 5.16 LayerSystem

Manages named render layers and controls draw order, visibility, and per-layer camera parallax. Entities are assigned to a layer; the `RenderSystem` draws layers in ascending `zOrder`.

```typescript
import { LayerSystem } from "@emptysock/engine";

// Set up layers once in onLoad:
const layers = new LayerSystem();

layers.defineLayer({
  name: "Background",
  zOrder: 0,
  parallax: { x: 0.2, y: 0.2 },
});
layers.defineLayer({
  name: "Midground",
  zOrder: 10,
  parallax: { x: 0.6, y: 0.6 },
});
layers.defineLayer({ name: "Gameplay", zOrder: 20 }); // scrolls 1:1
layers.defineLayer({ name: "FX", zOrder: 30, blendMode: "additive" });
layers.defineLayer({ name: "UI", zOrder: 40, fixed: true }); // camera-fixed

// Assign entities to layers:
layers.addToLayer("Background", backgroundSprite);
layers.addToLayer("Gameplay", player);
layers.addToLayer("FX", explosionEmitter);

// Toggle visibility (culls the whole layer from the render pass):
layers.setVisible("FX", false);
layers.setVisible("FX", true);

// Change parallax at runtime:
layers.setParallax("Background", { x: 0.3, y: 0.1 });

// Remove an entity from its layer (entity retains its data, just excluded from render):
layers.removeFromLayer("Gameplay", player);

// Enumerate layers in draw order:
for (const layer of layers.sorted()) {
  console.log(layer.name, layer.zOrder, layer.visible);
}

// Destroy with scene:
layers.destroy();
```

**Key options on `defineLayer`:**

| Option      | Type                     | Description                                             |
| ----------- | ------------------------ | ------------------------------------------------------- |
| `name`      | `string`                 | Unique layer identifier                                 |
| `zOrder`    | `number`                 | Ascending draw order (lower = further back)             |
| `parallax`  | `{ x, y }`               | Camera offset multiplier; defaults to `{ x: 1, y: 1 }`  |
| `blendMode` | `'normal' \| 'additive'` | Composite mode for the layer                            |
| `fixed`     | `boolean`                | If true, layer ignores camera translation (UI use case) |

> **Integration with RenderSystem:** Pass the `LayerSystem` instance to `scene.setLayerSystem(layers)` and the render pipeline reads layer assignments automatically. Without this call, all entities render in insertion order with no parallax.

---

## 5.17 VNSystem (Story Graph)

Plays back a branching dialogue script exported from the **Story Graph** panel (Module → Story Graph). The script is a JSON file produced by the Story Graph's Export button; it contains Dialogue nodes, Choice nodes, and Condition nodes.

```typescript
import {
  VNSystem,
  type VNNode,
  type VNDialogueNode,
  type VNChoiceNode,
} from "@emptysock/engine";

const vn = new VNSystem();

// Load a script exported from the Story Graph panel:
await vn.loadScript("assets/story/chapter1.vnscript");

// Register a node callback — called each time the active node changes:
vn.onNode((node: VNNode) => {
  if (node.type === "dialogue") {
    const d = node as VNDialogueNode;
    renderDialogue(d.speaker, d.text); // render however you like
  } else if (node.type === "choice") {
    const c = node as VNChoiceNode;
    renderChoices(c.options.map((o) => o.label));
  }
});

// Begin playback from the first node:
vn.play();

// Advance a Dialogue node to its successor:
vn.advance();

// Select a choice (zero-indexed) on a Choice node:
vn.choose(1);

// Skip auto-advance delay (if configured in the script):
vn.skip();

// Jump to a specific node by its id (use for save/resume):
vn.jumpToNode("node-uuid-here");

// Variables — read and write arbitrary flags for Condition nodes:
vn.setVariable("metStranger", true);
const met = vn.getVariable("metStranger"); // boolean | string | number | undefined

// Read the full variable map (for serialisation):
const vars = vn.getVariables(); // Record<string, string | number | boolean>

// Destroy when the scene ends:
vn.destroy();
```

**Node types returned by `onNode`:**

| `node.type`   | Interface         | Key fields                                                 |
| ------------- | ----------------- | ---------------------------------------------------------- |
| `'dialogue'`  | `VNDialogueNode`  | `id`, `speaker`, `text`                                    |
| `'choice'`    | `VNChoiceNode`    | `id`, `options: { label, targetId }[]`                     |
| `'condition'` | `VNConditionNode` | `id`, `variable`, `value`, `trueTargetId`, `falseTargetId` |

**Condition nodes** are evaluated automatically when the system reaches them — `onNode` is not called for Condition nodes. The system reads the stored variable with `getVariable()`, compares it to `node.value`, and follows the appropriate branch.

**Auto-advance:** If a Dialogue node in the script has a `delay` property set (configured in the Story Graph editor), the system automatically calls `advance()` after the delay in seconds. Call `skip()` to bypass the delay immediately.

> **Story Graph panel:** Open it via **Module → Story Graph** in the IDE menu bar. The panel is an SVG-based node graph. See Section 7 (IDE Reference) for panel controls and the Story Graph panel description. Export the finished graph as `.vnscript` JSON and load it with `vn.loadScript()`.

> **Save/resume pattern:** Call `vn.jumpToNode(savedNodeId)` and restore variables with `vn.setVariable()` before calling `vn.play()`. See the visual novel tutorial (Section 13) for a full example.

---

## 5.14 AutoTileSystem

Selects the correct tile variant for a cell based on its eight neighbours. Each rule set is keyed to a base tile index; rules match a bitmask where bit 0 = NW, 1 = N, 2 = NE, 3 = W, 4 = E, 5 = SW, 6 = S, 7 = SE.

```typescript
import { AutoTileSystem } from "@emptysock/engine";

const auto = new AutoTileSystem();

auto.addRuleSet({
  id: "grass",
  baseTileIndex: 3,
  defaultTileIndex: 3,
  rules: [
    { mask: 0b00010000, tileIndex: 4 }, // right neighbour only
    { mask: 0b00000100, tileIndex: 5 }, // left neighbour only
    // …more rules…
  ],
});

// Call resolve() whenever a cell is painted:
const tileIndex = auto.resolve(col, row, 3, (c, r) => tilemap.getTile(c, r));
tilemap.setTile(col, row, tileIndex);
```

The Tilemap Editor's **Auto-tile Rules** modal writes and reads rule sets in this format. Export the rule set as JSON and load it at runtime via `auto.addRuleSet(parsedJson)`.

---

## 5.15 VariableStore

Indexed integer variables (1–1000) and boolean switches (1–1000), persisted automatically to `localStorage`. The IDE's **Variables** panel reads and writes this store.

```typescript
import { VariableStore } from "@emptysock/engine";

const vars = new VariableStore();
vars.load(); // restore from localStorage

vars.setVarName(1, "gold");
vars.setVar(1, 500);
console.log(vars.getVar(1)); // 500

vars.setSwitchName(1, "doorOpen");
vars.setSwitch(1, true);
console.log(vars.getSwitch(1)); // true

vars.save(); // persist to localStorage

// Snapshot / restore (for save-game integration):
const snap = vars.snapshot(); // VariableStoreData
vars.restore(snap);
```

**MapEventSystem integration:** `set-variable` and `set-switch` commands in map events read from and write to a VariableStore by index.

---

## 5.16 MapEventSystem

Tile-aligned event system similar to RPG Maker / GMS2. Place events on tile coordinates; call `update()` each frame with the player's current tile position.

```typescript
import { MapEventSystem } from "@emptysock/engine";

const events = new MapEventSystem();

events.addEvent({
  id: "chest-event",
  tileX: 5,
  tileY: 8,
  trigger: "action-button", // 'autorun' | 'player-touch' | 'action-button' | 'parallel'
  commands: [
    { type: "show-dialogue", speaker: "Narrator", text: "You found a sword!" },
    { type: "set-variable", index: 2, value: 1 },
  ],
});

events.setHandler(async (cmd) => {
  if (cmd.type === "show-dialogue") {
    await showDialogue(cmd.speaker, cmd.text);
  } else if (cmd.type === "set-variable") {
    varStore.setVar(cmd.index, cmd.value);
  }
  // handle other commands…
});

// In onUpdate:
events.update(playerTileX, playerTileY, Input.isJustPressed("Space"));
```

Trigger types: `autorun` runs once on entry; `player-touch` fires when the player steps on the tile; `action-button` fires when the action key is pressed on the tile; `parallel` runs every frame concurrently.

---

## 5.17 GridMovementBehavior

Smooth 4-directional tile-aligned movement. The entity slides between tile centres; new input is accepted only when the entity is at rest.

```typescript
import { GridMovementBehavior } from "@emptysock/engine";

const mover = new GridMovementBehavior({
  tileSize: 32,
  speed: 4, // tiles per second
  input, // InputSystem instance
  isSolid: (tx, ty) => tilemap.isSolid(tx, ty),
});

player.addBehavior(mover);

// In onUpdate (entity.update calls all behaviors automatically):
player.update(dt);
```

Set `mover.speed` at runtime to change movement speed. The entity requires a `Transform` component.

---

## 5.18 CharacterStage

Renders character sprites at predefined stage positions (left, center, right) with image fade transitions. Designed for visual-novel-style scenes.

```typescript
import { CharacterStage } from "@emptysock/engine";

const stage = new CharacterStage({
  canvasWidth: 800,
  canvasHeight: 600,
  baselineY: 0.85, // character feet rest at 85% canvas height
  maxHeightFraction: 0.7,
});

stage.show("left", "assets/chars/alice_neutral.png", { fadeDuration: 0.3 });
stage.show("center", "assets/chars/bob_happy.png");
stage.hide("left", 0.2);

// In onUpdate:
stage.update(dt);

// In your render callback:
stage.render(ctx);
```

---

## 5.19 VNBackgroundLayer

Manages a background image and an optional full-screen CG overlay with cross-fade transitions. Draw it before characters and UI.

```typescript
import { VNBackgroundLayer } from "@emptysock/engine";

const bg = new VNBackgroundLayer({
  canvasWidth: 800,
  canvasHeight: 600,
  fadeDuration: 0.5,
});

bg.setBackground("assets/bg/forest_day.png", { fit: "cover" });

// Show a full-screen CG:
bg.showCG("assets/cg/ending_01.png", { fit: "contain" });
bg.clearCG();

// In onUpdate:
bg.update(dt);

// In your render callback (draw before characters):
bg.render(ctx);
```

Fit modes: `'cover'` (fill, crop sides), `'contain'` (letterbox), `'stretch'`.

---

## 5.20 VNTextbox

Pre-built dialogue box rendered by UISystem. Attach it to a VNSystem instance to have it update automatically on each node change.

```typescript
import { VNTextbox, VNSystem } from "@emptysock/engine";

const vn = new VNSystem();
vn.loadScript(scriptJson);

const textbox = new VNTextbox({
  canvasWidth: 800,
  canvasHeight: 600,
  height: 160,
  fontSize: 16,
});
textbox.bind(vn);

// In your render callback (after game world, before overlay):
UISystem.render(ctx, 800, 600);

// Clicking the advance button:
vn.advance();
```

All colors and dimensions are optional constructor parameters — see `VNTextboxOptions` for the full list.

---

## 5.21 VNScriptConvert

Converts between the Story Graph (visual-editor JSON) and the VNSystem `DialogueTree` format (`.vnscript` JSON).

```typescript
import {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "@emptysock/engine";

// After exporting a .storyGraph.json from the IDE:
const tree = storyGraphToDialogueTree(storyGraphJson);
vn.load(tree);

// To round-trip back into the editor:
const graph = dialogueTreeToStoryGraph(tree);
```

The IDE calls `storyGraphToDialogueTree` automatically when you click **Build** in the Story Graph panel. Use `dialogueTreeToStoryGraph` if you build scripts programmatically and want to view them in the editor.

---

## 5.22 CGGallery

Tracks which CG images the player has unlocked. Persists unlock state through SaveSystem.

```typescript
import { CGGallery } from "@emptysock/engine";

const gallery = new CGGallery({
  entries: [
    {
      id: "cg01",
      imagePath: "assets/cg/ending_normal.png",
      title: "Normal Ending",
    },
    {
      id: "cg02",
      imagePath: "assets/cg/ending_true.png",
      title: "True Ending",
    },
  ],
  saveSystem, // SaveSystem instance (optional — skip to keep flags in memory)
  saveSlot: "cg_gallery",
});

gallery.load(); // restore from save
gallery.unlock("cg01");

console.log(gallery.unlockedCount); // 1
console.log(gallery.totalCount); // 2

for (const entry of gallery.unlockedEntries) {
  renderThumbnail(entry.imagePath, entry.title ?? "");
}
```

Integrate with VNSystem: call `gallery.unlockFromNode(cgId)` inside a `vn.onNode` handler to unlock a CG when the script reaches a tagged node.

---

## 5.23 BattleSystem

Self-contained, opt-in turn-based RPG battle module. No game loop integration — the system is event-driven and resolves a full round whenever all party members have submitted actions.

### Constructor

```typescript
new BattleSystem(options?: BattleSystemOptions)
```

| Option           | Type             | Default                             | Description                               |
| ---------------- | ---------------- | ----------------------------------- | ----------------------------------------- |
| `db`             | `BattleDatabase` | `{ skills: [], statusEffects: [] }` | Skill and status-effect definitions       |
| `critChance`     | `number`         | `0.0625`                            | Base critical-hit probability             |
| `critMultiplier` | `number`         | `1.5`                               | Damage multiplier on a crit               |
| `fleeChance`     | `number`         | `0.5`                               | Probability that a `flee` action succeeds |

### Setup methods

```typescript
battle.addPartyMember(combatant: Combatant): void
battle.addEnemy(combatant: Combatant): void
battle.loadDatabase(db: BattleDatabase): void
```

All setup calls must happen before `start()`. `loadDatabase` replaces the current database.

```typescript
battle.setDamageFormula(
  fn: (atk: number, def: number, power: number, isCrit: boolean, critMultiplier: number) => number
): void
```

Overrides the `physical` formula only. The default is `Math.max(1, Math.floor((atk - def / 2) * power * (isCrit ? critMult : 1)))`.

### Event subscription

```typescript
const unsub = battle.onEvent((event: BattleEvent) => {
  /* ... */
});
unsub(); // stop listening
```

Subscribe before calling `start()`. Multiple handlers are supported.

### Battle control

```typescript
battle.start(): void
```

Fires `battle-start`, then `round-start` (round 1), then the first `action-needed` event for the first party member in speed order.

```typescript
battle.submitAction(combatantId: string, action: BattleAction): void
```

Submit an action for one party member while the phase is `'input'`. Valid actions:

- `{ type: 'attack', targetId }` — physical attack
- `{ type: 'skill', skillId, targetId }` — use a skill from the database
- `{ type: 'flee' }` — attempt to flee; rolls against `fleeChance`

After all party members have submitted, enemy actions are auto-chosen and the round resolves. Calling `submitAction` in any phase other than `'input'`, or for a combatant that is not awaiting input, is a no-op.

### State accessors

```typescript
battle.getPhase(): BattlePhase
battle.getCombatant(id: string): Combatant | undefined
battle.getParty(): readonly Combatant[]
battle.getEnemies(): readonly Combatant[]
battle.getRound(): number
```

`getCombatant` returns a frozen snapshot; mutating it has no effect.

### Lifecycle

```typescript
battle.destroy(): void
```

Clears all event handlers and prevents further processing. Call in `onDestroy`.

---

### Turn order and resolution

Combatants are sorted by `speed` descending each round; ties broken by `luck` (higher wins), then insertion order. Within a round:

1. Status effects are applied at the start of each combatant's turn: HP drain fires a `damage` event, `attackMultiplier` / `defenseMultiplier` modify effective stats for that turn, and `turnsRemaining` is decremented (effects at 0 fire `status-expired` and are removed).
2. The combatant's action executes.
3. Victory / defeat is checked after each action. Victory (all enemies dead) is checked before defeat.

---

### Usage example

```typescript
import {
  BattleSystem,
  type Combatant,
  type BattleDatabase,
  type BattleEvent,
} from "@emptysock/engine";

const db: BattleDatabase = {
  skills: [
    {
      id: "fireball",
      name: "Fireball",
      mpCost: 10,
      targetType: "all-enemies",
      formula: "magical",
      power: 1.4,
    },
    {
      id: "heal",
      name: "Heal",
      mpCost: 8,
      targetType: "single-ally",
      formula: "fixed",
      power: 50,
      isHeal: true,
    },
  ],
  statusEffects: [
    {
      id: "poison",
      name: "Poison",
      hpDrainPercentPerTurn: 0.1,
    },
  ],
};

const hero: Combatant = {
  id: "hero",
  name: "Hero",
  stats: {
    hp: 100,
    maxHp: 100,
    mp: 40,
    maxMp: 40,
    attack: 20,
    defense: 10,
    speed: 15,
    luck: 5,
  },
  statusEffects: [],
  isParty: true,
};

const slime: Combatant = {
  id: "slime",
  name: "Slime",
  stats: {
    hp: 60,
    maxHp: 60,
    mp: 0,
    maxMp: 0,
    attack: 12,
    defense: 5,
    speed: 8,
    luck: 2,
  },
  statusEffects: [],
  isParty: false,
};

// In onLoad:
const battle = new BattleSystem({ db });
battle.addPartyMember(hero);
battle.addEnemy(slime);

const unsub = battle.onEvent((event: BattleEvent) => {
  switch (event.kind) {
    case "action-needed":
      // Prompt the player; here we auto-submit for brevity
      battle.submitAction(event.combatantId, {
        type: "attack",
        targetId: "slime",
      });
      break;
    case "damage":
      // Update HP bars
      break;
    case "victory":
      // Show victory screen
      break;
    case "defeat":
      // Show game-over screen
      break;
  }
});

battle.start();

// In onDestroy:
unsub();
battle.destroy();
```

---

## UISystem & Widget API

UISystem renders a Canvas 2D overlay on top of the PixiJS scene — the right layer for screen-space HUD elements, menus, and dialogue boxes. Widgets that need to float in world space (health bars above enemies, damage numbers) stay in PixiJS as regular scene objects.

### Widget classes

All widgets live in `@emptysock/engine`. Import them directly:

```ts
import {
  LabelWidget,
  ImageWidget,
  ButtonWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
} from "@emptysock/engine";
```

| Widget              | Key properties                                                         |
| ------------------- | ---------------------------------------------------------------------- |
| `LabelWidget`       | `text`, `font`, `fontSize`, `color`, `align`                           |
| `ButtonWidget`      | `label`, `icon?`, `disabled`, `animateOnHover`, state machine          |
| `ImageWidget`       | `src`, `scaleMode` (stretch / fit / fill / none), `tint?`              |
| `PanelWidget`       | `background`, `border?`, `borderWidth`, `cornerRadius`, `children`     |
| `ProgressBarWidget` | `value`, `min`, `max`, `fillColor`, `trackColor`, `direction` (h/v)    |
| `SliderWidget`      | `value`, `min`, `max`, `step`, `trackColor`, `thumbColor`, `onChange?` |
| `CheckboxWidget`    | `checked`, `label`, `color`, `borderColor`, `onChange?`                |

All widgets share the base `Widget` class:

```ts
widget.x          // pixel offset from anchor
widget.y
widget.width
widget.height
widget.anchor     // 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
widget.visible
widget.alpha
widget.children   // Widget[] — mutable, for panels and compound layouts
widget.on(event, handler)
widget.off(event, handler)
widget.animate(name, opts?)
```

Events: `'click'`, `'hover'`, `'hoverOut'`, `'change'`, `'animEnd'`.

Animations: `'fadeIn'`, `'fadeOut'`, `'slideIn'`, `'slideOut'`, `'pop'`, `'shake'`. All accept `{ duration?: number, easing?: string, direction?: 'left'|'right'|'up'|'down' }`.

### UISystem.add / remove

`UISystem.add(widget)` adds a widget to the root widget tree. `UISystem.removeWidget(widget)` removes it. `UISystem.clear()` removes all UIComponents and all widgets.

### Scene access

Inside any `Scene` subclass, `this.uiSystem` is the UISystem singleton and `this.engine` exposes `pushScene`, `popScene`, and `loadScene`:

```ts
class PauseMenuScene extends Scene {
  private _panel: PanelWidget | null = null;

  onLoad(): void {
    const panel = new PanelWidget({
      anchor: "center",
      width: 300,
      height: 200,
    });
    this._panel = panel;

    const title = new LabelWidget({
      text: "Paused",
      fontSize: 24,
      anchor: "top",
      y: 16,
    });
    const resumeBtn = new ButtonWidget({
      label: "Resume",
      anchor: "center",
      y: 20,
    });
    resumeBtn.on("click", () => this.engine.popScene());

    const quitBtn = new ButtonWidget({
      label: "Quit",
      anchor: "center",
      y: 70,
    });
    quitBtn.on("click", () => this.engine.loadScene("MainMenu"));

    panel.children.push(title, resumeBtn, quitBtn);
    this.uiSystem.add(panel);
    panel.animate("fadeIn");
  }

  onDestroy(): void {
    if (this._panel !== null) this.uiSystem.removeWidget(this._panel);
  }
}

// In any scene, push the pause menu on top:
this.engine.pushScene(new PauseMenuScene("pause"));
```

### Scene stack

`engine.pushScene(scene)` pauses the current scene and starts the new one on top. `engine.popScene()` stops the top scene and resumes the one underneath. `SceneManager.stackDepth` returns the current depth.

### ImageLoader

UISystem constructs a default `fetch` + `createImageBitmap` loader internally — no setup needed for the common case. To override (custom CDN, auth headers, mocked source in tests), call `UISystem.setImageLoader(loader)` once during initialisation.

### Normalised coordinates

Widget `x` and `y` accept pixel values. Anchor-based layout keeps widgets pinned to screen edges regardless of canvas size:

```ts
// Bottom-center health bar, 20px above the edge:
const hp = new ProgressBarWidget({
  anchor: "bottom",
  x: 0,
  y: 20,
  width: 300,
  height: 12,
});
UISystem.add(hp);

// Top-right score label, 16px from the corner:
const score = new LabelWidget({ text: "0", anchor: "top-right", x: 16, y: 16 });
UISystem.add(score);
```
