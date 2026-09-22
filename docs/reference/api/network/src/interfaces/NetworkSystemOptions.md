[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / NetworkSystemOptions

# Interface: NetworkSystemOptions

Defined in: [network/src/NetworkSystem.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L18)

## Properties

### collection

> `readonly` **collection**: `string`

Defined in: [network/src/NetworkSystem.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L22)

Property name on `room.state` holding the `MapSchema` of networked entities, e.g. `"players"`.

***

### components

> `readonly` **components**: readonly `ComponentDef`\<`SerializableRecord`\>[]

Defined in: [network/src/NetworkSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L24)

Every `ComponentDef` a networked entity in this collection may carry. Only fields marked via `networked()` are synced.

***

### getStateCallbacks

> `readonly` **getStateCallbacks**: [`GetStateCallbacksFn`](../type-aliases/GetStateCallbacksFn.md)

Defined in: [network/src/NetworkSystem.ts:41](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L41)

Injectable in place of colyseus.js's real `getStateCallbacks` — lets
tests supply a fake room/schema without a live Colyseus server. In
game code, pass the real `getStateCallbacks` imported from
`"colyseus.js"`.

***

### localId?

> `readonly` `optional` **localId?**: `string`

Defined in: [network/src/NetworkSystem.ts:32](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L32)

Network id owned by this client (usually `room.sessionId`). The entity
mapped to this id is treated as locally-authoritative: its networked
fields are read every `sync()` call and pushed outbound on change,
rather than being overwritten by inbound state. Omit for a
server-authoritative / spectator setup where nothing is sent outbound.

***

### messageType?

> `readonly` `optional` **messageType?**: `string`

Defined in: [network/src/NetworkSystem.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L34)

`room.send` message type used for outbound field updates. Default `"networkSync"`.

***

### room

> `readonly` **room**: [`RoomLike`](RoomLike.md)

Defined in: [network/src/NetworkSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L20)

***

### scene

> `readonly` **scene**: `Scene`

Defined in: [network/src/NetworkSystem.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/NetworkSystem.ts#L19)
