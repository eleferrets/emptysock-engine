[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Plugin

# Interface: Plugin

Defined in: [engine/src/core/PluginSystem.ts:8](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L8)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [engine/src/core/PluginSystem.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L9)

***

### version?

> `readonly` `optional` **version?**: `string`

Defined in: [engine/src/core/PluginSystem.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L10)

## Methods

### install()

> **install**(`ctx`): `void` \| `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L12)

Called when the plugin is registered. May be async.

#### Parameters

##### ctx

[`PluginContext`](PluginContext.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### uninstall()?

> `optional` **uninstall**(): `void` \| `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/PluginSystem.ts#L14)

Optional teardown called by unregister().

#### Returns

`void` \| `Promise`\<`void`\>
