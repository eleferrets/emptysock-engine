[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PluginContext

# Interface: PluginContext

Defined in: [engine/src/core/PluginSystem.ts:1](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L1)

## Methods

### inject()

> **inject**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [engine/src/core/PluginSystem.ts:5](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L5)

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

Defined in: [engine/src/core/PluginSystem.ts:3](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L3)

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
