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

// In onUpdate — assumes `input` is an InputSystem instance (see §5.3):
const ctrl = player.requireComponent(CharacterController);
const h = input.isKeyDown("ArrowRight")
  ? 1
  : input.isKeyDown("ArrowLeft")
    ? -1
    : 0;
ctrl.moveAndSlide({ x: h * 200 * dt, y: 0 });
```

**Collision and sensor events:**

Register callbacks directly on the `PhysicsBody` value component. `PhysicsSystem` calls them when it drains real Rapier collision/intersection events each physics step — the callback receives the _other_ body's `PhysicsBody`, not an `Entity`.

```typescript
const body = player.requireComponent(PhysicsBody);
body.onCollisionEnter((other, contact) => {
  if (contact.impactForce > 50) playerDie();
});
body.onCollisionExit((other, contact) => {
  /* ... */
});

// Sensors (isSensor: true) get their own enter/exit/stay events:
const trigger = new PhysicsBody({ isSensor: true });
trigger.onSensorEnter((other) => {
  /* ... */
});
trigger.onSensorStay((other) => {
  /* fires every step the other body remains inside */
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

## 5.3 InputSystem

`InputSystem` is the engine's keyboard, mouse, and touch input class. Create one instance in `onLoad`, call `attach()`, and call `flush()` at the start of each frame before reading any state:

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

`SaveSystem` is instanced and synchronous. It is generic persistence only — the shape of a slot is a Zod schema you supply (or the default `GameSaveSlot` shape if you don't):

```typescript
import { SaveSystem, type GameSaveSlot } from "@emptysock/engine";

// Default GameSaveSlot shape: { id, scene, data, timestamp, playtime }
const saves = new SaveSystem();

saves.save("slot-1", { scene: "Level2", data: { score: 4200, flags: {} } });

const slot: GameSaveSlot | null = saves.load("slot-1"); // null if missing/corrupt/invalid
saves.delete("slot-1");
const allSlots = saves.listSlots(); // GameSaveSlot[]
```

`load()` and `listSlots()` already validate against the configured schema — a non-null/included result is guaranteed to match the shape, no separate `schema.parse(raw.data)` step needed.

For a slot shape that doesn't fit `{ scene, data, timestamp, playtime }`, pass your own schema instead of relying on the default:

```typescript
import { z } from "zod";

const CharacterSaveSchema = z.object({
  id: z.string(),
  characterName: z.string(),
  level: z.number().int().positive(),
  unlockedSkills: z.array(z.string()),
});
type CharacterSave = z.infer<typeof CharacterSaveSchema>;

const characterSaves = new SaveSystem<CharacterSave>(
  "char_save_",
  CharacterSaveSchema,
);
characterSaves.save("hero-1", {
  characterName: "Aria",
  level: 5,
  unlockedSkills: ["dash"],
});
```

See [SaveSystem reference](../reference/systems/save-system.md) for the full schema-extension API.

---

## 5.7 Localisation

`LocalisationSystem` is instanced — create one in `onLoad`, register locale data with `addTranslations()`, then call `setLocale()`.

```typescript
import { LocalisationSystem } from "@emptysock/engine";
import { z } from "zod";

// In onLoad:
const localisation = new LocalisationSystem();
const TranslationMapSchema = z.record(z.string());

const enRaw = await (await fetch("assets/i18n/en.json")).json();
const frRaw = await (await fetch("assets/i18n/fr.json")).json();
localisation.addTranslations("en", TranslationMapSchema.parse(enRaw));
localisation.addTranslations("fr", TranslationMapSchema.parse(frRaw));

localisation.setLocale("fr");

localisation.t("greeting"); // → "Bonjour"
localisation.t("score", { n: 42 }); // → "Score : 42"
localisation.t("missing.key"); // → 'missing.key' (never throws)

const lang = localisation.currentLocale; // "fr"
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

## 5.11 TweenManager

`TweenManager` interpolates numeric properties on any plain object over a duration. Create one instance per scene, call `update(dt)` each frame. When the scene unloads the instance is garbage-collected with the scene — no explicit teardown is needed.

```typescript
import { TweenManager, type TweenOptions } from "@emptysock/engine";

export class GameScene extends Scene {
  private _tweens!: TweenManager;

  override onLoad(): void {
    this._tweens = new TweenManager();
  }

  override onUpdate(dt: number): void {
    this._tweens.update(dt); // required — drives all active tweens
  }
}

// Animate any object's numeric properties to new values:
this._tweens.to(
  entity.position,
  { x: 400, y: 200 },
  {
    duration: 0.5,
    ease: "bounceOut",
  },
);

// With delay and completion callback:
this._tweens.to(
  sprite,
  { alpha: 0 },
  {
    duration: 0.3,
    ease: "sineIn",
    delay: 0.2,
    onComplete: () => entity.destroy(),
  },
);

// Scene-local timers (no handles to cancel — stop when scene unloads):
this._tweens.after(2.0, () => this.spawnWave());
this._tweens.every(5.0, () => this.spawnPowerUp());
```

**Options:**

| Option       | Type         | Default    | Notes                           |
| ------------ | ------------ | ---------- | ------------------------------- |
| `duration`   | `number`     | required   | Seconds                         |
| `ease`       | `EasingName` | `'linear'` | See easings list below          |
| `delay`      | `number`     | `0`        | Seconds before tween starts     |
| `onComplete` | `() => void` | —          | Called once when tween finishes |

**Easing functions:** `linear`, `sineIn/Out/InOut`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `bounceOut`, `elasticOut`, `backIn/Out`.

> **Note:** `TweenManager` only animates numeric properties. Non-numeric properties are silently ignored. For complex multi-step sequences, use coroutines (`yield waitSeconds(n)`) — they are clearer than chained `onComplete` callbacks.

---

## 5.12 UISystem

A retained-mode 2D UI overlay rendered on top of the scene canvas using Canvas 2D. `UISystem` is a module-level singleton — access it via `UISystem` (static calls) or `this.uiSystem` inside any `Scene` subclass.

```typescript
import {
  UISystem,
  PanelWidget,
  LabelWidget,
  ButtonWidget,
  ProgressBarWidget,
  SceneManager,
} from "@emptysock/engine";

// In onLoad — build the widget tree:
const hp = new ProgressBarWidget({
  anchor: "top-left",
  x: 16,
  y: 16,
  width: 200,
  height: 14,
  fillColor: 0xe74c3c,
  trackColor: 0x333333,
  value: 1.0,
});
UISystem.add(hp);

const btn = new ButtonWidget({
  label: "Retry",
  anchor: "center",
  width: 120,
  height: 40,
});
btn.on("click", () => SceneManager.load("GameScene"));
btn.animate("fadeIn");
UISystem.add(btn);

// In onUpdate:
UISystem.update(dt);

// In onDestroy:
UISystem.clear();
```

**Key UISystem methods:**

| Method                                    | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| `UISystem.add(widget)`                    | Add a root widget to the overlay                 |
| `UISystem.removeWidget(widget)`           | Remove a specific root widget                    |
| `UISystem.clear()`                        | Remove all widgets                               |
| `UISystem.update(dt, px?, py?, cw?, ch?)` | Tick animations and hover state                  |
| `UISystem.render(ctx, cw, ch)`            | Draw (called automatically in scene render pass) |

**Widget classes:** `PanelWidget`, `LabelWidget`, `ButtonWidget`, `ImageWidget`, `ProgressBarWidget`, `SliderWidget`, `CheckboxWidget` — see the **UISystem & Widget API** reference section at the end of this document.

> **Note:** UI coordinates are in canvas pixels. Widgets are positioned relative to their `anchor` point on the canvas — use `anchor: 'top-left'` with `x/y` offsets for HUD elements, `anchor: 'center'` for overlay menus.

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

**Per-layer filters** (`setLayerFilter(layerId, options)`) are a separate mechanism from the effects above — one real PixiJS `Filter` attached to a specific render layer's container, rebuilt only when the filter's `type` changes (see `RenderSystem.syncPostProcessLayerFilters()`). `"rain-glass"` is one of these layer filter types:

```typescript
import { PostProcessSystem } from "@emptysock/engine";

const post = new PostProcessSystem();
post.setLayerFilter("foreground", {
  type: "rain-glass",
  intensity: 0.6, // 0..1 overall droplet opacity/refraction strength
  dropletSize: 0.12, // UV-space cell size — smaller = more, smaller drops
  dropletSpeed: 0.35, // UV-space fall speed per second for streaks
  streakAmount: 0.5, // 0..1 blend: 0 = static droplets, 1 = falling streaks
});
```

`"rain-glass"` is a GPU-cheap, screen-space approximation of streaking water droplets on the camera lens (an Asphalt-8-Airborne-style effect), built as a single fragment-shader pass — see `RainGlassFilter.ts`'s header comment for the full technique. It renders through `RenderSystem` (a real `pixi.js` `Filter`, `RainGlassFilter`) only; `cssFilterForLayer()` returns `''` for it, since there is no CSS filter primitive that can express procedural per-pixel UV refraction — a host that draws a layer as a DOM element gets no visual effect for this type. This is unrelated to and does not replace `ParticleEmitter`-based background rain (falling raindrop sprites in the world) — the two are commonly used together, one for rain falling through the scene, one for droplets clinging to the "lens".

---

## 5.14 GamepadSystem

Provides access to the browser Gamepad API with snapshot-based polling. For keyboard and mouse input, use `InputSystem` directly — see §5.3. `GamepadSystem` handles gamepad-specific axis and button queries.

```typescript
import {
  GamepadSystem,
  type GamepadState,
  type DualRumbleOptions,
} from "@emptysock/engine";

const pads = new GamepadSystem();

// In onUpdate — must call update() before reading state:
pads.update();

const state: GamepadState | null = pads.getState(0);
if (state !== null && state.connected) {
  // buttons: ReadonlyArray<boolean> indexed by standard gamepad mapping
  const jump = state.buttons[0] ?? false; // A / Cross
  const attack = state.buttons[2] ?? false; // X / Square
  // axes: ReadonlyArray<number>, -1..1
  const lx = state.axes[0] ?? 0; // left stick X
  const ly = state.axes[1] ?? 0; // left stick Y
}

// Rumble (where supported by the browser):
pads.rumble(0, 0.5, 200); // equal-motor rumble
pads.rumbleDual(0, { weakMagnitude: 0.3, strongMagnitude: 0.8, duration: 300 });
```

> **Note:** `pads.update()` calls `navigator.getGamepads()` — this is a snapshot, not event-driven. Always call it at the top of `onUpdate` before reading pad state.

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

Controls draw order: entities are assigned to a named layer at an explicit depth. `RenderSystem` draws layers in ascending index order, then entities within a layer in ascending depth. Four built-in layers are pre-registered by the constructor.

```typescript
import { LayerSystem, LAYER, type LayerConfig } from "@emptysock/engine";

// LAYER constants for the four built-in layers:
// LAYER.BACKGROUND = -1000, LAYER.DEFAULT = 0, LAYER.FOREGROUND = 100, LAYER.UI = 1000

private _layers: LayerSystem | null = null

override onLoad(): void {
  this._layers = new LayerSystem()
  // Built-in layers already registered: 'background', 'default', 'foreground', 'ui'

  // Add project-specific layers (use index gaps for future insertions):
  this._layers.defineLayer('midground', 50)
  this._layers.defineLayer('fx', 80)

  // Assign entities by id, with optional depth within the layer:
  this._layers.addEntity(background.id, 'background')
  this._layers.addEntity(treeBack.id,  'midground', -10)
  this._layers.addEntity(treeFront.id, 'midground',  10)
  this._layers.addEntity(player.id,    'foreground')
  this._layers.addEntity(hud.id,       'ui')
}

// Hide / show an entire layer (culls it from the render pass):
this._layers.setVisible('fx', false)
this._layers.setVisible('fx', true)
const visible = this._layers.isVisible('fx')  // boolean

// Move an entity's depth within its current layer:
this._layers.setDepth(treeBack.id, -20)

// Unregister an entity (entity still exists — excluded from sort):
this._layers.removeEntity(oldEntity.id)

// Sort key for custom draw calls ([layerIndex, depth]):
const [layerIdx, depth] = this._layers.getSortKey(entity.id)

// All entities on a layer, sorted by depth ascending:
const onMidground = this._layers.getEntitiesOnLayer('midground')
// → Array<{ entityId: number; depth: number }>

// All layer configs sorted by index (render order):
const sorted: LayerConfig[] = this._layers.getLayersSorted()

override onDestroy(): void {
  this._layers.destroy()
}
```

**API reference:**

| Method               | Signature                                                     | Notes                                   |
| -------------------- | ------------------------------------------------------------- | --------------------------------------- |
| `defineLayer`        | `(name: string, index: number): void`                         | Lower index = drawn behind              |
| `addEntity`          | `(entityId: number, layerName: string, depth?: number): void` | Unknown layer falls back to `'default'` |
| `removeEntity`       | `(entityId: number): void`                                    | Unregisters entity from sort            |
| `setDepth`           | `(entityId: number, depth: number): void`                     | Depth within current layer              |
| `getSortKey`         | `(entityId: number): [number, number]`                        | `[layerIndex, depth]`                   |
| `getEntitiesOnLayer` | `(name: string): Array<{entityId, depth}>`                    | Sorted by depth ascending               |
| `getLayersSorted`    | `(): LayerConfig[]`                                           | All layers sorted by index              |
| `setVisible`         | `(name: string, visible: boolean): void`                      | Cull whole layer                        |
| `isVisible`          | `(name: string): boolean`                                     |                                         |
| `destroy`            | `(): void`                                                    | Call in `onDestroy`                     |

---

## 5.17 VNSystem (Story Graph)

Plays back a branching dialogue tree exported from the **Story Graph** panel (Module → Story Graph). Export the graph as `.storyGraph.json`, convert to a `DialogueTree` with `storyGraphToDialogueTree`, then call `vn.load(tree)`. `load()` is synchronous and fires `onNode` for the first node immediately.

```typescript
import {
  VNSystem,
  storyGraphToDialogueTree,
  type IVNListener,
  type DialogueNode,
  type StoryGraph,
} from "@emptysock/engine";

// In onLoad — register a listener BEFORE calling load():
override async onLoad(): Promise<void> {
  const response = await fetch("assets/story/chapter1.storyGraph.json");
  const graph: StoryGraph = await response.json() as StoryGraph;
  const tree = storyGraphToDialogueTree(graph);

  const vn = new VNSystem();

  const listener: IVNListener = {
    onNode(node: DialogueNode) {
      if (node.type === "dialogue") {
        renderDialogue(node.speaker, node.text);
      } else if (node.type === "choice") {
        renderChoices(node.options);   // options: Array<{ label: string; next: string }>
      }
      // 'jump' nodes resolved automatically — onNode never fires for them
      // 'variable-set' nodes auto-advance; read result via vn.getVariable(key)
    },
    onEvent(eventName, data) {
      handleGameEvent(eventName, data);   // auto-advanced by engine
    },
    onChoice(options) {
      showChoiceButtons(options);   // options: Array<{ label: string; next: string }>
    },
    onEnd() { hideDialogueBox(); },
  };

  vn.setListener(listener);
  vn.load(tree);   // synchronous; onNode fires immediately for first node
}

// Advance a dialogue node to its successor:
vn.advance();

// Select a choice — pass the target node id from the option:
vn.selectOption(option.next);   // option.next is a node id string

// Read the current node at any time:
const node: DialogueNode | null = vn.currentNode;

// Read variables set by 'variable-set' nodes:
const flag: unknown = vn.getVariable("metHero");
```

**`IVNListener` interface** — all fields optional; implement only what you need:

| Callback   | Signature                                              | When called                           |
| ---------- | ------------------------------------------------------ | ------------------------------------- |
| `onNode`   | `(node: DialogueNode) => void`                         | Every node except auto-resolved jumps |
| `onChoice` | `(options: { label: string; next: string }[]) => void` | When a `'choice'` node is reached     |
| `onEnd`    | `() => void`                                           | When the tree has no more nodes       |
| `onEvent`  | `(eventName: string, ...args: unknown[]) => void`      | When an `'event'` node fires          |
| `onCGNode` | `(cgPath: string) => void`                             | When a node carries a CG image path   |

**`DialogueNode` — discriminated union (narrow by `node.type`):**

| `node.type`      | Key fields                                            | Notes                                                                                          |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `'dialogue'`     | `speaker: string`, `text: string`, `next?: string`    |                                                                                                |
| `'choice'`       | `text: string`, `options: { label, next, when? }[]`   | Use `onChoice` or check in `onNode`; `when`-gated options are filtered before `onChoice` fires |
| `'event'`        | `eventName: string`, `data?: Record<string, unknown>` | Engine auto-advances; fires `onEvent`                                                          |
| `'variable-set'` | `variableKey: string`, `variableValue: unknown`       | Engine auto-advances; read via `getVariable()`                                                 |
| `'jump'`         | (resolved automatically)                              | `onNode` never fires                                                                           |
| `'condition'`    | `condition: VariableCondition`, `ifTrue`, `ifFalse?`  | Engine auto-advances based on `evaluateCondition()` against the `VariableStore`                |

**Variable-gated conditionals:** `new VNSystem(store?)` defaults to the shared `variableStore` singleton. `'condition'` nodes route to `ifTrue`/`ifFalse` based on a `VariableCondition` (switch or variable comparison); choice options' `when` field filters the array `onChoice` receives. Set the driving variables from `MapEventSystem` (`set-variable` / `set-switch` commands apply automatically) or directly via `variableStore.setVar` / `setSwitch`. See [VariableStore reference](../reference/systems/variable-store.md) and [VNSystem reference](../reference/systems/vn-system.md#variable-gated-conditionals) for a full runnable example.

**Save/resume:** VNSystem has no internal save state. Store the current node id (`vn.currentNode?.id`) and re-walk the graph on resume. See Section 8 (Story Graph) for a full example.

> `VNSystem` has no `destroy()` — release the reference and it is garbage-collected. Register a listener with `setListener()` before calling `load()` or the first node fires without a listener.

---

## 5.18 AutoTileSystem

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

## 5.19 VariableStore

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

**Conditional logic integration:** `VariableCondition` (also exported from `@emptysock/engine`) is the shared condition shape both `VNSystem` and `MapEventSystem` gate on:

```typescript
import { evaluateCondition, type VariableCondition } from "@emptysock/engine";

const hasKey: VariableCondition = { kind: "switch", index: 2, equals: true };
const strongEnough: VariableCondition = {
  kind: "variable",
  index: 4,
  op: "gte",
  value: 10,
};

evaluateCondition(vars, hasKey); // reads vars.getSwitch(2)
```

`VNSystem` `"condition"` nodes and choice-option `when` fields, and `MapEventSystem`'s per-event `when` field, all evaluate a `VariableCondition` against a `VariableStore` — see 5.20 and `docs/reference/systems/vn-system.md`.

---

## 5.20 MapEventSystem

Tile-aligned event system similar to RPG Maker / GMS2. Place events on tile coordinates; call `update()` each frame with the player's current tile position.

```typescript
import { MapEventSystem, variableStore } from "@emptysock/engine";

const events = new MapEventSystem(); // defaults to the shared `variableStore` singleton
// or: new MapEventSystem(myVariableStore) for a per-save-slot store

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
  }
  // 'set-variable' and 'set-switch' are NOT forwarded here — MapEventSystem
  // applies them to its VariableStore itself. Handle only the other command types.
});

// In onUpdate:
events.update(playerTileX, playerTileY, Input.isPressed("Space"));
```

Trigger types: `autorun` runs once on entry; `player-touch` fires when the player steps on the tile; `action-button` fires when the action key is pressed on the tile; `parallel` runs every frame concurrently.

### Conditional events

Add a `when: VariableCondition` field to gate whether an event can run at all. It is re-checked every frame, so a gated `autorun` or `parallel` event starts as soon as the condition becomes true — no polling needed:

```typescript
events.addEvent({
  id: "secret-passage",
  tileX: 12,
  tileY: 3,
  trigger: "autorun",
  when: { kind: "switch", index: 10, equals: true }, // "bossDefeated"
  commands: [
    { type: "show-dialogue", speaker: "Narrator", text: "A path appears." },
  ],
});

// Elsewhere, another event's set-switch command flips the switch — MapEventSystem
// applies it to the VariableStore automatically:
events.addEvent({
  id: "defeat-boss",
  tileX: 12,
  tileY: 1,
  trigger: "player-touch",
  commands: [{ type: "set-switch", index: 10, value: true }],
});
```

Once the player steps on `defeat-boss`'s tile, `secret-passage`'s `when` condition is met on the very next `update()` call, and its `autorun` fires.

---

## 5.21 GridMovementBehavior

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

## 5.22 CharacterStage

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

## 5.23 VNBackgroundLayer

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

## 5.24 VNTextbox

Pre-built dialogue box rendered by `UISystem`. Creates a panel anchored to the bottom of the canvas with a speaker name plate and a text area. Bind it to a `VNSystem` instance — it syncs automatically whenever the current node changes. Clicking the textbox calls `vn.advance()` automatically.

```typescript
import {
  VNTextbox,
  VNSystem,
  UISystem,
  storyGraphToDialogueTree,
  type VNTextboxOptions,
} from "@emptysock/engine";

class NarrativeScene extends Scene {
  private _vn!: VNSystem;
  private _textbox!: VNTextbox;

  override async onLoad(): Promise<void> {
    const response = await fetch("assets/story/chapter1.storyGraph.json");
    const graph = await response.json();
    const tree = storyGraphToDialogueTree(graph);

    this._vn = new VNSystem();

    this._textbox = new VNTextbox({ canvasWidth: 800, canvasHeight: 600 });
    this._textbox.bind(this._vn); // sync immediately to current node

    // Choice selection is external — VNTextbox shows options as numbered text
    // but selection requires your own buttons:
    this._vn.setListener({
      onChoice: (options) => {
        options.forEach((opt, i) => {
          const btn = createChoiceButton(i + 1, opt.label);
          btn.onClick(() => {
            this._vn.selectOption(opt.next); // opt.next is the target node id
            removeChoiceButtons();
          });
        });
      },
    });

    this._vn.load(tree); // fires onNode for first node immediately
  }

  override onUpdate(dt: number): void {
    UISystem.update(dt);
  }

  override onDestroy(): void {
    this._textbox.destroy(); // removes UISystem components — required
  }
}
```

`VNTextbox` sets `visible` automatically: `dialogue` and `choice` nodes show the box; `event`, `jump`, `variable-set`, and `null` hide it. All constructor options are optional except `canvasWidth` and `canvasHeight` — see `VNTextboxOptions` for the full list.

---

## 5.25 VNScriptConvert

Converts between the Story Graph (`.storyGraph.json` — visual-editor format) and the `DialogueTree` format consumed by `VNSystem.load()`.

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

## 5.26 CGGallery

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

## 5.27 BattleSystem

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

### Configuration methods

```typescript
battle.loadDatabase(db: BattleDatabase): void
battle.setDamageFormula(fn: (ctx: DamageContext) => number): void
```

Both calls must happen before `start()`. `loadDatabase` replaces the current database. `setDamageFormula` overrides the `physical` formula only — the default is `Math.max(1, Math.floor((ctx.effectiveAttack - ctx.effectiveDefense / 2) * ctx.power * (ctx.isCrit ? ctx.critMultiplier : 1)))`.

### Event subscription

```typescript
const unsub = battle.subscribe((event: BattleEvent) => {
  /* ... */
});
unsub(); // stop listening
```

Subscribe before calling `start()` to catch the initial `battle-start`/`round-start`/`action-needed` sequence. Multiple handlers are supported.

### Battle control

```typescript
battle.start(party: readonly Combatant[], enemies: readonly Combatant[]): void
```

Registers the given roster (replacing any previous one) and begins the battle. Fires `battle-start`, then `round-start` (round 1), then the first `action-needed` event for the first party member in speed order. There is no separate `addPartyMember`/`addEnemy` step — the full roster is passed to `start()` directly.

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

const unsub = battle.subscribe((event: BattleEvent) => {
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

battle.start([hero], [slime]);

// In onDestroy:
unsub();
battle.destroy();
```

---

## 5.28 ViewportSystem

Automatic viewport handling: scales a fixed design resolution to fit the actual browser window/container, listens for resize and orientation-change, and feeds the result to `RenderPipeline`/`RenderSystem` and `CameraSystem` so neither goes stale.

```typescript
import {
  RenderPipeline,
  CameraSystem,
  ViewportSystem,
} from "@emptysock/engine";

const renderPipeline = new RenderPipeline();
await renderPipeline.init({ width: 1280, height: 720 });

const camera = new CameraSystem();
camera.attach(renderPipeline.stage);

const viewport = new ViewportSystem();
viewport.init(
  { designWidth: 1280, designHeight: 720, scaleMode: "fit" },
  { renderTarget: renderPipeline, cameraSystem: camera },
);
```

| Scale mode  | Behaviour                                         |
| ----------- | ------------------------------------------------- |
| `"fit"`     | Letterboxes to fit without cropping. Default.     |
| `"fill"`    | Cover-crops to fill the container completely.     |
| `"stretch"` | Stretches to fill exactly, ignoring aspect ratio. |

On resize (via `ResizeObserver` on `config.container`, or `window` `"resize"`/`"orientationchange"` when no container is given), `ViewportSystem` recomputes the letterboxed size, calls `resize(width, height)` on the wired render target, and calls `CameraSystem.setViewSize(designWidth, designHeight)` so `worldToScreen`/`screenToWorld` stay correct.

**Safe-area insets** (notches, home indicators):

```typescript
const insets = viewport.getSafeAreaInsets(); // { top, right, bottom, left } in CSS px
hud.padding = { top: insets.top, bottom: insets.bottom };
```

**GPU-tier-aware render defaults:** pass a `GPUTier` (from `detectGPUTier()`) to `RenderPipeline.init()`/`RenderSystem.init()` as `gpuTier` to automatically disable antialiasing and cap `resolution` at 1 below `"mid"` tier:

```typescript
import { detectGPUTier } from "@emptysock/engine";

await renderPipeline.init({
  width: 1280,
  height: 720,
  gpuTier: detectGPUTier(hostAdapter),
});
```

Call `viewport.destroy()` when tearing down the game to remove its listeners. See the [ViewportSystem reference page](../reference/systems/viewport-system.md) for the full API.

---

## 5.29 AnimatorController

A code-first animation state machine that sits alongside `Animator` (it does not replace it — `Animator` keeps working exactly as before for single-clip playback). `AnimatorController` owns a graph of named states (each wrapping an `AnimationClip`), transitions gated by a small parameter bag (floats, bools, triggers — modelled on Unity's Animator Controller parameters, without a visual graph editor), and optional linear cross-fade blending between the outgoing and incoming clip instead of an instant cut.

```typescript
import { AnimatorController } from "@emptysock/engine";

const controller = player.addComponent(AnimatorController);

controller.addState("idle", {
  name: "idle",
  frameStart: 0,
  frameEnd: 3,
  frameRate: 6,
  loop: true,
});
controller.addState("walk", {
  name: "walk",
  frameStart: 0,
  frameEnd: 7,
  frameRate: 12,
  loop: true,
});
controller.addState("attack", {
  name: "attack",
  frameStart: 0,
  frameEnd: 5,
  frameRate: 15,
  loop: false,
});

// Parameter-gated transition with a 0.2s cross-fade:
controller.addTransition("idle", {
  to: "walk",
  condition: (ctx) => (ctx.getParam("speed") as number) > 0,
  duration: 0.2,
});
controller.addTransition("walk", {
  to: "idle",
  condition: (ctx) => (ctx.getParam("speed") as number) === 0,
  duration: 0.2,
});

// '*' matches a transition from any state — good for interrupts like attacks:
controller.addTransition("*", {
  to: "attack",
  condition: (ctx) => ctx.isTriggered("attack"),
});

controller.play("idle");

// In onUpdate:
controller.setFloat("speed", velocity.length());
if (input.isKeyPressed("Space")) controller.setTrigger("attack");
controller.update(dt);

// A renderer reads the active clip(s) to draw — normally one, two during a blend:
for (const { clip, frame, weight } of controller.getActiveClips()) {
  // composite `clip`'s `frame` at `weight` opacity
}
```

Triggers set with `setTrigger()` are consumed the first time a transition's condition observes them and reset automatically — call `setTrigger()` again to re-arm one. `setFloat`/`setBool` values persist until changed. Transitions are evaluated in the order they were added; the state machine does not evaluate new transitions while a blend is in progress.

---

## 5.30 AssetManifest

A declarative preloader with progress reporting, for building your own loading screen (see [No loading screen, no splash screen](../../CLAUDE.md) — the engine intentionally never renders one itself). `AssetManifest` loads textures through the same loader shape as `RenderPipelineOptions.textureLoader` (defaulting to pixi.js's `Assets.load`, so a preloaded texture is already warm in `RenderPipeline`'s cache) and audio through an injected `AudioSystem` (so a preloaded sound is already registered under its id and `audio.play(id)` does not reload it).

```typescript
import { AssetManifest, AudioSystem } from "@emptysock/engine";

const audio = new AudioSystem();
const manifest = new AssetManifest({ audioSystem: audio });

manifest.addAll([
  { id: "hero", path: "assets/hero.png", type: "texture" },
  { id: "jump", path: "assets/jump.ogg", type: "audio" },
  { id: "level1", path: "assets/level1.json", type: "json" },
]);

manifest.onProgress((loaded, total) => {
  loadingScreen.setProgress(loaded / total);
});

const result = await manifest.load();
for (const failure of result.failed) {
  console.warn(`Asset "${failure.id}" failed to load:`, failure.error);
  // decide per-asset whether to retry, substitute a placeholder, or abort
}

sceneManager.change("Level1");
```

By default a failed asset is recorded in `result.failed` (and `manifest.failures`) without aborting the rest of the batch; pass `{ continueOnError: false }` to have `load()` reject on the first failure instead. Already-loaded assets are available synchronously via `manifest.get(id)` / `manifest.has(id)`.

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

## 5.31 InputBindings

`InputBindings` maps named actions to physical inputs (keys, mouse buttons, gamepad buttons/axes) so game code queries `isActionActive("jump")` instead of a raw key code, and rebinds at runtime.

```ts
import { InputBindings, createBindingsSaveSystem } from "@emptysock/engine";

const bindings = new InputBindings(input, {
  jump: [{ kind: "key", code: "Space" }],
});

if (bindings.isActionActive("jump")) player.jump();

bindings.rebind("jump", [{ kind: "key", code: "KeyW" }]);
bindings.save(createBindingsSaveSystem());
```

See [InputBindings reference](../reference/systems/input-bindings.md) for the full `Binding` union and the `SaveSystem`-backed persistence API.

## 5.32 DebugOverlaySystem

A shippable in-game debug overlay and console (FPS, frame time, entity count, log capture, `registerCommand`), disabled by default. Renders through the standard `PanelWidget`/`LabelWidget` tree.

```ts
import { DebugOverlaySystem } from "@emptysock/engine";

const overlay = new DebugOverlaySystem();
if (isDevBuild) overlay.enable();
scene.ui.add(overlay.root);

overlay.registerCommand("spawn", (args) => spawnEnemy(args[0]));

// once per frame:
overlay.update(dt, scene.entities.length);
```

See [DebugOverlaySystem reference](../reference/systems/debug-overlay-system.md).

## 5.33 Accessibility: colourblind filter and text scale

`PostProcessSystem` supports a `"colourblind"` layer filter (protanopia/deuteranopia/tritanopia _simulation_ matrices — for previewing a palette, not correcting it), and `accessibilitySettings.textScale` is a global multiplier every `LabelWidget` reads at render time.

```ts
import {
  PostProcessSystem,
  colourblindFilterDefsSVG,
  accessibilitySettings,
} from "@emptysock/engine";

postProcess.setLayerFilter("ui", { type: "colourblind", mode: "deuteranopia" });
// Inject colourblindFilterDefsSVG() into the host page once so the url(#...) filter resolves.

accessibilitySettings.textScale = 1.5; // wire to a settings-menu slider
```

See the [Accessibility guide](../guides/accessibility.md) for the honest scope of the colourblind filter (simulation, not correction) and for `InputBindings` as the highest-value accessibility primitive (control remapping).

---

## 5.34 PointerSystem

`PointerSystem` unifies mouse, touch, and pen input into a single stream using native Pointer Events, and adds a small gesture recognizer (tap, long-press, swipe, pinch) plus wheel/trackpad classification. Use it alongside — not instead of — `InputSystem` (keyboard/axes) and `GamepadSystem`.

```typescript
import { PointerSystem, type Gesture } from "@emptysock/engine";

const pointers = new PointerSystem();
pointers.attach(canvasElement);

// In onUpdate — polls for longpress:
pointers.update();

pointers.onGesture((g: Gesture) => {
  switch (g.type) {
    case "tap":
      button.triggerClick();
      break;
    case "longpress":
      openContextMenu(g.x, g.y);
      break;
    case "swipe":
      if (g.direction === "left") gallery.next();
      break;
    case "pinch":
      camera.zoom *= 1 + g.deltaScale;
      break;
  }
});

pointers.onWheel((w) => {
  if (w.isPinchZoom) camera.zoom *= 1 - w.deltaY * 0.01;
  else if (w.source === "trackpad") camera.pan(w.deltaX, w.deltaY);
  else camera.zoom *= w.deltaY > 0 ? 0.9 : 1.1;
});
```

Supports multiple simultaneous pointers, keyed by `pointerId`, for multi-touch. `pointers.destroy()` (alias for `detach()`) removes listeners on scene unload.

`UISystem.dispatchPointerDown` / `dispatchPointerDrag` / `dispatchPointerUp` give widget hit-testing real press/drag/release semantics — wire them from a `PointerSystem`'s handlers instead of calling the legacy `handleClick` on every down. `UISystem.setScale(ratio)` applies a canvas-to-design-resolution scale to widget positioning, sizing, and hit-testing; `MIN_TOUCH_TARGET_SIZE` (44px, iOS HIG) documents the recommended minimum interactive-widget size, and `ButtonWidget` warns in dev mode when configured smaller.

---

## 5.35 VisualScriptComponent

Node-graph interpreter component. Holds a serialized `VisualScriptGraph` (nodes + `next` edges) and walks it each frame (`onUpdate` nodes) or when fired (`onEvent` nodes via `fireEvent()`). Backs the Visual Script Editor panel; graphs can equally be hand-written with `VisualScriptGraphBuilder`.

```typescript
import {
  VisualScriptGraphBuilder,
  VisualScriptComponent,
} from "@emptysock/engine";

const b = new VisualScriptGraphBuilder();
const start = b.onUpdate();
const setHp = b.setVariable(1, 100);
b.connect(start, setHp);

const vs = new VisualScriptComponent({ graph: b.build() });
entity.addComponent(vs);
```

Node kinds: `onUpdate`, `onEvent`, `sequence`, `branch` (compares a `VariableStore` variable), `getVariable`/`setVariable`, `getSwitch`/`setSwitch`, `sendMessage` (dispatches through `ActorSystem.send()`). `VisualScriptComponent.TYPE` is `"VisualScript"`. See the [VisualScriptComponent reference](../reference/systems/visual-script-component.md) for the full node table and execution semantics, including the step cap that guards against a self-cycling graph.

---

## 5.36 CustomShaderFilter

User-authored GLSL post-process filter — the runtime the ShaderEditor IDE panel previews and compiles against. Attributes `aPosition`/`aUV`; vertex uniforms `uProjectionMatrix`/`uWorldTransformMatrix`/`uTransformMatrix`; fragment `uTexture`/`uTime`. See the [CustomShaderFilter reference](../reference/systems/custom-shader-filter.md).

```typescript
import { createCustomShaderFilter } from "@emptysock/engine";

const filter = createCustomShaderFilter({ fragmentSrc, vertexSrc });
renderSystem.addLayerShaderFilter("default", filter);
filter.setTime(elapsedSeconds);
```

---

## 5.37 SequenceSystem

Plays a keyframe `SequenceDefinition` (property + keyframes + optional easing, per track) against a plain numeric target by scheduling real `TweenManager.to()` calls — the runtime the Sequence Editor IDE panel drives. See the [SequenceSystem reference](../reference/systems/sequence-system.md).

```typescript
import { TweenManager, SequenceSystem } from "@emptysock/engine";

const tweens = new TweenManager();
const seq = new SequenceSystem();
seq.play(tweens, target, def);
tweens.update(deltaTime); // per frame
```
