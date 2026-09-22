# Physics

EmptySock ships two physics systems: a 2D system and a 3D system. They're independent, so you can use one, the other, or both in the same scene.

For the complete method-level API, see [PhysicsSystem2D reference](../reference/systems/physics-2d.md) and [PhysicsSystem3D reference](../reference/systems/physics-3d.md).

> **Heads up:** everything on this page is the v1 API, and it's not going anywhere. If you're building on `@emptysock/engine/v2`, there's a bitECS-backed `PhysicsBody` component with the same collision/sensor callback pattern described here, just wired through `entity.get()` instead of `getComponent`. See [v2 Core reference](../reference/v2-core.md) and [Entities and Scenes (v2)](../guides/entities-and-scenes-v2.md).

---

## 2D Physics

The 2D physics system runs synchronously — no async init required. Attach a `PhysicsBody` component to any entity to make it participate in the simulation.

### Adding a body

```typescript
import { PhysicsBody } from "@emptysock/engine";

// Dynamic rigid body:
player.addComponent(PhysicsBody, {
  shape: "capsule",
  bodyType: "dynamic", // 'dynamic' | 'static' | 'kinematic'
  gravityScale: 1,
  friction: 0.2,
  restitution: 0.0,
});
```

**Body types:**

- `dynamic` — fully simulated. Affected by gravity, forces, and impulses.
- `static` — immovable collider. Platforms and walls.
- `kinematic` — moved by code, pushes dynamic bodies without being pushed back.

**Shapes:** `capsule`, `box`, `circle`, `polygon`.

### Character controller

For a player character that handles slopes, stairs, and one-way platforms:

```typescript
import { CharacterController } from "@emptysock/engine";

player.addComponent(CharacterController, { slopeAngle: 45 });

// In onUpdate:
const ctrl = player.requireComponent(CharacterController);
const h = input.isKeyDown("ArrowRight")
  ? 1
  : input.isKeyDown("ArrowLeft")
    ? -1
    : 0;
ctrl.moveAndSlide({ x: h * 200 * dt, y: 0 });
```

### Collision events

```typescript
const body = player.requireComponent(PhysicsBody);

body.onCollisionEnter((other) => {
  if (other.entity.name === "Spike") playerDie();
});

body.onCollisionExit((other) => {
  // entity has separated from `other`
});
```

---

## 3D Physics

The 3D physics system wraps Rapier3D. It allocates its world in WASM memory, which comes with two rules you really don't want to skip:

1. **Always `await physics.init()`** before adding bodies. Rapier's WASM module loads asynchronously.
2. **Always call `physics.destroy()` in `onDestroy()`**. The garbage collector can't see WASM memory, so skipping this means the WASM heap just keeps growing for the life of the process. Games that hop between scenes a lot will eventually run out of memory and crash.

### Setup

```typescript
import { PhysicsSystem3D } from "@emptysock/engine";

export class GameScene extends Scene {
  private _physics!: PhysicsSystem3D;

  override async onLoad(): Promise<void> {
    this._physics = new PhysicsSystem3D();
    await this._physics.init({ x: 0, y: -9.81, z: 0 }); // gravity vector

    const floor = this._physics.addBody({
      bodyType: "static",
      shape: "box",
      halfExtents: { x: 50, y: 0.1, z: 50 },
      position: { x: 0, y: 0, z: 0 },
    });

    const box = this._physics.addBody({
      bodyType: "dynamic",
      shape: "box",
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      position: { x: 0, y: 5, z: 0 },
      density: 1.0,
      restitution: 0.3,
    });
  }

  override onUpdate(dt: number): void {
    this._physics.update(dt);

    const pos = box.getPosition(); // { x, y, z }
    const rot = box.getRotation(); // quaternion { x, y, z, w }
    box.applyImpulse({ x: 0, y: 10, z: 0 });
  }

  override onDestroy(): void {
    this._physics.destroy(); // REQUIRED
  }
}
```

### Supported shapes

| Shape      | Required properties        |
| ---------- | -------------------------- |
| `box`      | `halfExtents: { x, y, z }` |
| `sphere`   | `radius`                   |
| `capsule`  | `radius`, `halfHeight`     |
| `cylinder` | `radius`, `halfHeight`     |
| `cone`     | `radius`, `halfHeight`     |

### Sensor bodies

Pass `isSensor: true` to detect overlaps without generating forces:

```typescript
const pickupZone = this._physics.addBody({
  bodyType: "static",
  shape: "sphere",
  radius: 1.5,
  position: coinPosition,
  isSensor: true,
});
```

---

## Choosing 2D vs 3D

|          | PhysicsSystem2D                 | PhysicsSystem3D                     |
| -------- | ------------------------------- | ----------------------------------- |
| Init     | Synchronous                     | `await physics.init()` required     |
| Teardown | Not required                    | `physics.destroy()` required        |
| Memory   | JavaScript heap                 | WASM heap (invisible to GC)         |
| Use case | 2D games, platformers, top-down | 3D games, physics-heavy simulations |

---

See also: [PhysicsSystem2D reference](../reference/systems/physics-2d.md), [PhysicsSystem3D reference](../reference/systems/physics-3d.md), [Troubleshooting — WASM memory grows](../troubleshooting.md)
