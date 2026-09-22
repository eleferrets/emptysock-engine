[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AnimatorController

# Class: AnimatorController

Defined in: [engine/src/components/AnimatorController.ts:59](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L59)

Code-first animation state machine: named states (each wrapping an
AnimationClip), named transitions gated by parameter/trigger conditions,
and optional linear cross-fade blending between the outgoing and incoming
clip. Modelled after Unity's Animator Controller (parameters + triggers)
and Godot's AnimationTree conditions, without a visual graph editor.

This is a separate component from Animator by design: Animator is a deep,
minimal single-clip player and must keep working unmodified for anyone who
doesn't need states. AnimatorController owns the added complexity of a
transition graph, parameter bag, and cross-fade timing so Animator's
surface area never grows to accommodate it.

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new AnimatorController**(): `AnimatorController`

Defined in: [engine/src/components/AnimatorController.ts:80](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L80)

#### Returns

`AnimatorController`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### speed

> **speed**: `number` = `1`

Defined in: [engine/src/components/AnimatorController.ts:78](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L78)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`AnimatorController`\>

Defined in: [engine/src/components/AnimatorController.ts:60](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L60)

## Accessors

### currentState

#### Get Signature

> **get** **currentState**(): `string` \| `null`

Defined in: [engine/src/components/AnimatorController.ts:115](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L115)

##### Returns

`string` \| `null`

***

### isBlending

#### Get Signature

> **get** **isBlending**(): `boolean`

Defined in: [engine/src/components/AnimatorController.ts:119](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L119)

##### Returns

`boolean`

## Methods

### addState()

> **addState**(`name`, `clip`): `void`

Defined in: [engine/src/components/AnimatorController.ts:85](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L85)

Register a named state backed by a clip.

#### Parameters

##### name

`string`

##### clip

[`AnimationClip`](../interfaces/AnimationClip.md)

#### Returns

`void`

***

### addTransition()

> **addTransition**(`from`, `options`): `void`

Defined in: [engine/src/components/AnimatorController.ts:90](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L90)

Register a transition from a state (or '*' to match from any state) to another.

#### Parameters

##### from

`string`

##### options

[`AnimTransitionOptions`](../interfaces/AnimTransitionOptions.md)

#### Returns

`void`

***

### getActiveClips()

> **getActiveClips**(): [`ActiveClipFrame`](../interfaces/ActiveClipFrame.md)[]

Defined in: [engine/src/components/AnimatorController.ts:247](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L247)

Returns the clip(s)/frame(s)/weight(s) that should be composited this
frame. Normally a single entry with weight 1; during a cross-fade,
two entries whose weights sum to 1 and interpolate linearly over the
transition's duration.

#### Returns

[`ActiveClipFrame`](../interfaces/ActiveClipFrame.md)[]

***

### getParam()

> **getParam**(`name`): [`AnimParamValue`](../type-aliases/AnimParamValue.md) \| `undefined`

Defined in: [engine/src/components/AnimatorController.ts:111](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L111)

#### Parameters

##### name

`string`

#### Returns

[`AnimParamValue`](../type-aliases/AnimParamValue.md) \| `undefined`

***

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

### play()

> **play**(`name`): `void`

Defined in: [engine/src/components/AnimatorController.ts:124](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L124)

Jump straight into a state with no transition/blend, e.g. on setup.

#### Parameters

##### name

`string`

#### Returns

`void`

***

### resetTrigger()

> **resetTrigger**(`name`): `void`

Defined in: [engine/src/components/AnimatorController.ts:107](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L107)

#### Parameters

##### name

`string`

#### Returns

`void`

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/AnimatorController.ts:295](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L295)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### setBool()

> **setBool**(`name`, `value`): `void`

Defined in: [engine/src/components/AnimatorController.ts:98](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L98)

#### Parameters

##### name

`string`

##### value

`boolean`

#### Returns

`void`

***

### setFloat()

> **setFloat**(`name`, `value`): `void`

Defined in: [engine/src/components/AnimatorController.ts:94](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L94)

#### Parameters

##### name

`string`

##### value

`number`

#### Returns

`void`

***

### setTrigger()

> **setTrigger**(`name`): `void`

Defined in: [engine/src/components/AnimatorController.ts:103](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L103)

Arms a trigger. It stays armed until a transition condition consumes it or it is reset manually.

#### Parameters

##### name

`string`

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/components/AnimatorController.ts:138](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/AnimatorController.ts#L138)

Called each frame during the update pass

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

#### Overrides

[`Component`](Component.md).[`update`](Component.md#update)
