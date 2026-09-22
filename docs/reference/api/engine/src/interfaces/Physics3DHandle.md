[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Physics3DHandle

# Interface: Physics3DHandle

Defined in: [engine/src/systems/PhysicsSystem3D.ts:75](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L75)

## Properties

### bodyIndex

> `readonly` **bodyIndex**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:76](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L76)

## Methods

### applyForce()

> **applyForce**(`force`, `wakeUp?`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:90](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L90)

#### Parameters

##### force

[`Vec3`](Vec3.md)

##### wakeUp?

`boolean`

#### Returns

`void`

***

### applyImpulse()

> **applyImpulse**(`impulse`, `wakeUp?`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:91](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L91)

#### Parameters

##### impulse

[`Vec3`](Vec3.md)

##### wakeUp?

`boolean`

#### Returns

`void`

***

### applyTorqueImpulse()

> **applyTorqueImpulse**(`torque`, `wakeUp?`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:92](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L92)

#### Parameters

##### torque

[`Vec3`](Vec3.md)

##### wakeUp?

`boolean`

#### Returns

`void`

***

### getAngularVelocity()

> **getAngularVelocity**(): [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L87)

#### Returns

[`Vec3`](Vec3.md)

***

### getLinearVelocity()

> **getLinearVelocity**(): [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:85](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L85)

#### Returns

[`Vec3`](Vec3.md)

***

### getPosition()

> **getPosition**(): [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:80](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L80)

#### Returns

[`Vec3`](Vec3.md)

***

### getRotation()

> **getRotation**(): [`Quat`](Quat.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:81](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L81)

#### Returns

[`Quat`](Quat.md)

***

### isGrounded()

> **isGrounded**(`distance?`): `boolean`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:106](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L106)

Raycast downward from the body's centre by `distance` world units.
Returns true if the ray hits any other collider within that distance.
More reliable than testing linvel.y (which passes for slow-falling bodies).

#### Parameters

##### distance?

`number`

#### Returns

`boolean`

***

### setAngularDamping()

> **setAngularDamping**(`damping`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:96](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L96)

#### Parameters

##### damping

`number`

#### Returns

`void`

***

### setAngularVelocity()

> **setAngularVelocity**(`vel`, `wakeUp?`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:86](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L86)

#### Parameters

##### vel

[`Vec3`](Vec3.md)

##### wakeUp?

`boolean`

#### Returns

`void`

***

### setGravityScale()

> **setGravityScale**(`scale`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:99](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L99)

#### Parameters

##### scale

`number`

#### Returns

`void`

***

### setLinearDamping()

> **setLinearDamping**(`damping`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L95)

#### Parameters

##### damping

`number`

#### Returns

`void`

***

### setLinearVelocity()

> **setLinearVelocity**(`vel`, `wakeUp?`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:84](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L84)

#### Parameters

##### vel

[`Vec3`](Vec3.md)

##### wakeUp?

`boolean`

#### Returns

`void`

***

### setPosition()

> **setPosition**(`pos`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:79](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L79)

#### Parameters

##### pos

[`Vec3`](Vec3.md)

#### Returns

`void`
