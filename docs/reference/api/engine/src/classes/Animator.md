[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Animator

# Class: Animator

Defined in: [engine/src/components/Animator.ts:15](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L15)

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new Animator**(): `Animator`

Defined in: [engine/src/components/Animator.ts:27](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L27)

#### Returns

`Animator`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### clips

> **clips**: `Map`\<`string`, [`AnimationClip`](../interfaces/AnimationClip.md)\>

Defined in: [engine/src/components/Animator.ts:19](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L19)

***

### currentClip

> **currentClip**: `string` \| `null` = `null`

Defined in: [engine/src/components/Animator.ts:20](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L20)

***

### currentFrame

> **currentFrame**: `number` = `0`

Defined in: [engine/src/components/Animator.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L21)

***

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### speed

> **speed**: `number` = `1`

Defined in: [engine/src/components/Animator.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L22)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`Animator`\>

Defined in: [engine/src/components/Animator.ts:16](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L16)

## Accessors

### isPlaying

#### Get Signature

> **get** **isPlaying**(): `boolean`

Defined in: [engine/src/components/Animator.ts:51](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L51)

##### Returns

`boolean`

## Methods

### addClip()

> **addClip**(`clip`): `void`

Defined in: [engine/src/components/Animator.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L31)

#### Parameters

##### clip

[`AnimationClip`](../interfaces/AnimationClip.md)

#### Returns

`void`

***

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

### play()

> **play**(`name`): `void`

Defined in: [engine/src/components/Animator.ts:35](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L35)

#### Parameters

##### name

`string`

#### Returns

`void`

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/Animator.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L80)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### stop()

> **stop**(): `void`

Defined in: [engine/src/components/Animator.ts:47](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L47)

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/components/Animator.ts:55](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/Animator.ts#L55)

Called each frame during the update pass

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

#### Overrides

[`Component`](Component.md).[`update`](Component.md#update)
