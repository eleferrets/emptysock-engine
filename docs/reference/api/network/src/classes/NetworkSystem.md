[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / NetworkSystem

# Class: NetworkSystem

Defined in: [network/src/NetworkSystem.ts:59](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L59)

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

Defined in: [network/src/NetworkSystem.ts:72](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L72)

#### Parameters

##### options

[`NetworkSystemOptions`](../interfaces/NetworkSystemOptions.md)

#### Returns

`NetworkSystem`

## Properties

### entities

> `readonly` **entities**: [`NetworkEntityMap`](NetworkEntityMap.md)

Defined in: [network/src/NetworkSystem.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L60)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [network/src/NetworkSystem.ts:218](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L218)

Stop listening to the collection's onAdd/onRemove. Does not disconnect the room.

#### Returns

`void`

***

### getEntity()

> **getEntity**(`networkId`): `Entity` \| `undefined`

Defined in: [network/src/NetworkSystem.ts:208](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L208)

Look up the local `Entity` mirroring a network id, if any.

#### Parameters

##### networkId

`string`

#### Returns

`Entity` \| `undefined`

***

### getNetworkId()

> **getNetworkId**(`entity`): `string` \| `undefined`

Defined in: [network/src/NetworkSystem.ts:213](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L213)

Look up the network id a local `Entity` was registered under, if any.

#### Parameters

##### entity

`Entity`

#### Returns

`string` \| `undefined`

***

### reconcile()

> **reconcile**(): `void`

Defined in: [network/src/NetworkSystem.ts:196](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L196)

Drop the mapping for any tracked entity that was destroyed *locally*
(`scene.destroy(entity)` called directly by gameplay code, not via the
Colyseus `onRemove` path this class already handles in `_bindCollection`).

`@emptysock/network` must never import bitECS internals or require a
new hook on `@emptysock/engine`'s core `Scene`/`Entity` (CLAUDE.md's
"engine never imports network" / "network only ever sees `.get()`"
boundary), so there is no push notification available for "an entity
this map knows about just died". Instead this polls: every tracked
`Entity`'s already-public `.isAlive` is checked, and any that are no
longer alive get `deleteByEntity`-ed. Without this, a destroyed
entity's `rawId` can be recycled by bitECS onto a completely unrelated
`spawn()` elsewhere in the same scene, and the stale mapping would
silently alias the wrong entity on the next `sync()`/inbound `listen()`
callback.

Called automatically at the top of `sync()` (so it runs at the same
low, fixed cadence networking already polls at) — call it directly
only if something needs the mapping reconciled off that cadence.

#### Returns

`void`

***

### sync()

> **sync**(): `void`

Defined in: [network/src/NetworkSystem.ts:146](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L146)

Call once per frame (or at whatever cadence the game wants to push
updates — networked state is "replicated a handful of times a second",
per ENGINE_DESIGN.md §23.2, not every-frame-at-60fps). Diffs the local
player's networked fields against the last value sent and calls
`room.send` for anything that changed.

#### Returns

`void`
