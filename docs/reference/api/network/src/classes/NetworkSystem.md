[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / NetworkSystem

# Class: NetworkSystem

Defined in: [network/src/NetworkSystem.ts:57](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L57)

The client-side half of ENGINE_DESIGN.md §23.2's networking bridge:
"`@emptysock/network` reads/writes through the same `.get()` Proxy layer
... it only ever sees the same `Component` classes and `.get()` shape
every other part of the engine sees."

`NetworkSystem` never imports bitECS and never reaches past
`entity.get(Component)` — every read/write to a networked field goes
through the exact same proxy game code uses. It knows nothing about
bitECS's entity ids either: the network<->local mapping is entirely
`NetworkEntityMap`, keyed on Colyseus's own schema-collection keys
(session ids for players, or whatever synthetic key the server assigns).

## Constructors

### Constructor

> **new NetworkSystem**(`options`): `NetworkSystem`

Defined in: [network/src/NetworkSystem.ts:70](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L70)

#### Parameters

##### options

[`NetworkSystemOptions`](../interfaces/NetworkSystemOptions.md)

#### Returns

`NetworkSystem`

## Properties

### entities

> `readonly` **entities**: [`NetworkEntityMap`](NetworkEntityMap.md)

Defined in: [network/src/NetworkSystem.ts:58](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L58)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [network/src/NetworkSystem.ts:191](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L191)

Stop listening to the collection's onAdd/onRemove. Does not disconnect the room.

#### Returns

`void`

***

### getEntity()

> **getEntity**(`networkId`): `Entity` \| `undefined`

Defined in: [network/src/NetworkSystem.ts:181](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L181)

Look up the local `Entity` mirroring a network id, if any.

#### Parameters

##### networkId

`string`

#### Returns

`Entity` \| `undefined`

***

### getNetworkId()

> **getNetworkId**(`entity`): `string` \| `undefined`

Defined in: [network/src/NetworkSystem.ts:186](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L186)

Look up the network id a local `Entity` was registered under, if any.

#### Parameters

##### entity

`Entity`

#### Returns

`string` \| `undefined`

***

### sync()

> **sync**(): `void`

Defined in: [network/src/NetworkSystem.ts:152](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L152)

Call once per frame (or at whatever cadence the game wants to push
updates — networked state is "replicated a handful of times a second",
per ENGINE_DESIGN.md §23.2, not every-frame-at-60fps). Diffs the local
player's networked fields against the last value sent and calls
`room.send` for anything that changed.

#### Returns

`void`
