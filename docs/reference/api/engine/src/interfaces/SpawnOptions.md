[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SpawnOptions

# Interface: SpawnOptions

Defined in: engine/src/Scene.ts:60

Options for `scene.spawn(prefab, props, options)` — the engine design notes

## Properties

### pool?

> `optional` **pool?**: `boolean`

Defined in: engine/src/Scene.ts:70

Fold pooling into spawn/destroy (§12.4). When `true`, `scene.destroy()`
on the returned entity returns it to an internal per-prefab pool
instead of truly deallocating it, and a later `spawn(SamePrefab, ...,
{ pool: true })` reuses that entity slot (component data reset to the
prefab's defaults + the new overrides) instead of allocating a new one.
Game code never branches on which happened — `destroy()` is the same
call either way.
