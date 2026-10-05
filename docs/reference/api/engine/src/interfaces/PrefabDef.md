[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PrefabDef

# Interface: PrefabDef\<T\>

Defined in: engine/src/Prefab.ts:27

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md) = [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Properties

### components

> `readonly` **components**: readonly [`PrefabComponentEntry`](PrefabComponentEntry.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

Defined in: engine/src/Prefab.ts:29

***

### extends?

> `readonly` `optional` **extends?**: readonly `PrefabDef`\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

Defined in: engine/src/Prefab.ts:31

Other prefabs to flatten onto the same entity before `components` apply.

***

### prefabName

> `readonly` **prefabName**: `string`

Defined in: engine/src/Prefab.ts:28
