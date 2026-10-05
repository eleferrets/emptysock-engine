[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / findCrossReferences

# Function: findCrossReferences()

> **findCrossReferences**(`from`, `to`): `string`[]

Defined in: engine/src/SceneTransfer.ts:267

References held by entities of `from` that point at entities of `to`.
Both snapshots must come from the same source scene (same old ids), as when
`Game` captures the carried entities and the persistent-room cache entry at
one unload. Such references dangle after restore, since each side respawns
at a different time and the remap only knows its own entities. Returns one
human-readable line per reference (declared `entityRef` fields, plus
handles and `{ $ref }` values inside extras).

## Parameters

### from

[`SceneSnapshot`](../interfaces/SceneSnapshot.md)

### to

[`SceneSnapshot`](../interfaces/SceneSnapshot.md)

## Returns

`string`[]
