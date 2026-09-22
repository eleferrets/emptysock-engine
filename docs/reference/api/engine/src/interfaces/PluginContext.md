[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PluginContext

# Interface: PluginContext

Defined in: [engine/src/core/PluginSystem.ts:1](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L1)

## Methods

### inject()

> **inject**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [engine/src/core/PluginSystem.ts:5](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L5)

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

Defined in: [engine/src/core/PluginSystem.ts:3](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L3)

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
