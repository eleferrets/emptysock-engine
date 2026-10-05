[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / NetworkEntityMap

# Class: NetworkEntityMap

Defined in: network/src/NetworkEntityMap.ts:18

Bidirectional map between a Colyseus network id (a room state schema
instance's key in its parent `MapSchema` — typically the owning client's
`sessionId` for a per-player entity, or a synthetic id such as
`"npc:<n>"` the server assigns for non-player networked entities) and the
local bitECS-backed `Entity` handle that mirrors it in *this* process's
scene.

Network room state has no notion of a local entity id — bitECS hands out
ids per-`World`, and client/server (and every other connected client)
each run their own `World` with their own numbering. This map is the
seam: everything that talks to Colyseus deals in network ids, everything
that talks to the ECS deals in `Entity` handles, and this class is the
only place that knows both.

## Constructors

### Constructor

> **new NetworkEntityMap**(): `NetworkEntityMap`

#### Returns

`NetworkEntityMap`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: network/src/NetworkEntityMap.ts:89

##### Returns

`number`

## Methods

### deleteByEntity()

> **deleteByEntity**(`entity`): `void`

Defined in: network/src/NetworkEntityMap.ts:74

Drop the mapping for `entity` (it was destroyed locally). No-op if unmapped.

#### Parameters

##### entity

`Entity`

#### Returns

`void`

***

### deleteByNetworkId()

> **deleteByNetworkId**(`networkId`): `void`

Defined in: network/src/NetworkEntityMap.ts:65

Drop the mapping for `networkId` (the remote entity left/despawned). No-op if unmapped.

#### Parameters

##### networkId

`string`

#### Returns

`void`

***

### entries()

> **entries**(): `IterableIterator`\<\[`string`, `Entity`\]\>

Defined in: network/src/NetworkEntityMap.ts:85

All currently-mapped `[networkId, Entity]` pairs.

#### Returns

`IterableIterator`\<\[`string`, `Entity`\]\>

***

### getEntity()

> **getEntity**(`networkId`): `Entity` \| `undefined`

Defined in: network/src/NetworkEntityMap.ts:54

The local `Entity` mirroring `networkId`, if one has been registered.

#### Parameters

##### networkId

`string`

#### Returns

`Entity` \| `undefined`

***

### getNetworkId()

> **getNetworkId**(`entity`): `string` \| `undefined`

Defined in: network/src/NetworkEntityMap.ts:59

The network id `entity` was registered under, if any.

#### Parameters

##### entity

`Entity`

#### Returns

`string` \| `undefined`

***

### set()

> **set**(`networkId`, `entity`): `void`

Defined in: network/src/NetworkEntityMap.ts:36

Register `entity` as the local mirror of `networkId`. Replaces any prior mapping for either side.

#### Parameters

##### networkId

`string`

##### entity

`Entity`

#### Returns

`void`
