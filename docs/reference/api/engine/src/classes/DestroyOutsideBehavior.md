[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DestroyOutsideBehavior

# Class: DestroyOutsideBehavior

Defined in: [engine/src/behaviors/DestroyOutsideBehavior.ts:8](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/DestroyOutsideBehavior.ts#L8)

DestroyOutsideBehavior — removes the entity from the scene when its
Transform position leaves the layout bounds (plus optional margin).

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new DestroyOutsideBehavior**(`options?`): `DestroyOutsideBehavior`

Defined in: [engine/src/behaviors/DestroyOutsideBehavior.ts:15](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/DestroyOutsideBehavior.ts#L15)

#### Parameters

##### options?

###### height?

`number`

###### margin?

`number`

###### width?

`number`

###### x?

`number`

###### y?

`number`

#### Returns

`DestroyOutsideBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### margin

> **margin**: `number`

Defined in: [engine/src/behaviors/DestroyOutsideBehavior.ts:9](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/DestroyOutsideBehavior.ts#L9)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L13)

#### Returns

`void`

#### Inherited from

[`Behavior`](Behavior.md).[`onAttach`](Behavior.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L14)

#### Returns

`void`

#### Inherited from

[`Behavior`](Behavior.md).[`onDetach`](Behavior.md#ondetach)

***

### update()

> **update**(`ctx`): `void`

Defined in: [engine/src/behaviors/DestroyOutsideBehavior.ts:32](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/DestroyOutsideBehavior.ts#L32)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
