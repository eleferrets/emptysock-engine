[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Behavior

# Abstract Class: Behavior

Defined in: [engine/src/behaviors/Behavior.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L11)

## Extended by

- [`EightDirBehavior`](EightDirBehavior.md)
- [`PlatformBehavior`](PlatformBehavior.md)
- [`BulletBehavior`](BulletBehavior.md)
- [`WrapBehavior`](WrapBehavior.md)
- [`SineBehavior`](SineBehavior.md)
- [`DestroyOutsideBehavior`](DestroyOutsideBehavior.md)
- [`GridMovementBehavior`](GridMovementBehavior.md)

## Constructors

### Constructor

> **new Behavior**(): `Behavior`

#### Returns

`Behavior`

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L13)

#### Returns

`void`

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/behaviors/Behavior.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L14)

#### Returns

`void`

***

### update()

> `abstract` **update**(`ctx`): `void`

Defined in: [engine/src/behaviors/Behavior.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/Behavior.ts#L12)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`
