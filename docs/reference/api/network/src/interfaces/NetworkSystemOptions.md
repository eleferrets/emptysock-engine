[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / NetworkSystemOptions

# Interface: NetworkSystemOptions

Defined in: [network/src/NetworkSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L20)

## Properties

### collection

> `readonly` **collection**: `string`

Defined in: [network/src/NetworkSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L24)

Property name on `room.state` holding the `MapSchema` of networked entities, e.g. `"players"`.

***

### components

> `readonly` **components**: readonly `ComponentDef`\<`SerializableRecord`\>[]

Defined in: [network/src/NetworkSystem.ts:26](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L26)

Every `ComponentDef` a networked entity in this collection may carry. Only fields marked via `networked()` are synced.

***

### getStateCallbacks

> `readonly` **getStateCallbacks**: [`GetStateCallbacksFn`](../type-aliases/GetStateCallbacksFn.md)

Defined in: [network/src/NetworkSystem.ts:43](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L43)

Injectable in place of colyseus.js's real `getStateCallbacks` — lets
tests supply a fake room/schema without a live Colyseus server. In
game code, pass the real `getStateCallbacks` imported from
`"colyseus.js"`.

***

### localId?

> `readonly` `optional` **localId?**: `string`

Defined in: [network/src/NetworkSystem.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L34)

Network id owned by this client (usually `room.sessionId`). The entity
mapped to this id is treated as locally-authoritative: its networked
fields are read every `sync()` call and pushed outbound on change,
rather than being overwritten by inbound state. Omit for a
server-authoritative / spectator setup where nothing is sent outbound.

***

### messageType?

> `readonly` `optional` **messageType?**: `string`

Defined in: [network/src/NetworkSystem.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L36)

`room.send` message type used for outbound field updates. Default `"networkSync"`.

***

### room

> `readonly` **room**: [`RoomLike`](RoomLike.md)

Defined in: [network/src/NetworkSystem.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L22)

***

### scene

> `readonly` **scene**: `Scene`

Defined in: [network/src/NetworkSystem.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/NetworkSystem.ts#L21)
