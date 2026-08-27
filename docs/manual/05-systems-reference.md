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
if (ctrl.isGrounded()) {
  if (Input.isPressed('Space')) ctrl.jump(600);
}
ctrl.moveAndSlide({ x: Input.axis('Horizontal') * 200 * dt, y: 0 });
```

**Collision events:**

```typescript
body.onCollisionEnter((other) => {
  if (other.entity.name === 'Spike') playerDie();
});
body.onCollisionExit((other) => { /* ... */ });
```

---

## 5.2 PhysicsSystem3D

Full Rapier3D integration. **Must `await physics.init()` before adding bodies.**

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
physics.destroy(); // MUST call to free Rapier WASM memory
```

**Supported shapes:**

| Shape | Required options |
|-------|------------------|
| `box` | `halfExtents: Vec3` |
| `sphere` | `radius: number` |
| `capsule` | `radius`, `halfHeight` |
| `cylinder` | `radius`, `halfHeight` |
| `cone` | `radius`, `halfHeight` |

**Body types:**
- `dynamic` — fully simulated, affected by forces and gravity
- `static` — immovable, acts as a collider for dynamics
- `kinematic` — moved by code, pushes dynamic bodies without being pushed back

> **Warning:** Omitting `physics.destroy()` in `onDestroy` leaks WASM memory. Each scene transition that creates a `PhysicsSystem3D` without destroying it will accumulate leaked memory.

---

## 5.3 InputSystem (advanced / engine-level)

The high-level `Input` API (Section 4.8) covers most cases. For direct system access (e.g., inside a custom system or actor):

```typescript
import { InputSystem } from '@emptysock/engine';

const input = new InputSystem();
input.attach(canvasElement);

// Call once per frame, before reading state:
input.flush();

// Keyboard:
input.isKeyDown('Space');
input.isKeyPressed('ArrowRight');
input.isKeyReleased('Escape');
```

---

## 5.4 Touch Input

```typescript
// After flush() each frame:

const count = input.touchCount;
const primary = input.primaryTouch; // TouchPoint | undefined

if (primary) {
  // primary.x, primary.y  — current canvas position
  // primary.dx, primary.dy — delta since last frame
  // primary.id            — browser touch identifier
}

// Multi-touch:
for (const touch of input.touches) {
  drawTouchIndicator(touch.x, touch.y);
}

// Frame-accurate events:
if (input.isTouchStarted())       { /* any new touch this frame */ }
if (input.isTouchStarted(id))     { /* specific touch started */ }
if (input.isTouchEnded(id))       { /* specific touch lifted */ }

// All listeners are registered as { passive: true }.
// Never call e.preventDefault() on touch events you did not add.
```

---

## 5.5 NavMeshSystem

Polygon-based 2D pathfinding using A* on a convex polygon graph.

```typescript
import { NavMeshSystem, type NavMeshData } from '@emptysock/engine';

const navMesh = new NavMeshSystem();

// Build the data offline (in a level editor or from a tilemap)
// and load it at scene startup:
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

// Find a path (returns centroid waypoints, empty array if no path):
const path = navMesh.findPath({ x: 10, y: 10 }, { x: 190, y: 90 });
// path = [{ x: 50, y: 50 }, { x: 150, y: 50 }]

// Call in game loop (reserved for dynamic obstacle support):
navMesh.update(dt);
```

**Point-to-polygon resolution:** `findPath` uses ray-cast point-in-polygon containment to find the start and end polygons, falling back to nearest centroid distance if the point is outside all polygons.

**Typical AI usage:**

```typescript
class EnemyActor extends Actor {
  private _path: Vec2[] = [];
  private _pathIdx = 0;

  receive(msg: Message): void {
    if (msg.type === 'CHASE') {
      this._path = navMesh.findPath(this.position, (msg as any).target);
      this._pathIdx = 0;
    }
  }

  update(dt: number): void {
    const wp = this._path[this._pathIdx];
    if (!wp) return;
    const dx = wp.x - this.position.x;
    const dy = wp.y - this.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) { this._pathIdx++; return; }
    this.position.x += (dx / dist) * 120 * dt;
    this.position.y += (dy / dist) * 120 * dt;
  }
}
```

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
type Save = z.infer<typeof Schema>;

await SaveSystem.save('slot-1', { scene: 'Level2', score: 4200, flags: { bossDefeated: true } });

const raw  = await SaveSystem.load('slot-1');
const data = Schema.parse(raw.data); // always validate, throws on corrupt data

await SaveSystem.delete('slot-1');
const slots = await SaveSystem.listSlots(); // string[]
```

> **Warning:** Never cast `raw.data as MyType` without schema validation. Save files can be corrupted, edited, or from a different game version.

---

## 5.7 Localisation

```typescript
import { i18n } from '@emptysock/engine';

// Load a locale bundle (JSON file with key: value pairs):
await i18n.load('en', () => import('./locales/en.json'));
await i18n.load('fr', () => import('./locales/fr.json'));

i18n.setLocale('fr');

i18n.t('greeting')        // → "Bonjour"
i18n.t('score', { n: 42 }) // → "Score: 42" (template substitution)
i18n.t('missing.key')     // → 'missing.key' (key returned, never throws)
```

The LocalisationEditor panel (Section 7) can export CSV that maps directly to these locale JSON files.

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

// Anywhere in code:
const svc = pluginSystem.inject<MyService>('myService');
svc?.doSomething();

await pluginSystem.unregister('my-plugin');
console.log(pluginSystem.registeredPlugins); // ['my-plugin'] before unregister
```

- `install()` may be `async`.
- Registering a duplicate name throws.
- `pluginSystem` is a singleton — import and use directly.
