[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BulletBehavior

# Class: BulletBehavior

Defined in: [engine/src/behaviors/BulletBehavior.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L9)

BulletBehavior — moves an entity at a constant angle each frame.
When destroyOutside is true and the entity leaves the bounding rect,
it is removed from the scene.

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new BulletBehavior**(`options?`): `BulletBehavior`

Defined in: [engine/src/behaviors/BulletBehavior.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L20)

#### Parameters

##### options?

###### angle?

`number`

###### boundsHeight?

`number`

###### boundsWidth?

`number`

###### boundsX?

`number`

###### boundsY?

`number`

###### destroyOutside?

`boolean`

###### speed?

`number`

#### Returns

`BulletBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### angle

> **angle**: `number`

Defined in: [engine/src/behaviors/BulletBehavior.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L12)

Angle in radians (0 = right).

***

### destroyOutside

> **destroyOutside**: `boolean`

Defined in: [engine/src/behaviors/BulletBehavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L13)

***

### speed

> **speed**: `number`

Defined in: [engine/src/behaviors/BulletBehavior.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L10)

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

Defined in: [engine/src/behaviors/BulletBehavior.ts:41](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/BulletBehavior.ts#L41)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
