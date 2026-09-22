[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Transport

# Interface: Transport

Defined in: [engine/src/core/Transport.ts:6](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Transport.ts#L6)

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

Defined in: [engine/src/core/Transport.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Transport.ts#L12)

Open the connection (WebSocket handshake, WebRTC negotiation, etc.).

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `void`

Defined in: [engine/src/core/Transport.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Transport.ts#L14)

Close the connection and release resources.

#### Returns

`void`

***

### onReceive()

> **onReceive**(`handler`): `void`

Defined in: [engine/src/core/Transport.ts:10](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Transport.ts#L10)

Register the handler that receives incoming messages from the network.

#### Parameters

##### handler

(`payload`) => `void`

#### Returns

`void`

***

### send()

> **send**(`actorId`, `msg`): `void`

Defined in: [engine/src/core/Transport.ts:8](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Transport.ts#L8)

Send a message payload to a remote actor by id.

#### Parameters

##### actorId

`string`

##### msg

`Record`\<`string`, `unknown`\>

#### Returns

`void`
