[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GridMovementBehavior

# Class: GridMovementBehavior

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/GridMovementBehavior.ts#L23)

GridMovementBehavior — 4-directional tile-aligned movement.

The entity slides smoothly between tile centres at `speed` tiles/second.
Input is only accepted when the entity is not mid-move. `isSolid` is checked
before each move starts — return true to block a direction.

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new GridMovementBehavior**(`opts`): `GridMovementBehavior`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/GridMovementBehavior.ts#L37)

#### Parameters

##### opts

[`GridMovementOptions`](../interfaces/GridMovementOptions.md)

#### Returns

`GridMovementBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### speed

> **speed**: `number`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/GridMovementBehavior.ts#L25)

***

### tileSize

> **tileSize**: `number`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/GridMovementBehavior.ts#L24)

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

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:45](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/GridMovementBehavior.ts#L45)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
