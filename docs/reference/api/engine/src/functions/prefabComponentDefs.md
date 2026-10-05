[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / prefabComponentDefs

# Function: prefabComponentDefs()

> **prefabComponentDefs**(`prefab`): [`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

Defined in: engine/src/Prefab.ts:107

Recursively lists the component defs a prefab (including everything it
extends) touches, deduplicated by name. Used by the `.d.ts` codegen
(`packages/toolchain/src/prefabCodegen.ts`) to know which registered
component fields make up a prefab's spawn-prop shape, without needing a
live `World` — codegen runs offline, against `ComponentDef`s alone.

## Parameters

### prefab

[`PrefabDef`](../interfaces/PrefabDef.md)

## Returns

[`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]
