# 5 — Systems Reference

---

## 5.1 PhysicsSystem (2D)

The 2D physics system runs synchronously — no async init required.

```typescript
import { PhysicsBody, CharacterController } from '@emptysock/engine';

// Dynamic rigid body:
player.addComponent(PhysicsBody, {
  shape: 'capsule',
  bodyType: 'dynamic',  // 'dynamic' | 'static' | 'kinematic'
  gravityScale: 1,
  friction: 0.2,
  restitution: 0.0,
});

// Character controller (handles slope, stairs, one-way platforms):
player.addComponent(CharacterController, { slopeAngle: 45 });

// In onUpdate:
const ctrl = player.requireComponent(CharacterController);
if (ctrl.isGrounded() && Input.isPressed('Space')) ctrl.jump(600);
ctrl.moveAndSlide({ x: Input.axis('Horizontal') * 200 * dt, y: 0 });
```

**Collision events:**

```typescript
const body = player.requireComponent(PhysicsBody);
body.onCollisionEnter((other) => {
  if (other.entity.name === 'Spike') playerDie();
});
body.onCollisionExit((other) => { /* ... */ });
```

---

## 5.2 PhysicsSystem3D

Full Rapier3D integration. **Must `await physics.init()` before adding bodies. Must call `physics.destroy()` in `onDestroy` — omitting it leaks WASM memory permanently.**

```typescript
import { PhysicsSystem3D } from '@emptysock/engine';

const physics = new PhysicsSystem3D();
await physics.init({ x: 0, y: -9.81, z: 0 });

// Dynamic box:
const box = physics.addBody({
  bodyType: 'dynamic',
  shape: 'box',
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  position: { x: 0, y: 5, z: 0 },
  density: 1.0,
  restitution: 0.3,
});

// Static floor:
physics.addBody({
  bodyType: 'static',
  shape: 'box',
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
import { InputSystem } from '@emptysock/engine';

const input = new InputSystem();
input.attach(canvasElement);

// Call once per frame, before reading state:
input.flush();

input.isKeyDown('Space');
input.isKeyPressed('ArrowRight');
input.isKeyReleased('Escape');
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

if (input.isTouchStarted())   { /* any new touch this frame */ }
if (input.isTouchStarted(id)) { /* specific touch started */ }
if (input.isTouchEnded(id))   { /* specific touch lifted */ }
```

All listeners are `{ passive: true }`. Never call `e.preventDefault()` on events you did not add.

---

## 5.5 NavMeshSystem

Polygon-based 2D pathfinding using A* on a convex polygon graph.

```typescript
import { NavMeshSystem, type NavMeshData } from '@emptysock/engine';

const navMesh = new NavMeshSystem();

const data: NavMeshData = {
  polygons: [
    {
      id: 0,
      vertices: [
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 100, y: 100 }, { x: 0, y: 100 },
      ],
      centroid: { x: 50, y: 50 },
      neighbours: [1],
    },
    {
      id: 1,
      vertices: [
        { x: 100, y: 0 }, { x: 200, y: 0 },
        { x: 200, y: 100 }, { x: 100, y: 100 },
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
import { SaveSystem } from '@emptysock/engine';
import { z } from 'zod';

const Schema = z.object({
  scene:  z.string(),
  score:  z.number(),
  flags:  z.record(z.boolean()),
});
type SaveData = z.infer<typeof Schema>;

await SaveSystem.save('slot-1', { scene: 'Level2', score: 4200, flags: {} });

const raw  = await SaveSystem.load('slot-1');  // throws SlotNotFoundError if missing
const data = Schema.parse(raw.data);           // always validate

await SaveSystem.delete('slot-1');
const slots = await SaveSystem.listSlots();    // string[]
```

> **Warning:** Never cast `raw.data as MyType`. Save files can be corrupt, edited, or from a different game version. Schema validation is the contract.

---

## 5.7 Localisation

```typescript
import { i18n } from '@emptysock/engine';

await i18n.load('en', () => import('./locales/en.json'));
await i18n.load('fr', () => import('./locales/fr.json'));

i18n.setLocale('fr');

i18n.t('greeting')             // → "Bonjour"
i18n.t('score', { n: 42 })    // → "Score : 42"
i18n.t('missing.key')         // → 'missing.key' (never throws)
```

Locale JSON format: `{ "key": "value", "score": "Score : {{n}}" }`. Template tokens use `{{name}}` syntax.

The LocalisationEditor panel can export CSV that maps directly to these JSON files.

---

## 5.8 Plugin System

```typescript
import { pluginSystem, type Plugin, type PluginContext } from '@emptysock/engine';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  install(ctx: PluginContext): void {
    ctx.provide('myService', new MyService());
  },
  uninstall(): void { /* cleanup */ },
};

await pluginSystem.register(myPlugin);

const svc = pluginSystem.inject<MyService>('myService');
svc?.doSomething();

await pluginSystem.unregister('my-plugin');
```

`install()` may be async. Registering a duplicate name throws. `pluginSystem` is a process-global singleton — do not construct a new one.

---

## 5.9 Animator

Spritesheet animation component. Requires a `Sprite` on the same entity.

```typescript
import { Animator } from '@emptysock/engine';

player.addComponent(Animator, {
  spritesheet: 'assets/hero.esanim',
  defaultClip: 'idle',
});

const anim = player.requireComponent(Animator);

// Play a clip:
anim.play('run');                    // loops by default
anim.play('attack', { loop: false }); // one-shot
anim.onComplete(() => anim.play('idle')); // callback when one-shot ends

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
import { TilemapSystem } from '@emptysock/engine';

// Load (synchronous after assets are preloaded):
const map = TilemapSystem.load('assets/levels/level1.esmap');

// Enable physics colliders on a layer (static bodies):
map.getLayer('Collision').enablePhysics();

// Access spawn-point entities placed in the editor:
const spawns = map.getLayer('Spawns').entities;
for (const spawn of spawns) {
  spawnEnemy(spawn.position);
}

// Get all layers:
const layers = map.getLayers(); // TilemapLayer[]

// Unload when the scene ends:
TilemapSystem.unload('assets/levels/level1.esmap');
```

**Exporting from the editor:** In the TilemapEditor panel, use the Export button to save the map as `.esmap` JSON. Place it under `apps/ide/public/assets/` so Vite serves it. The path in `TilemapSystem.load()` is relative to the public root.

---

## 5.11 Tween

Interpolates numeric properties on any object over a duration, integrated with the game loop.

```typescript
import { Tween } from '@emptysock/engine';

// Move an entity:
Tween.to(entity, { x: 400, y: 200 }, { duration: 0.5, ease: 'bounceOut' });

// Fade out a sprite and destroy on complete:
Tween.to(sprite, { alpha: 0 }, {
  duration: 0.3,
  ease: 'sineIn',
  onComplete: () => entity.destroy(),
});

// Tween from a starting value:
Tween.from(entity, { y: -100 }, { duration: 0.4, ease: 'cubicOut' });

// Cancel a running tween:
const handle = Tween.to(enemy, { alpha: 0.5 }, { duration: 1.0 });
Tween.kill(handle);
```

**Easing functions:** `linear`, `sineIn/Out/InOut`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `bounceOut`, `elasticOut`, `backIn/Out`.

> **Tip:** Tweens do not need to be cancelled in `onDestroy` if the target object is destroyed — the engine detects the destroyed entity and stops the tween automatically. For tweens on plain objects (not entities), cancel them manually.
