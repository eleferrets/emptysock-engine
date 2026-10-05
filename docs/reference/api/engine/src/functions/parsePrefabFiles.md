[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / parsePrefabFiles

# Function: parsePrefabFiles()

> **parsePrefabFiles**(`files`, `lookup`): `Map`\<`string`, [`PrefabDef`](../interfaces/PrefabDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>\>

Defined in: engine/src/SceneFile.ts:142

Parses every prefab file in `files` in one pass, resolving `extends`
references between them regardless of array order (a two-pass topological
approach: define bare templates first, then re-resolve `extends` — simple
because prefab trees in practice are shallow and this only runs at
load/codegen time, never per-frame).

## Parameters

### files

readonly ([`PrefabFile`](../interfaces/PrefabFile.md) \| [`PrefabFileV1`](../interfaces/PrefabFileV1.md))[]

### lookup

[`ComponentLookup`](../type-aliases/ComponentLookup.md)

## Returns

`Map`\<`string`, [`PrefabDef`](../interfaces/PrefabDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>\>
