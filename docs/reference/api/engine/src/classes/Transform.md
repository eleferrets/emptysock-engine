[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Transform

# Class: Transform

Defined in: [engine/src/components/Transform.ts:7](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L7)

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new Transform**(`options?`): `Transform`

Defined in: [engine/src/components/Transform.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L17)

#### Parameters

##### options?

###### rotation?

`number`

###### scaleX?

`number`

###### scaleY?

`number`

###### x?

`number`

###### y?

`number`

#### Returns

`Transform`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### rotation

> **rotation**: `number`

Defined in: [engine/src/components/Transform.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L13)

***

### scaleX

> **scaleX**: `number`

Defined in: [engine/src/components/Transform.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L14)

***

### scaleY

> **scaleY**: `number`

Defined in: [engine/src/components/Transform.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L15)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### x

> **x**: `number`

Defined in: [engine/src/components/Transform.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L11)

***

### y

> **y**: `number`

Defined in: [engine/src/components/Transform.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L12)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`Transform`\>

Defined in: [engine/src/components/Transform.ts:8](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L8)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onAttach`](Component.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onDetach`](Component.md#ondetach)

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/Transform.ts:46](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L46)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### setPosition()

> **setPosition**(`x`, `y`): `this`

Defined in: [engine/src/components/Transform.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L34)

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`this`

***

### translate()

> **translate**(`dx`, `dy`): `this`

Defined in: [engine/src/components/Transform.ts:40](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Transform.ts#L40)

#### Parameters

##### dx

`number`

##### dy

`number`

#### Returns

`this`

***

### update()?

> `optional` **update**(`_deltaTime`): `void`

Defined in: [engine/src/core/Component.ts:36](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L36)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`update`](Component.md#update)
