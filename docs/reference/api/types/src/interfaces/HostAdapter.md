[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / HostAdapter

# Interface: HostAdapter

Defined in: types/src/index.ts:267

Abstraction layer between the engine and its host environment (browser
iframe, Tauri WebView, or Node test harness). Inject a concrete
implementation via IDEBridgeService constructor / Engine.init(); use
NullHostAdapter in contexts where no host integration is needed.

## Methods

### addMessageListener()

> **addMessageListener**(`handler`): `void`

Defined in: types/src/index.ts:271

Register a listener for messages arriving from the host.

#### Parameters

##### handler

[`HostMessageHandler`](../type-aliases/HostMessageHandler.md)

#### Returns

`void`

***

### clearInterval()

> **clearInterval**(`id`): `void`

Defined in: types/src/index.ts:277

Cancel a handle returned by setInterval.

#### Parameters

##### id

`unknown`

#### Returns

`void`

***

### detectGPUTier()

> **detectGPUTier**(): `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: types/src/index.ts:282

Detect GPU capability tier. Returns the best tier the host can determine;
return 'mid' when information is unavailable.

#### Returns

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

***

### postMessage()

> **postMessage**(`data`, `targetOrigin`): `void`

Defined in: types/src/index.ts:269

Post a structured message to the parent / host frame.

#### Parameters

##### data

`unknown`

##### targetOrigin

`string`

#### Returns

`void`

***

### removeMessageListener()

> **removeMessageListener**(`handler`): `void`

Defined in: types/src/index.ts:273

Deregister a previously registered message listener.

#### Parameters

##### handler

[`HostMessageHandler`](../type-aliases/HostMessageHandler.md)

#### Returns

`void`

***

### setInterval()

> **setInterval**(`fn`, `ms`): `unknown`

Defined in: types/src/index.ts:275

Schedule a recurring callback. Returns an opaque handle.

#### Parameters

##### fn

() => `void`

##### ms

`number`

#### Returns

`unknown`
