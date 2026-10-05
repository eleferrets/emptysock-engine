[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TransferContext

# Interface: TransferContext

Defined in: engine/src/SceneTransfer.ts:51

What `EntityExtra.import` gets to rewrite references held in its data.

## Properties

### map

> `readonly` **map**: [`EntityIdMap`](EntityIdMap.md)

Defined in: engine/src/SceneTransfer.ts:54

Old entity id (from the source scene's `idOf`) to the respawned entity.

***

### scene

> `readonly` **scene**: [`Scene`](../classes/Scene.md)

Defined in: engine/src/SceneTransfer.ts:52

## Methods

### remap()

> **remap**(`value`): `unknown`

Defined in: engine/src/SceneTransfer.ts:62

Rewrites entity references inside an arbitrary value: `Entity` handles of
the source scene and `{ $ref }` values become the respawned entity's
handle / fresh ref; references to entities that were not carried become
`undefined` (handles) or `NO_REF` (refs). Arrays and plain objects are
walked (depth-capped); the possibly-replaced value is returned.

#### Parameters

##### value

`unknown`

#### Returns

`unknown`
