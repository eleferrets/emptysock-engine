[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsBody

# Class: PhysicsBody

Defined in: [engine/src/components/PhysicsBody.ts:36](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L36)

PhysicsBody — value component describing the shape and material of a rigid
body. Game code reads and writes these properties, and registers collision
callbacks here. The runtime handles (Rapier body/collider ids) live inside
PhysicsSystem, which calls back into this component via the `dispatch*`
methods when Rapier reports a real event — they are not meant to be called
directly by game code.

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new PhysicsBody**(`options?`): `PhysicsBody`

Defined in: [engine/src/components/PhysicsBody.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L61)

#### Parameters

##### options?

###### bodyType?

[`RigidBodyType`](../type-aliases/RigidBodyType.md)

###### density?

`number`

###### friction?

`number`

###### height?

`number`

###### isSensor?

`boolean`

###### radius?

`number`

###### restitution?

`number`

###### shape?

[`ColliderShape`](../type-aliases/ColliderShape.md)

###### width?

`number`

#### Returns

`PhysicsBody`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### bodyHandle

> **bodyHandle**: `number` \| `null` = `null`

Defined in: [engine/src/components/PhysicsBody.ts:51](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L51)

Rapier rigid body handle. Set by PhysicsSystem.registerEntity(); null until registered.

***

### bodyType

> **bodyType**: [`RigidBodyType`](../type-aliases/RigidBodyType.md)

Defined in: [engine/src/components/PhysicsBody.ts:40](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L40)

***

### colliderHandle

> **colliderHandle**: `number` \| `null` = `null`

Defined in: [engine/src/components/PhysicsBody.ts:53](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L53)

Rapier collider handle. Set by PhysicsSystem.registerEntity(); null until registered.

***

### density

> **density**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:45](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L45)

***

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### friction

> **friction**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:46](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L46)

***

### height

> **height**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:43](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L43)

***

### isSensor

> **isSensor**: `boolean`

Defined in: [engine/src/components/PhysicsBody.ts:48](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L48)

***

### radius

> **radius**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:44](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L44)

***

### restitution

> **restitution**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:47](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L47)

***

### shape

> **shape**: [`ColliderShape`](../type-aliases/ColliderShape.md)

Defined in: [engine/src/components/PhysicsBody.ts:41](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L41)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### width

> **width**: `number`

Defined in: [engine/src/components/PhysicsBody.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L42)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`PhysicsBody`\>

Defined in: [engine/src/components/PhysicsBody.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L37)

## Methods

### dispatchCollisionEnter()

> **dispatchCollisionEnter**(`other`, `contact`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:112](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L112)

Called by PhysicsSystem when Rapier reports a collision start with `other`.

#### Parameters

##### other

`PhysicsBody`

##### contact

[`ContactInfo`](../interfaces/ContactInfo.md)

#### Returns

`void`

***

### dispatchCollisionExit()

> **dispatchCollisionExit**(`other`, `contact`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:117](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L117)

Called by PhysicsSystem when Rapier reports a collision end with `other`.

#### Parameters

##### other

`PhysicsBody`

##### contact

[`ContactInfo`](../interfaces/ContactInfo.md)

#### Returns

`void`

***

### dispatchSensorEnter()

> **dispatchSensorEnter**(`other`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:122](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L122)

Called by PhysicsSystem when Rapier reports a sensor intersection start with `other`.

#### Parameters

##### other

`PhysicsBody`

#### Returns

`void`

***

### dispatchSensorExit()

> **dispatchSensorExit**(`other`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:127](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L127)

Called by PhysicsSystem when Rapier reports a sensor intersection end with `other`.

#### Parameters

##### other

`PhysicsBody`

#### Returns

`void`

***

### dispatchSensorStay()

> **dispatchSensorStay**(`other`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:132](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L132)

Called by PhysicsSystem once per step while `other` remains inside this sensor.

#### Parameters

##### other

`PhysicsBody`

#### Returns

`void`

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

### onCollisionEnter()

> **onCollisionEnter**(`cb`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L87)

Register a callback invoked when this body starts touching another (non-sensor) body.

#### Parameters

##### cb

[`CollisionCallback`](../type-aliases/CollisionCallback.md)

#### Returns

`void`

***

### onCollisionExit()

> **onCollisionExit**(`cb`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:92](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L92)

Register a callback invoked when this body stops touching another (non-sensor) body.

#### Parameters

##### cb

[`CollisionCallback`](../type-aliases/CollisionCallback.md)

#### Returns

`void`

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

### onSensorEnter()

> **onSensorEnter**(`cb`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:97](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L97)

Register a callback invoked when another body enters this sensor.

#### Parameters

##### cb

[`SensorCallback`](../type-aliases/SensorCallback.md)

#### Returns

`void`

***

### onSensorExit()

> **onSensorExit**(`cb`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:102](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L102)

Register a callback invoked when another body exits this sensor.

#### Parameters

##### cb

[`SensorCallback`](../type-aliases/SensorCallback.md)

#### Returns

`void`

***

### onSensorStay()

> **onSensorStay**(`cb`): `void`

Defined in: [engine/src/components/PhysicsBody.ts:107](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L107)

Register a callback invoked every step another body remains inside this sensor.

#### Parameters

##### cb

[`SensorCallback`](../type-aliases/SensorCallback.md)

#### Returns

`void`

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/PhysicsBody.ts:136](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/PhysicsBody.ts#L136)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### update()?

> `optional` **update**(`_deltaTime`): `void`

Defined in: [engine/src/core/Component.ts:36](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L36)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`update`](Component.md#update)
