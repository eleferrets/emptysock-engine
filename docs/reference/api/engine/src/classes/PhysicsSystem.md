[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsSystem

# Class: PhysicsSystem

Defined in: [engine/src/systems/PhysicsSystem.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L21)

## Constructors

### Constructor

> **new PhysicsSystem**(): `PhysicsSystem`

#### Returns

`PhysicsSystem`

## Accessors

### RAPIER

#### Get Signature

> **get** **RAPIER**(): `__module`

Defined in: [engine/src/systems/PhysicsSystem.ts:50](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L50)

##### Returns

`__module`

***

### world

#### Get Signature

> **get** **world**(): `World`

Defined in: [engine/src/systems/PhysicsSystem.ts:45](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L45)

##### Returns

`World`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/PhysicsSystem.ts:222](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L222)

#### Returns

`void`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: [engine/src/systems/PhysicsSystem.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L36)

#### Parameters

##### options?

[`PhysicsWorldOptions`](../interfaces/PhysicsWorldOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### registerEntity()

> **registerEntity**(`entity`): `void`

Defined in: [engine/src/systems/PhysicsSystem.ts:61](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L61)

Register an entity's PhysicsBody component with the Rapier world.
Reads position from a Transform component on the same entity.
Body and collider handles are stored internally; they are not written back
to PhysicsBody.

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

`void`

***

### step()

> **step**(`fixedDt`): `void`

Defined in: [engine/src/systems/PhysicsSystem.ts:151](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L151)

Advance the physics world by exactly one step of `fixedDt` seconds and
fire collision/sensor callbacks. Accumulation is handled externally by
`SceneManager` — call this from `onFixedUpdate(dt)` (which is already
driven by the scene manager's accumulator loop) rather than from
`onUpdate(dt)`.

#### Parameters

##### fixedDt

`number`

#### Returns

`void`

***

### syncToTransforms()

> **syncToTransforms**(`entities`): `void`

Defined in: [engine/src/systems/PhysicsSystem.ts:128](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem.ts#L128)

Sync Rapier body positions back to Transform components.
Call after step() each frame.

#### Parameters

##### entities

`Iterable`\<[`Entity`](Entity.md)\>

#### Returns

`void`
