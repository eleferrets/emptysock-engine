[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PluginContext

# Interface: PluginContext

Defined in: engine/src/PluginSystem.ts:1

## Methods

### inject()

> **inject**\<`T`\>(`key`): `T` \| `undefined`

Defined in: engine/src/PluginSystem.ts:5

Retrieve a service registered by another plugin.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### provide()

> **provide**\<`T`\>(`key`, `value`): `void`

Defined in: engine/src/PluginSystem.ts:3

Expose a named service so other plugins and game code can retrieve it.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

#### Returns

`void`
