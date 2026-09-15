# PhysicsSystem3D

`PhysicsSystem3D` wraps a full 3D physics simulation.

**Two mandatory rules:**

1. **Always `await physics.init()` before adding bodies.** The physics WASM module loads asynchronously; calling `addBody` before `init()` resolves throws `Physics not initialized`.
2. **Always call `physics.destroy()` in `onDestroy()`.** The physics world is allocated in WASM linear memory, which is outside the JavaScript heap. The garbage collector cannot see this memory. Skipping `destroy()` causes permanent WASM heap growth. On long play sessions with frequent scene transitions, this causes out-of-memory crashes.

For a usage-oriented introduction, see the [Physics guide](../../guides/physics.md).

Import: `import { PhysicsSystem3D } from '@emptysock/engine';`

---

## Constructor

```typescript
const physics = new PhysicsSystem3D();
```

---

## `physics.init(gravity: { x: number; y: number; z: number }): Promise<void>`

Initialise the physics world with the given gravity vector. Must be awaited before any other call.

```typescript
await physics.init({ x: 0, y: -9.81, z: 0 });
```

---

## `physics.addBody(config: BodyConfig): PhysicsBody3D`

Create a physics body and add it to the world. Returns a handle to the body.

### BodyConfig

| Field         | Type                                                     | Default             | Description                                 |
| ------------- | -------------------------------------------------------- | ------------------- | ------------------------------------------- |
| `bodyType`    | `'dynamic' \| 'static' \| 'kinematic'`                   | required            | Simulation type                             |
| `shape`       | `'box' \| 'sphere' \| 'capsule' \| 'cylinder' \| 'cone'` | required            | Collision shape                             |
| `halfExtents` | `{ x: number; y: number; z: number }`                    | —                   | For `box`                                   |
| `radius`      | `number`                                                 | —                   | For `sphere`, `capsule`, `cylinder`, `cone` |
| `halfHeight`  | `number`                                                 | —                   | For `capsule`, `cylinder`, `cone`           |
| `position`    | `{ x: number; y: number; z: number }`                    | `{ x:0, y:0, z:0 }` | Initial world position                      |
| `rotation`    | `{ x: number; y: number; z: number; w: number }`         | identity quaternion | Initial rotation                            |
| `density`     | `number`                                                 | `1.0`               | Mass density                                |
| `restitution` | `number`                                                 | `0`                 | Bounciness                                  |
| `friction`    | `number`                                                 | `0.5`               | Surface friction                            |
| `isSensor`    | `boolean`                                                | `false`             | Detect overlaps without forces              |

```typescript
const box = physics.addBody({
  bodyType: "dynamic",
  shape: "box",
  halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
  position: { x: 0, y: 5, z: 0 },
  density: 1.0,
  restitution: 0.3,
});
```

---

## PhysicsBody3D — body handle

The object returned by `addBody`.

| Method         | Signature                                              | Description                              |
| -------------- | ------------------------------------------------------ | ---------------------------------------- |
| `getPosition`  | `(): { x: number; y: number; z: number }`              | Current world position                   |
| `getRotation`  | `(): { x: number; y: number; z: number; w: number }`   | Current rotation as a quaternion         |
| `applyImpulse` | `(impulse: { x: number; y: number; z: number }): void` | Instant velocity change                  |
| `applyForce`   | `(force: { x: number; y: number; z: number }): void`   | Apply force this frame                   |
| `setVelocity`  | `(v: { x: number; y: number; z: number }): void`       | Set linear velocity                      |
| `getVelocity`  | `(): { x: number; y: number; z: number }`              | Current linear velocity                  |
| `bodyIndex`    | `number`                                               | Internal index for use with `removeBody` |

---

## `physics.removeBody(bodyIndex: number): void`

Remove a body from the simulation. Call before `destroy()` if you need to remove individual bodies mid-scene.

---

## `physics.update(dt: number): void`

Step the simulation forward by `dt` seconds. Call this in `onUpdate`.

---

## `physics.destroy(): void`

Free the WASM memory allocated for the physics world. **Required in `onDestroy()`.**

---

## Full scene example

```typescript
import { PhysicsSystem3D } from "@emptysock/engine";

export class Level3D extends Scene {
  private _physics!: PhysicsSystem3D;

  override async onLoad(): Promise<void> {
    this._physics = new PhysicsSystem3D();
    await this._physics.init({ x: 0, y: -9.81, z: 0 });

    // Static floor
    this._physics.addBody({
      bodyType: "static",
      shape: "box",
      halfExtents: { x: 50, y: 0.1, z: 50 },
      position: { x: 0, y: 0, z: 0 },
    });

    // Dynamic box
    this._box = this._physics.addBody({
      bodyType: "dynamic",
      shape: "box",
      halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      position: { x: 0, y: 5, z: 0 },
    });
  }

  override onUpdate(dt: number): void {
    this._physics.update(dt);
    const pos = this._box.getPosition();
    meshEntity.position = { x: pos.x, y: pos.y };
  }

  override onDestroy(): void {
    this._physics.destroy(); // REQUIRED
  }
}
```
