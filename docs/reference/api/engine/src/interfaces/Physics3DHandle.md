[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Physics3DHandle

# Interface: Physics3DHandle

Defined in: engine/src/systems/PhysicsSystem3D.ts:72

## Properties

### bodyIndex

> `readonly` **bodyIndex**: `number`

Defined in: engine/src/systems/PhysicsSystem3D.ts:73

## Methods

### applyForce()

> **applyForce**(`force`, `wakeUp?`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:81

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:82

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:83

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:80

#### Returns

[`Vec3`](Vec3.md)

***

### getLinearVelocity()

> **getLinearVelocity**(): [`Vec3`](Vec3.md)

Defined in: engine/src/systems/PhysicsSystem3D.ts:78

#### Returns

[`Vec3`](Vec3.md)

***

### getPosition()

> **getPosition**(): [`Vec3`](Vec3.md)

Defined in: engine/src/systems/PhysicsSystem3D.ts:75

#### Returns

[`Vec3`](Vec3.md)

***

### getRotation()

> **getRotation**(): [`Quat`](Quat.md)

Defined in: engine/src/systems/PhysicsSystem3D.ts:76

#### Returns

[`Quat`](Quat.md)

***

### isGrounded()

> **isGrounded**(`distance?`): `boolean`

Defined in: engine/src/systems/PhysicsSystem3D.ts:87

#### Parameters

##### distance?

`number`

#### Returns

`boolean`

***

### setAngularDamping()

> **setAngularDamping**(`damping`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:85

#### Parameters

##### damping

`number`

#### Returns

`void`

***

### setAngularVelocity()

> **setAngularVelocity**(`vel`, `wakeUp?`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:79

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:86

#### Parameters

##### scale

`number`

#### Returns

`void`

***

### setLinearDamping()

> **setLinearDamping**(`damping`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:84

#### Parameters

##### damping

`number`

#### Returns

`void`

***

### setLinearVelocity()

> **setLinearVelocity**(`vel`, `wakeUp?`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:77

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:74

#### Parameters

##### pos

[`Vec3`](Vec3.md)

#### Returns

`void`
