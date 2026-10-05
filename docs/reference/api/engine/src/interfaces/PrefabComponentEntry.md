[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PrefabComponentEntry

# Interface: PrefabComponentEntry\<T\>

Defined in: engine/src/Prefab.ts:20

the engine design notes — "flat scenes, composable prefabs (prefabs can
contain prefabs)". A `Prefab` is a named template: a list of components
(by registered name, with prop overrides applied over that component's
own defaults) plus, optionally, other prefabs to flatten in first. There
is no live parent/child scene graph anywhere here — `scene.spawn(prefab)`
flattens the whole tree onto a single new entity at spawn time, matching
Bevy's "Bundle" pattern rather than Godot/Unity's nested-scene instancing.

A prefab entry's `overrides` must satisfy the same `Serializable`
constraint every component field already does (`ecs/Serializable.ts`) —
prefab/scene JSON files are exactly the data that constraint exists for
, so a prop override can never smuggle in a
function or class instance a JSON file could never have represented
anyway.

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md) = [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Properties

### def

> `readonly` **def**: [`ComponentDef`](ComponentDef.md)\<`T`\>

Defined in: engine/src/Prefab.ts:23

***

### overrides?

> `readonly` `optional` **overrides?**: `Partial`\<`T`\>

Defined in: engine/src/Prefab.ts:24
