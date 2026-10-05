[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PluginSystem

# Class: PluginSystem

Defined in: engine/src/PluginSystem.ts:17

## Constructors

### Constructor

> **new PluginSystem**(): `PluginSystem`

#### Returns

`PluginSystem`

## Accessors

### registeredPlugins

#### Get Signature

> **get** **registeredPlugins**(): readonly `string`[]

Defined in: engine/src/PluginSystem.ts:51

##### Returns

readonly `string`[]

## Methods

### inject()

> **inject**\<`T`\>(`key`): `T` \| `undefined`

Defined in: engine/src/PluginSystem.ts:47

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

Defined in: engine/src/PluginSystem.ts:29

#### Parameters

##### plugin

[`Plugin`](../interfaces/Plugin.md)

#### Returns

`Promise`\<`void`\>

***

### unregister()

> **unregister**(`name`): `Promise`\<`void`\>

Defined in: engine/src/PluginSystem.ts:40

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>
