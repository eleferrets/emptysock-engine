[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Plugin

# Interface: Plugin

Defined in: engine/src/PluginSystem.ts:8

## Properties

### name

> `readonly` **name**: `string`

Defined in: engine/src/PluginSystem.ts:9

***

### version?

> `readonly` `optional` **version?**: `string`

Defined in: engine/src/PluginSystem.ts:10

## Methods

### install()

> **install**(`ctx`): `void` \| `Promise`\<`void`\>

Defined in: engine/src/PluginSystem.ts:12

Called when the plugin is registered. May be async.

#### Parameters

##### ctx

[`PluginContext`](PluginContext.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### uninstall()?

> `optional` **uninstall**(): `void` \| `Promise`\<`void`\>

Defined in: engine/src/PluginSystem.ts:14

Optional teardown called by unregister().

#### Returns

`void` \| `Promise`\<`void`\>
