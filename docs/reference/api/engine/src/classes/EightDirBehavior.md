[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EightDirBehavior

# Class: EightDirBehavior

Defined in: [engine/src/behaviors/EightDirBehavior.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/EightDirBehavior.ts#L9)

EightDirBehavior — moves an entity in 8 directions using arrow keys or WASD.
Requires a Transform component on the entity and an InputSystem instance.

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new EightDirBehavior**(`input`, `speed?`): `EightDirBehavior`

Defined in: [engine/src/behaviors/EightDirBehavior.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/EightDirBehavior.ts#L15)

#### Parameters

##### input

[`InputSystem`](InputSystem.md)

##### speed?

`number` = `200`

#### Returns

`EightDirBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### diagonalSpeed

> **diagonalSpeed**: `number`

Defined in: [engine/src/behaviors/EightDirBehavior.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/EightDirBehavior.ts#L12)

Speed multiplier when moving diagonally (default: 1/√2 ≈ 0.707).

***

### speed

> **speed**: `number`

Defined in: [engine/src/behaviors/EightDirBehavior.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/EightDirBehavior.ts#L10)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L13)

#### Returns

`void`

#### Inherited from

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

Defined in: [engine/src/behaviors/EightDirBehavior.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/EightDirBehavior.ts#L22)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
