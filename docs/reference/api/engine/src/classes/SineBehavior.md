[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SineBehavior

# Class: SineBehavior

Defined in: [engine/src/behaviors/SineBehavior.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L14)

SineBehavior — oscillates a Transform property on a sine wave.
Saves the entity's origin values at attach time and applies an offset
each frame. Opacity requires a component named 'Sprite' with an
`alpha` property (standard EmptySock Sprite component).

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new SineBehavior**(`options?`): `SineBehavior`

Defined in: [engine/src/behaviors/SineBehavior.ts:27](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L27)

#### Parameters

##### options?

###### axis?

[`SineAxis`](../type-aliases/SineAxis.md)

###### magnitude?

`number`

###### period?

`number`

###### type?

[`SineType`](../type-aliases/SineType.md)

#### Returns

`SineBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### axis

> **axis**: [`SineAxis`](../type-aliases/SineAxis.md)

Defined in: [engine/src/behaviors/SineBehavior.ts:16](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L16)

***

### magnitude

> **magnitude**: `number`

Defined in: [engine/src/behaviors/SineBehavior.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L17)

***

### period

> **period**: `number`

Defined in: [engine/src/behaviors/SineBehavior.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L19)

Period in seconds (time for one full cycle).

***

### type

> **type**: [`SineType`](../type-aliases/SineType.md)

Defined in: [engine/src/behaviors/SineBehavior.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L15)

## Methods

### onAttach()

> **onAttach**(): `void`

Defined in: [engine/src/behaviors/SineBehavior.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L42)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`onAttach`](Behavior.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L14)

#### Returns

`void`

#### Inherited from

[`Behavior`](Behavior.md).[`onDetach`](Behavior.md#ondetach)

***

### update()

> **update**(`ctx`): `void`

Defined in: [engine/src/behaviors/SineBehavior.ts:46](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/SineBehavior.ts#L46)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
