# Entities and Components (ECS core)

This is the bitECS-backed take on entities, components and scenes, available from `@emptysock/engine/ecs`. If you haven't read [Entities and Scenes](./entities-and-scenes.md) or the [Engine Overview](../getting-started/engine-overview.md) yet, either is a good warm-up, this guide assumes you already know why a game engine needs an entity/component split at all and jumps straight to the ECS API.

---

## Defining a component

A component here is a name plus a shape, declared with `defineComponent`:

```ts
import { defineComponent } from "@emptysock/engine/ecs";

const Transform = defineComponent("Transform", { x: 0, y: 0, rotation: 0 });
const Health = defineComponent("Health", { current: 10, max: 10 });
```

The name (`"Transform"`) matters more than it looks like it should. It's the identity key the engine uses everywhere, including across a hot reload of the file this component is defined in, so keep it stable once you've picked it. The defaults object has to be plain, JSON-shaped data, no functions, no class instances. If a component genuinely needs a callback (physics collision handlers are the standing example), it doesn't go in the defaults, see the note on `PhysicsBody` near the bottom of this page.

## Spawning and touching entities

```ts
const scene = new Scene();

const player = scene.spawn("Player"); // "Player" is just a debug label
player.add(Transform, { x: 100, y: 200 });
player.add(Health, { max: 20, current: 20 });

player.get(Transform).x += 5; // reads and writes the real data
player.has(Health); // true
```

`entity.get(SomeComponent)` gives you back an object that looks and behaves like a plain object, but every read and write goes straight through to bitECS's underlying array storage for that component. There's no separate copy sitting around to drift out of sync, and no serialization step, it's just indexed array access wearing a friendly disguise.

## The fast path: `scene.each`

For anything that runs over a meaningful number of entities every frame, reach for `scene.each` instead of looping and calling `.get()` per entity:

```ts
scene.each(Transform, Sprite, (transform, sprite) => {
  sprite.x = transform.x;
  sprite.y = transform.y;
});
```

`scene.each` hands your callback the live values for every entity that has all the listed components, with no proxy allocated per entity per frame. For ten entities you probably won't notice the difference. For a few thousand bullets, you will.

## Destroying entities

```ts
scene.destroy(player);
player.isAlive; // false
player.get(Transform); // throws, this handle is stale now
```

Entity handles are versioned. Once an entity is destroyed, its old handle fails loudly on `.get()`/`.add()` rather than quietly reading whatever unrelated entity later claimed that same numeric slot. That's the whole point of versioning, a bug where you're holding a stale reference should be obvious immediately, not a mystery three scenes later.

## Prefabs: reusable entity templates

Writing out `entity.add(Transform, ...)` three separate times for every enemy you spawn gets old fast. A `Prefab` bundles a set of components (with overrides) into a template you spawn from directly:

```ts
import { definePrefab } from "@emptysock/engine/ecs";

const Physical = definePrefab("Physical", [
  { def: Transform },
  { def: PhysicsBody },
]);

const Enemy = definePrefab(
  "Enemy",
  [{ def: Health, overrides: { max: 50, current: 50 } }],
  { extends: [Physical] },
);

const goblin = scene.spawn(Enemy, { x: 100, y: 0 });
```

`extends` lets a prefab build on another prefab, but it's not a live parent/child relationship the way nested scenes work in some other engines, `scene.spawn()` flattens the whole tree onto one entity the moment you spawn it. Think of a prefab as a recipe that gets fully cooked at spawn time, not a scene you're instancing.

## Pooling, for free

If you're spawning and destroying the same kind of entity constantly (bullets, particles, enemies in a wave shooter), pooling avoids the allocation churn without making you learn a separate pooling API:

```ts
const bullet = scene.spawn(BulletPrefab, { x, y }, { pool: true });
// ...later, when the bullet is done:
scene.destroy(bullet);
// ...later still, a fresh bullet reuses that same slot:
const nextBullet = scene.spawn(
  BulletPrefab,
  { x: newX, y: newY },
  { pool: true },
);
```

`destroy()` on a pooled entity returns it to an internal per-prefab pool instead of actually deallocating it. Your game code doesn't need to know or care which happened, `destroy()` is the same call either way. The one thing worth knowing: a pooled-and-destroyed entity's `.isAlive` still reads `true` (its id is deliberately kept alive so nothing else can grab it out from under the pool). If you need to check "did this get destroyed", check `.has()` or `.get()` against a component you know it should have, not `.isAlive`.

## A component that needs a callback: `PhysicsBody`

`PhysicsBody`'s collision callbacks (`onCollisionEnter`, `onSensorEnter`, etc.) can't live in the component's own defaults, since `defineComponent` only accepts serializable data. They're kept in a side-table instead, and handed to you through the same `.get()`-shaped API so it doesn't feel any different to use:

```ts
const body = getPhysicsBody(entity);
body.onCollisionEnter = (other) => {
  console.log("hit", other);
};
```

Assigning the property is the registration, the same "assigning is the registration" pattern documented in `CLAUDE.md`, it just routes through a side-table under the hood instead of sharing storage with the rest of the component's fields.

---

## Where to next

- [Core API reference](../reference/core-api.md) for the exhaustive method list.
- [Physics](./physics.md) for `PhysicsBody`/`PhysicsSystem` details.
- [Hot Reload](./hot-reload.md) for what happens to a `ComponentDef`'s data when you edit its shape mid-session.
