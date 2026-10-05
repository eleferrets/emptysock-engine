[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PrefabFile

# Interface: PrefabFile

Defined in: engine/src/SceneFile.ts:53

On-disk shape of a `.prefab.json` file. `components` is a name-keyed map
(key = registered component name); application order is JSON key order.

## Properties

### components

> `readonly` **components**: `Readonly`\<`Record`\<`string`, [`PrefabFileComponentEntry`](../type-aliases/PrefabFileComponentEntry.md)\>\>

Defined in: engine/src/SceneFile.ts:55

***

### extends?

> `readonly` `optional` **extends?**: readonly `string`[]

Defined in: engine/src/SceneFile.ts:57

Names of other prefab files this one extends (§11.2 — prefabs-in-prefabs).

***

### prefabName

> `readonly` **prefabName**: `string`

Defined in: engine/src/SceneFile.ts:54
