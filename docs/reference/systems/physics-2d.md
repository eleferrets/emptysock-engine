# PhysicsSystem2D

The 2D physics system runs synchronously — no async init required. Attach a `PhysicsBody` component to any entity to make it participate in the simulation.

For a usage-oriented introduction, see the [Physics guide](../../guides/physics.md).

Import: `import { PhysicsBody, CharacterController } from '@emptysock/engine';`

---

## PhysicsBody

Attaches a physics body to an entity.

```typescript
player.addComponent(PhysicsBody, {
  shape: "capsule",
  bodyType: "dynamic",
  gravityScale: 1,
  friction: 0.2,
  restitution: 0.0,
});
```

### Constructor options

| Option         | Type                                          | Default     | Description                                    |
| -------------- | --------------------------------------------- | ----------- | ---------------------------------------------- |
| `shape`        | `'capsule' \| 'box' \| 'circle' \| 'polygon'` | required    | Collision shape                                |
| `bodyType`     | `'dynamic' \| 'static' \| 'kinematic'`        | `'dynamic'` | Simulation type                                |
| `gravityScale` | `number`                                      | `1`         | Multiplier on global gravity                   |
| `friction`     | `number`                                      | `0.5`       | Surface friction coefficient                   |
| `restitution`  | `number`                                      | `0`         | Bounciness (0 = no bounce, 1 = perfect bounce) |
| `isSensor`     | `boolean`                                     | `false`     | Detect overlaps without generating forces      |

### Methods

| Method             | Signature                                         | Description                             |
| ------------------ | ------------------------------------------------- | --------------------------------------- |
| `applyImpulse`     | `(impulse: { x: number; y: number }): void`       | Apply an instant velocity change        |
| `applyForce`       | `(force: { x: number; y: number }): void`         | Apply a continuous force for this frame |
| `setVelocity`      | `(v: { x: number; y: number }): void`             | Set velocity directly                   |
| `getVelocity`      | `(): { x: number; y: number }`                    | Read current velocity                   |
| `onCollisionEnter` | `(handler: (other: CollisionInfo) => void): void` | Register a collision start callback     |
| `onCollisionExit`  | `(handler: (other: CollisionInfo) => void): void` | Register a collision end callback       |

### CollisionInfo

| Field    | Type                       | Description                                |
| -------- | -------------------------- | ------------------------------------------ |
| `entity` | `Entity`                   | The other entity involved in the collision |
| `normal` | `{ x: number; y: number }` | Collision normal                           |

```typescript
const body = player.requireComponent(PhysicsBody);
body.onCollisionEnter((other) => {
  if (other.entity.hasTag("spike")) playerDie();
});
```

---

## CharacterController

Slope-aware character movement that handles sloped surfaces, stairs, and one-way platforms.

```typescript
player.addComponent(CharacterController, { slopeAngle: 45 });
```

### Constructor options

| Option       | Type     | Default | Description                       |
| ------------ | -------- | ------- | --------------------------------- |
| `slopeAngle` | `number` | `45`    | Maximum walkable slope in degrees |

### Methods

| Method         | Signature                                    | Description                                    |
| -------------- | -------------------------------------------- | ---------------------------------------------- |
| `moveAndSlide` | `(velocity: { x: number; y: number }): void` | Move with sliding on surfaces                  |
| `isOnFloor`    | `(): boolean`                                | Whether the character is standing on a surface |
| `isOnWall`     | `(): boolean`                                | Whether the character is touching a wall       |
| `isOnCeiling`  | `(): boolean`                                | Whether the character is touching a ceiling    |

```typescript
// In onUpdate:
const ctrl = player.requireComponent(CharacterController);
const h = input.isKeyDown("ArrowRight")
  ? 1
  : input.isKeyDown("ArrowLeft")
    ? -1
    : 0;
const vy =
  ctrl.isOnFloor() && input.isKeyPressed("Space") ? -400 : gravity * dt;
ctrl.moveAndSlide({ x: h * 200 * dt, y: vy });
```
