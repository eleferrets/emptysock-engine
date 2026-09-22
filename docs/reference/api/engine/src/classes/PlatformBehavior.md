[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PlatformBehavior

# Class: PlatformBehavior

Defined in: [engine/src/behaviors/PlatformBehavior.ts:10](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L10)

PlatformBehavior — side-scrolling platformer movement driven by InputSystem.
Moves the entity's Transform directly; does not integrate with PhysicsSystem.
Use PhysicsSystem for collision-accurate platformers.

## Extends

- [`Behavior`](Behavior.md)

## Constructors

### Constructor

> **new PlatformBehavior**(`input`, `speed?`, `jumpStrength?`, `gravity?`): `PlatformBehavior`

Defined in: [engine/src/behaviors/PlatformBehavior.ts:18](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L18)

#### Parameters

##### input

[`InputSystem`](InputSystem.md)

##### speed?

`number` = `150`

##### jumpStrength?

`number` = `400`

##### gravity?

`number` = `800`

#### Returns

`PlatformBehavior`

#### Overrides

[`Behavior`](Behavior.md).[`constructor`](Behavior.md#constructor)

## Properties

### gravity

> **gravity**: `number`

Defined in: [engine/src/behaviors/PlatformBehavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L13)

***

### jumpStrength

> **jumpStrength**: `number`

Defined in: [engine/src/behaviors/PlatformBehavior.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L12)

***

### speed

> **speed**: `number`

Defined in: [engine/src/behaviors/PlatformBehavior.ts:11](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L11)

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

Defined in: [engine/src/behaviors/PlatformBehavior.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/PlatformBehavior.ts#L31)

#### Parameters

##### ctx

[`BehaviorContext`](../interfaces/BehaviorContext.md)

#### Returns

`void`

#### Overrides

[`Behavior`](Behavior.md).[`update`](Behavior.md#update)
