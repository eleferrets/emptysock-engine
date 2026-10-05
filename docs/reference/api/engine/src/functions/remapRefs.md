[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / remapRefs

# Function: remapRefs()

> **remapRefs**(`scene`, `entities`, `map`, `defs`, `options?`): `void`

Defined in: engine/src/RefRemap.ts:51

Phase 2 for declared fields: for every entity in `entities` and every
component in `defs` it carries, rewrites each `entityRef`-schema field's
`$ref` from its old id to the fresh `scene.idOf` of the mapped entity. A
ref with no mapping (or an empty one) becomes `NO_REF`; a non-empty
missing one also reports through `onMissing`.

## Parameters

### scene

[`Scene`](../classes/Scene.md)

### entities

`Iterable`\<[`Entity`](../classes/Entity.md)\>

### map

[`EntityIdMap`](../interfaces/EntityIdMap.md)

### defs

readonly [`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

### options?

[`RemapOptions`](../interfaces/RemapOptions.md) = `{}`

## Returns

`void`
