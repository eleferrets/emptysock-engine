[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CharacterController

# Class: CharacterController

Defined in: [engine/src/components/CharacterController.ts:7](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L7)

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new CharacterController**(`options?`): `CharacterController`

Defined in: [engine/src/components/CharacterController.ts:17](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L17)

#### Parameters

##### options?

###### jumpForce?

`number`

###### maxSlopeAngle?

`number`

###### snapToGround?

`number`

###### speed?

`number`

#### Returns

`CharacterController`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### isGrounded

> **isGrounded**: `boolean` = `false`

Defined in: [engine/src/components/CharacterController.ts:13](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L13)

***

### jumpForce

> **jumpForce**: `number`

Defined in: [engine/src/components/CharacterController.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L12)

***

### maxSlopeAngle

> **maxSlopeAngle**: `number`

Defined in: [engine/src/components/CharacterController.ts:15](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L15)

***

### snapToGround

> **snapToGround**: `number`

Defined in: [engine/src/components/CharacterController.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L14)

***

### speed

> **speed**: `number`

Defined in: [engine/src/components/CharacterController.ts:11](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L11)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`CharacterController`\>

Defined in: [engine/src/components/CharacterController.ts:8](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L8)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onAttach`](Component.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onDetach`](Component.md#ondetach)

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/CharacterController.ts:32](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/CharacterController.ts#L32)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### update()?

> `optional` **update**(`_deltaTime`): `void`

Defined in: [engine/src/core/Component.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L36)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`update`](Component.md#update)
