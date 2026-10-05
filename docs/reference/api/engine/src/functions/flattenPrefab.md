[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / flattenPrefab

# Function: flattenPrefab()

> **flattenPrefab**(`prefab`): [`PrefabComponentEntry`](../interfaces/PrefabComponentEntry.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

Defined in: engine/src/Prefab.ts:76

Flattens a prefab (and everything it `extends`, recursively, depth-first)
into a single ordered list of component entries. Later entries win on a
`componentName` collision — a prefab's own `components` override anything
a nested/extended prefab already set for the same component, which is
what lets `Enemy` in the example above layer specific data over a shared
`Physical` base.

## Parameters

### prefab

[`PrefabDef`](../interfaces/PrefabDef.md)

## Returns

[`PrefabComponentEntry`](../interfaces/PrefabComponentEntry.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]
