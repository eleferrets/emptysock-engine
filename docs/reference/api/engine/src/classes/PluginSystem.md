[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PluginSystem

# Class: PluginSystem

Defined in: [engine/src/core/PluginSystem.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L17)

## Constructors

### Constructor

> **new PluginSystem**(): `PluginSystem`

#### Returns

`PluginSystem`

## Accessors

### registeredPlugins

#### Get Signature

> **get** **registeredPlugins**(): readonly `string`[]

Defined in: [engine/src/core/PluginSystem.ts:46](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L46)

##### Returns

readonly `string`[]

## Methods

### inject()

> **inject**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [engine/src/core/PluginSystem.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L42)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### register()

> **register**(`plugin`): `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:26](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L26)

#### Parameters

##### plugin

[`Plugin`](../interfaces/Plugin.md)

#### Returns

`Promise`\<`void`\>

***

### unregister()

> **unregister**(`name`): `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:35](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L35)

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>
