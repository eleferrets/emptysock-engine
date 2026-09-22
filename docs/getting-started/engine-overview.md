# Engine Overview

A map of the engine's moving parts, not a tutorial — each linked guide has the actual walkthrough.

`Scene`, `Entity`, `Component`, `PhysicsSystem2D`, `ActorSystem` and friends are the classic, object-oriented core: components are objects you attach to an entity, and a scene owns a flat list of them. Alongside that, `@emptysock/engine/v2` is an entity-component-system core built on [bitECS](https://github.com/NateTheGreatt/bitECS): components there are defined shapes whose data lives in flat arrays, and an `Entity` handle is a friendly way of reaching into those arrays. Both are real, current, supported parts of the engine — pick whichever model fits the game you're building, per scene if you like.

---

## The ECS core: `@emptysock/engine/v2`

```ts
import { defineComponent } from "@emptysock/engine/v2";

const Position = defineComponent("Position", { x: 0, y: 0 });

const player = scene.spawn("Player");
player.add(Position, { x: 100, y: 200 });
player.get(Position).x += 5;
```

`entity.get(Component)` reads exactly like a property because it is one, backed by a `Proxy` over bitECS's array storage rather than a plain object. For loops that touch a lot of entities every frame, `scene.each()` skips that proxy entirely:

```ts
scene.each(Position, Sprite, (pos, sprite) => {
  sprite.x = pos.x;
  sprite.y = pos.y;
});
```

Concepts that come with it:

- **Prefabs** (`definePrefab`) — reusable entity templates, with pooling folded straight into `scene.spawn(prefab, props, { pool: true })` / `scene.destroy(entity)`. No separate pooling API to learn.
- **`ServiceRegistry`** (`game.services`) — a typed, class-keyed way to share state across a whole running game (score, settings) without a bare module-level singleton.
- **`SaveSystem`** — takes an injected `StorageAdapter` instead of guessing what platform it's on, and supports per-component schema versioning with migrations.
- **A frozen input snapshot** — `InputManager.snapshot()` copies input state once per frame, so nothing mid-frame can pull the rug out from under your `onUpdate`.
- **A headless testing harness** (`@emptysock/engine/testing`) — a real `Game` you can drive from a Vitest test with zero DOM involved.

Read the [core API reference](../reference/core-api.md) for the full shape, and `docs/architecture.md` §3.9 if you want to know why it's built this way underneath.

**Which one should you use?** Either — both are supported. A small or mid-size game runs perfectly well on the classic `Scene`/`Entity` API forever. Reach for the ECS core if you're building something with hundreds or thousands of active entities (bullet hell, large simulation, big crowds) and want the array-backed iteration speed, or if you specifically want prefabs/pooling built in rather than hand-rolled.

---

## Four systems live in their own packages

`VNSystem`, `BattleSystem`, `Tilemap`, and `NavMeshSystem` are separate, optional packages that depend on the engine (never the other way around), so a game that doesn't use dialogue trees or turn-based combat doesn't pay for that code in its bundle:

| System                      | Package              |
| --------------------------- | -------------------- |
| `VNSystem`                  | `@emptysock/vn`      |
| `BattleSystem`              | `@emptysock/battle`  |
| `Tilemap` / `NavMeshSystem` | `@emptysock/tilemap` |

If your project uses any of these, add the matching package as a dependency and import from it.

## Networking's replication scheme

`@emptysock/network` (the optional Colyseus companion package) has a proper way to mark which component fields replicate: `networked(componentDef, ["field", ...])`, called next to `defineComponent` rather than through a separate wrapper. See the [Actors and Networking guide](../guides/actors-and-networking.md) for the walkthrough, and the troubleshooting entry on strict-equality dirty checking if a networked field ever seems to silently stop syncing.

---

## Where to go next

- New to the engine entirely? Start with [Your First Game](./your-first-game.md) — it uses the classic `Scene`/`Entity` API and is the right on-ramp.
- Curious about the ECS core? [Entities and Components](../guides/entities-and-components.md) is the walkthrough.
- Wondering if a specific API changed shape? Check [Reference: Core API](../reference/core-api.md) or the relevant guide.
