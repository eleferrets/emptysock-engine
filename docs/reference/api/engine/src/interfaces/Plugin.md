[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Plugin

# Interface: Plugin

Defined in: [engine/src/core/PluginSystem.ts:8](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L8)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [engine/src/core/PluginSystem.ts:9](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L9)

***

### version?

> `readonly` `optional` **version?**: `string`

Defined in: [engine/src/core/PluginSystem.ts:10](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L10)

## Methods

### install()

> **install**(`ctx`): `void` \| `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L12)

Called when the plugin is registered. May be async.

#### Parameters

##### ctx

[`PluginContext`](PluginContext.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### uninstall()?

> `optional` **uninstall**(): `void` \| `Promise`\<`void`\>

Defined in: [engine/src/core/PluginSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/PluginSystem.ts#L14)

Optional teardown called by unregister().

#### Returns

`void` \| `Promise`\<`void`\>
