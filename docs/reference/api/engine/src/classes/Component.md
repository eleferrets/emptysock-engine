[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Component

# Abstract Class: Component

Defined in: [engine/src/core/Component.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L21)

## Extended by

- [`Transform`](Transform.md)
- [`Sprite`](Sprite.md)
- [`PhysicsBody`](PhysicsBody.md)
- [`CharacterController`](CharacterController.md)
- [`Animator`](Animator.md)
- [`AnimatorController`](AnimatorController.md)
- [`VisualScriptComponent`](VisualScriptComponent.md)
- [`CompiledVisualScriptComponent`](CompiledVisualScriptComponent.md)
- [`RigidJoint`](RigidJoint.md)

## Constructors

### Constructor

> `protected` **new Component**(`type`): `Component`

Defined in: [engine/src/core/Component.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L25)

#### Parameters

##### type

`string`

#### Returns

`Component`

## Properties

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L23)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L22)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/core/Component.ts:39](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L39)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

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
