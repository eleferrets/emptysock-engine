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

### Runtime handles

| Field            | Type             | Description                                                                  |
| ---------------- | ---------------- | ---------------------------------------------------------------------------- |
| `bodyHandle`     | `number \| null` | Rapier rigid body handle. `null` until `PhysicsSystem.registerEntity()` runs |
| `colliderHandle` | `number \| null` | Rapier collider handle. `null` until `PhysicsSystem.registerEntity()` runs   |

### Collision and sensor callbacks

Register callbacks directly on the `PhysicsBody` you already hold a reference to. `PhysicsSystem` owns the Rapier world and invokes these when it drains real Rapier collision/intersection events each `step()` — game code never calls the `dispatch*` methods itself.

| Method             | Signature                                                        | Description                                                    |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `onCollisionEnter` | `(cb: (other: PhysicsBody, contact: ContactInfo) => void): void` | Fires when this body starts touching another (non-sensor) body |
| `onCollisionExit`  | `(cb: (other: PhysicsBody, contact: ContactInfo) => void): void` | Fires when this body stops touching another (non-sensor) body  |
| `onSensorEnter`    | `(cb: (other: PhysicsBody) => void): void`                       | Fires when another body enters this sensor                     |
| `onSensorExit`     | `(cb: (other: PhysicsBody) => void): void`                       | Fires when another body exits this sensor                      |
| `onSensorStay`     | `(cb: (other: PhysicsBody) => void): void`                       | Fires every step while another body remains inside this sensor |

### ContactInfo

| Field         | Type     | Description                          |
| ------------- | -------- | ------------------------------------ |
| `impactForce` | `number` | Approximate impact force, in Newtons |

```typescript
const spikes = new PhysicsBody({ isSensor: true });
spikes.onSensorEnter((other) => {
  playerDie();
});

const player = new PhysicsBody();
player.onCollisionEnter((other, contact) => {
  if (contact.impactForce > 50) console.log("Ouch.");
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
