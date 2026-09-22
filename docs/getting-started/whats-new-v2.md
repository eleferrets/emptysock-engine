# What's New in v2

Short version: the engine got a second, faster core underneath it, and none of your existing v1 code broke.

If you've been using EmptySock for a while, everything you already know still works. `Scene`, `Entity`, `Component`, `PhysicsSystem2D`, `ActorSystem`, all of it is exactly where you left it. What's new is `@emptysock/engine/v2`, a parallel entry point built on [bitECS](https://github.com/NateTheGreatt/bitECS) that trades a bit of API familiarity for real speed on games with a lot of entities, plus four new optional packages that used to be baked into the core engine and now aren't.

This page is a map, not a tutorial. Each linked guide has the actual walkthrough.

---

## The new core: `@emptysock/engine/v2`

The mental model shifts slightly. Instead of components being objects you attach to an entity, they're defined shapes whose data lives in flat arrays, and an `Entity` handle is a friendly way of reaching into those arrays.

```ts
import { defineComponent } from "@emptysock/engine/v2";

const Position = defineComponent("Position", { x: 0, y: 0 });

const player = scene.spawn("Player");
player.add(Position, { x: 100, y: 200 });
player.get(Position).x += 5;
```

That's `entity.get(Component)` instead of the old `getComponent`-style call, and it reads exactly like a property because it is one, just one backed by a `Proxy` over bitECS's array storage rather than a plain object. For loops that touch a lot of entities every frame, `scene.each()` skips that proxy entirely:

```ts
scene.each(Position, Sprite, (pos, sprite) => {
  sprite.x = pos.x;
  sprite.y = pos.y;
});
```

New concepts that come with it:

- **Prefabs** (`definePrefab`) — reusable entity templates, with pooling folded straight into `scene.spawn(prefab, props, { pool: true })` / `scene.destroy(entity)`. No separate pooling API to learn.
- **`ServiceRegistry`** (`game.services`) — a typed, class-keyed way to share state across a whole running game (score, settings) without a bare module-level singleton.
- **A new `SaveSystem`** — takes an injected `StorageAdapter` instead of guessing what platform it's on, and supports per-component schema versioning with migrations.
- **A frozen input snapshot** — `InputManager.snapshot()` copies input state once per frame, so nothing mid-frame can pull the rug out from under your `onUpdate`.
- **A headless testing harness** (`@emptysock/engine/testing`) — a real `Game` you can drive from a Vitest test with zero DOM involved.

Read [v2 Core reference](../reference/v2-core.md) for the full shape, and `docs/architecture.md` §3.9 if you want to know why it's built this way underneath.

**Should you switch?** Not required, and not automatic. A small or mid-size game runs perfectly well on the v1 API forever. Reach for v2 if you're building something with hundreds or thousands of active entities (bullet hell, large simulation, big crowds) and want the array-backed iteration speed, or if you specifically want prefabs/pooling built in rather than hand-rolled.

---

## Four systems moved out into their own packages

`VNSystem`, `BattleSystem`, `Tilemap`, and `NavMeshSystem` used to live inside `@emptysock/engine` itself. They're now separate, optional packages that depend on the engine (never the other way around), so a game that doesn't use dialogue trees or turn-based combat doesn't pay for that code in its bundle:

| Old location                         | New package          |
| ------------------------------------ | -------------------- |
| `VNSystem` (engine)                  | `@emptysock/vn`      |
| `BattleSystem` (engine)              | `@emptysock/battle`  |
| `Tilemap` / `NavMeshSystem` (engine) | `@emptysock/tilemap` |

If your project uses any of these, add the matching package as a dependency and update the import path, the classes and their APIs are unchanged, they just live somewhere new.

## Networking got a real replication scheme

`@emptysock/network` (the optional Colyseus companion package) now has a proper way to mark which component fields replicate: `networked(componentDef, ["field", ...])`, called next to `defineComponent` rather than through a separate wrapper. See the [Actors and Networking guide](../guides/actors-and-networking.md) for the walkthrough, and the troubleshooting entry on strict-equality dirty checking if a networked field ever seems to silently stop syncing.

---

## Where to go next

- New to the engine entirely? Start with [Your First Game](./your-first-game.md), it uses the classic v1 API and is still the right on-ramp.
- Already comfortable with v1 and curious about v2? [Entities and Scenes (v2)](../guides/entities-and-scenes-v2.md) is the walkthrough.
- Wondering if a specific v1 API changed shape? Check [Reference: v2 Core](../reference/v2-core.md) or the relevant guide, most v1 pages haven't changed at all.
