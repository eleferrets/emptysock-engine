[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TransitionEffectSink

# Interface: TransitionEffectSink

Defined in: engine/src/systems/SceneTransition.ts:16

The slice of `PostProcessSystem` `SceneTransitionManager` needs to drive a
transition's visuals. Kept minimal so this class doesn't depend on the
full `PostProcessSystem` class shape, only the transition fields/methods
it actually writes to.

## Properties

### transitionProgress

> **transitionProgress**: `number`

Defined in: engine/src/systems/SceneTransition.ts:19

## Methods

### beginTransition()

> **beginTransition**(`effect`, `colour?`): `void`

Defined in: engine/src/systems/SceneTransition.ts:17

#### Parameters

##### effect

[`TransitionEffect`](../type-aliases/TransitionEffect.md)

##### colour?

`number`

#### Returns

`void`

***

### endTransition()

> **endTransition**(): `void`

Defined in: engine/src/systems/SceneTransition.ts:18

#### Returns

`void`
