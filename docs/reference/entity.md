# Entity

An `Entity` is a named container for components. It carries a unique auto-generated `id` and a human-readable `name`. On its own it does nothing, behaviors come from whatever components you attach.

Entities are created via `scene.createEntity(name)` and destroyed via `entity.destroy()`. You never construct an `Entity` directly.

> **Heads up:** this is v1's `Entity`. `@emptysock/engine/v2` has its own `Entity` handle backed by bitECS's array storage, with `entity.get(Component)`/`entity.add(Component, overrides?)` instead of `getComponent`/`addComponent`. See [v2 Core reference](./v2-core.md).

---

## Properties

| Property   | Type                       | Description                                 |
| ---------- | -------------------------- | ------------------------------------------- |
| `id`       | `number`                   | Auto-generated unique integer ID            |
| `name`     | `string`                   | Human-readable label (shown in Inspector)   |
| `position` | `{ x: number; y: number }` | Shorthand for Transform position            |
| `rotation` | `number`                   | Shorthand for Transform rotation in radians |
| `scale`    | `{ x: number; y: number }` | Shorthand for Transform scale               |

---

## Component methods

### `entity.addComponent(Type, options?): ComponentInstance`

Attaches a component of the given type to this entity. Throws if a component of the same type is already attached.

| Parameter | Type                  | Description                                          |
| --------- | --------------------- | ---------------------------------------------------- |
| `Type`    | Component constructor | The class of the component to add                    |
| `options` | `object` (optional)   | Initial values passed to the component's constructor |

```typescript
player.addComponent(Sprite, {
  texture: "hero.png",
  anchor: { x: 0.5, y: 1.0 },
});
player.addComponent(PhysicsBody, { shape: "capsule", width: 32, height: 64 });
```

### `entity.getComponent(Type): ComponentInstance | undefined`

Returns the component instance if it exists, or `undefined` if not. Use when the component is optional.

```typescript
const sprite = player.getComponent(Sprite);
sprite?.setAlpha(0.5); // safe — only called if sprite exists
```

### `entity.requireComponent(Type): ComponentInstance`

Returns the component instance, or throws `ComponentNotFoundError` if it is not attached. Use when the component must exist.

```typescript
const body = player.requireComponent(PhysicsBody);
body.applyImpulse({ x: 100, y: 0 });
```

> Do not use `getComponent(BaseClass)` expecting to find a subclass added with `addComponent(SubClass)`. The lookup is by exact constructor.

### `entity.removeComponent(Type): void`

Detaches and destroys the component instance.

```typescript
player.removeComponent(Animator);
```

### `entity.hasComponent(Type): boolean`

Returns `true` if the entity has a component of the given type.

```typescript
if (entity.hasComponent(Health)) {
  entity.requireComponent(Health).takeDamage(10);
}
```

---

## Lifecycle

### `entity.destroy(): void`

Removes the entity and all its components from the scene. Always call this when an entity is no longer needed.

```typescript
bullet.destroy(); // remove bullet when it hits a wall
```

---

## Tags

### `entity.addTag(tag: string): void`

Adds a string tag to the entity.

```typescript
player.addTag("player");
enemy.addTag("enemy");
```

### `entity.hasTag(tag: string): boolean`

Returns `true` if the entity has the given tag.

```typescript
if (other.entity.hasTag("spike")) playerDie();
```

### `entity.removeTag(tag: string): void`

Removes the tag.

---

## Coroutines

### `entity.startCoroutine(fn: GeneratorFunction): CoroutineHandle`

Starts a coroutine attached to this entity. The coroutine is automatically stopped when the entity is destroyed.

```typescript
import { waitSeconds } from "@emptysock/engine";

entity.startCoroutine(function* () {
  yield waitSeconds(2.0);
  entity.destroy();
});
```

Returns a handle with a `.stop()` method to cancel the coroutine early.

---

## Transform shorthand

Writing to `position`, `rotation`, or `scale` updates the entity's Transform component directly:

```typescript
enemy.position = { x: 300, y: 400 };
enemy.rotation = Math.PI / 4; // 45 degrees
enemy.scale = { x: 2, y: 2 }; // twice as large
```

These are convenience properties. If no Transform component is attached, they throw.
