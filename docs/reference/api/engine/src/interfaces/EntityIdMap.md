[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EntityIdMap

# Interface: EntityIdMap

Defined in: engine/src/RefRemap.ts:14

Old-identity to new-entity lookup, the input to the shared two-phase remap
: phase 1 spawns every
entity while recording `oldId -> Entity`; phase 2 (`remapRefs` /
`remapValue`) rewrites references through this map once all entities
exist. `oldId` is a number for save blobs and room carry-over (old
`EntityId`s) and a string for scene files (`SceneEntity.id`).

## Methods

### get()

> **get**(`oldId`): [`Entity`](../classes/Entity.md) \| `undefined`

Defined in: engine/src/RefRemap.ts:15

#### Parameters

##### oldId

`string` \| `number`

#### Returns

[`Entity`](../classes/Entity.md) \| `undefined`
