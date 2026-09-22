# Core API: Scene, Entity, Component, Prefab, Services

This page covers the `@emptysock/engine/v2` entry point's core primitives — the ECS core. It's a different API shape from the classic `Scene`/`Entity`/`Component` described on the other reference pages, built on [bitECS](https://github.com/NateTheGreatt/bitECS) underneath. See `docs/architecture.md` §3.9 for why it's built this way, and `docs/guides/entities-and-components.md` for a walkthrough with real examples.

---

## `defineComponent`

```ts
import { defineComponent } from "@emptysock/engine/v2";

const Position = defineComponent("Position", { x: 0, y: 0 });
const Health = defineComponent(
  "Health",
  { current: 10, max: 10 },
  { version: 2 },
);
```

`defineComponent(name, defaults, options?)` returns a `ComponentDef<T>`. `name` is the identity key used everywhere else in the system (`ComponentRegistry`, `SaveSystem`, the Inspector), not just a label, so two calls with the same name are treated as "the same component" even across a hot reload. `defaults` must satisfy `SerializableRecord` — plain JSON-shaped data only, no functions, no class instances, no `undefined`. `options.version` (default `1`) is consumed by `SaveSystem`'s migration system when a saved component's stamped version doesn't match the currently-registered def.

A component whose natural shape needs a function (a callback, a handle to something non-serializable) does not put that field in its defaults. See `PhysicsBody`'s pattern below.

## `Entity`

```ts
const player = scene.spawn("Player");
player.add(Position, { x: 100, y: 200 });
player.get(Position).x += 5; // proxy write, lands straight in bitECS's array
player.has(Position); // true
player.remove(Position);
player.isAlive; // false after scene.destroy(player)
```

`entity.get(def)` returns a `Proxy` over the component's live data for this entity — reading and writing its properties reads and writes bitECS's underlying arrays directly, there's no separate copy to get out of sync. `entity.add(def, overrides?)` attaches the component (merging `overrides` over `def`'s defaults) and returns the same kind of proxy. Entity handles are versioned: a stale handle from before a `destroy()` fails loudly on `.get()`/`.add()` rather than silently aliasing a different entity that later claimed the same slot.

## `scene.each` — the fast path

```ts
scene.each(Position, Sprite, (pos, sprite, entity) => {
  sprite.x = pos.x;
  sprite.y = pos.y;
});
```

`scene.each(...defs, callback)` iterates every entity that has all the listed components and hands the callback each component's live values directly, no `Proxy` allocation per entity. Mutations still land in the real arrays. Use this over `entity.get()` in any loop that runs over more than a handful of entities per frame — it's measurably faster because it skips the proxy machinery entirely.

## `Scene`

```ts
const scene = new Scene();
const e = scene.spawn("Enemy"); // empty entity, name is just a debug label
const pooled = scene.spawn(EnemyPrefab, { x: 10 }, { pool: true });
scene.destroy(pooled); // returns to the pool instead of deallocating
```

A `Scene` owns exactly one bitECS `World`. `spawn(name?)` creates an empty entity; `spawn(prefab, props?, options?)` creates one from a `PrefabDef` (see below) and applies `props` as overrides. `SpawnOptions.pool: true` folds entity pooling into the ordinary spawn/destroy calls — `destroy()` on a pooled entity returns it to an internal per-prefab pool instead of truly deallocating it, and the next matching `spawn(..., { pool: true })` reuses that slot. Game code never branches on which happened, `destroy()` is the same call either way. One caveat: a pooled-and-destroyed entity's `isAlive` still reads `true` (its bitECS id is deliberately never released back to bitECS's own recycling, to stop an unrelated `spawn()` elsewhere from claiming it first) — check `.has()`/`.get()` against the components you actually care about if you need to detect "was this destroyed", not `isAlive`.

## Prefabs

```ts
import { definePrefab } from "@emptysock/engine/v2";

const Physical = definePrefab("Physical", [
  { def: Transform },
  { def: PhysicsBody },
]);
const Enemy = definePrefab("Enemy", [{ def: Health, overrides: { max: 50 } }], {
  extends: [Physical],
});

scene.spawn(Enemy, { x: 100 }); // Transform + PhysicsBody + Health, one entity
```

A `Prefab` is a named template, a flat list of `{ def, overrides? }` component entries plus, optionally, other prefabs to flatten in first via `extends`. There is no live parent/child scene graph here, and no nested-instance updating the way Unity or Godot scene instancing works, `scene.spawn()` flattens the whole `extends` tree onto one new entity at spawn time. If you're picturing "prefabs as small scenes you can nest", picture "prefabs as a recipe that gets fully expanded once, at spawn" instead, it's closer to Bevy's Bundle pattern than to nested-scene instancing.

Prefabs authored as `.prefab.json` files get a matching `.d.ts` generated by `packages/toolchain`'s `generatePrefabTypes`, which is what makes `scene.spawn(SomePrefab, props)` autocomplete `props` correctly for a JSON-authored prefab, not just a hand-written `definePrefab<T>(...)` call.

## `ServiceRegistry`

```ts
class ScoreService {
  score = 0;
  add(n: number) {
    this.score += n;
  }
}

game.services.register(ScoreService);
const score = game.services.get(ScoreService); // typed as ScoreService
score.add(10);
```

`game.services` is one `ServiceRegistry` per `Game`, constructed once and never recreated across `loadScene`/`unloadScene`, so it survives scene transitions for the life of that `Game`. It's the typed, explicit answer to "I need one shared thing accessible from anywhere" for things scoped to a running game (score, settings, audio mixer state) — keyed by class, not by string name, so there's no typo-prone lookup and no ambiguity between two classes that happen to share a name. This is a different mechanism from `pluginSystem` (still a module-level singleton, for things that are genuinely process-global across the whole app, not just one `Game` instance) — see CLAUDE.md's "PluginSystem singleton" entry for why that one stays a bare singleton instead of moving onto `ServiceRegistry`.

## `Game` and headless testing

`Game.loadScene(sceneDef, options?)` and `Game.loadOverlay(sceneDef, options?)` are the `Game`-driven equivalents of `SceneManager`'s load/push calls. `loadScene` fully tears down whatever scene was previously loaded (unless `manageLifecycle: false` was passed, see the troubleshooting entry on that flag before reaching for it); `loadOverlay` loads an additional scene on top, its own `World`, its own entity ids starting from zero again, rendered in its own container so its sprites never collide with the main scene's. `Game.attachRenderer(renderer)` takes a `SceneRenderer` interface, not a concrete `RenderPipeline`, which is what makes `packages/engine/src/testing/index.ts`'s headless harness possible: construct a `Game`, never call `attachRenderer`, and every frame still runs (actor mailbox, physics, `onUpdate`) with the render step skipped.
