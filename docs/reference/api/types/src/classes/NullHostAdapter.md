[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / NullHostAdapter

# Class: NullHostAdapter

Defined in: [types/src/index.ts:260](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L260)

No-op adapter for Node.js tests and contexts without a host frame.

## Implements

- [`HostAdapter`](../interfaces/HostAdapter.md)

## Constructors

### Constructor

> **new NullHostAdapter**(): `NullHostAdapter`

#### Returns

`NullHostAdapter`

## Methods

### addMessageListener()

> **addMessageListener**(`_handler`): `void`

Defined in: [types/src/index.ts:262](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L262)

Register a listener for messages arriving from the host.

#### Parameters

##### \_handler

[`HostMessageHandler`](../type-aliases/HostMessageHandler.md)

#### Returns

`void`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`addMessageListener`](../interfaces/HostAdapter.md#addmessagelistener)

***

### clearInterval()

> **clearInterval**(`_id`): `void`

Defined in: [types/src/index.ts:267](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L267)

Cancel a handle returned by setInterval.

#### Parameters

##### \_id

`unknown`

#### Returns

`void`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`clearInterval`](../interfaces/HostAdapter.md#clearinterval)

***

### detectGPUTier()

> **detectGPUTier**(): `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [types/src/index.ts:268](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L268)

Detect GPU capability tier. Returns the best tier the host can determine;
return 'mid' when information is unavailable.

#### Returns

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`detectGPUTier`](../interfaces/HostAdapter.md#detectgputier)

***

### postMessage()

> **postMessage**(`_data`, `_targetOrigin`): `void`

Defined in: [types/src/index.ts:261](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L261)

Post a structured message to the parent / host frame.

#### Parameters

##### \_data

`unknown`

##### \_targetOrigin

`string`

#### Returns

`void`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`postMessage`](../interfaces/HostAdapter.md#postmessage)

***

### removeMessageListener()

> **removeMessageListener**(`_handler`): `void`

Defined in: [types/src/index.ts:263](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L263)

Deregister a previously registered message listener.

#### Parameters

##### \_handler

[`HostMessageHandler`](../type-aliases/HostMessageHandler.md)

#### Returns

`void`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`removeMessageListener`](../interfaces/HostAdapter.md#removemessagelistener)

***

### setInterval()

> **setInterval**(`_fn`, `_ms`): `unknown`

Defined in: [types/src/index.ts:264](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/types/src/index.ts#L264)

Schedule a recurring callback. Returns an opaque handle.

#### Parameters

##### \_fn

() => `void`

##### \_ms

`number`

#### Returns

`unknown`

#### Implementation of

[`HostAdapter`](../interfaces/HostAdapter.md).[`setInterval`](../interfaces/HostAdapter.md#setinterval)
