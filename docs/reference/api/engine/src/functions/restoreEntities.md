[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / restoreEntities

# Function: restoreEntities()

> **restoreEntities**(`scene`, `snapshot`, `policy?`): [`EntityIdMap`](../interfaces/EntityIdMap.md)

Defined in: engine/src/SceneTransfer.ts:167

Respawn `snapshot` into `scene`: no `onCreate`, no prefab logic. Phase 1
spawns every entity with its components; phase 2 rewrites declared
`entityRef` fields and lets each extra import its data with a `remap`.
Returns the old-id to new-entity map.

## Parameters

### scene

[`Scene`](../classes/Scene.md)

### snapshot

[`SceneSnapshot`](../interfaces/SceneSnapshot.md)

### policy?

[`TransferPolicy`](../interfaces/TransferPolicy.md) = `persistentTransferPolicy`

## Returns

[`EntityIdMap`](../interfaces/EntityIdMap.md)
