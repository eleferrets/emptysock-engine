[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DefineComponentOptions

# Interface: DefineComponentOptions\<T\>

Defined in: engine/src/Component.ts:90

Optional extra config for `defineComponent`.

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md) = [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Properties

### migrate?

> `readonly` `optional` **migrate?**: (`data`, `fromVersion`) => `Record`\<`string`, `unknown`\>

Defined in: engine/src/Component.ts:102

See `ComponentDef.migrate`.

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

##### fromVersion

`number`

#### Returns

`Record`\<`string`, `unknown`\>

***

### schema?

> `readonly` `optional` **schema?**: [`ComponentSchema`](../type-aliases/ComponentSchema.md)\<`T`\>

Defined in: engine/src/Component.ts:96

See `ComponentSchema`. Omit for components with no Inspector schema.

***

### transfer?

> `readonly` `optional` **transfer?**: (`data`) => `Record`\<`string`, `unknown`\>

Defined in: engine/src/Component.ts:98

See `ComponentDef.transfer`.

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

***

### version?

> `readonly` `optional` **version?**: `number`

Defined in: engine/src/Component.ts:94

See `ComponentDef.version`. Defaults to `1`.
