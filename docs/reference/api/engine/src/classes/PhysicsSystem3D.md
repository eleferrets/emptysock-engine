[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsSystem3D

# Class: PhysicsSystem3D

Defined in: [engine/src/systems/PhysicsSystem3D.ts:113](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L113)

## Constructors

### Constructor

> **new PhysicsSystem3D**(): `PhysicsSystem3D`

#### Returns

`PhysicsSystem3D`

## Accessors

### isInitialized

#### Get Signature

> **get** **isInitialized**(): `boolean`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:380](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L380)

##### Returns

`boolean`

## Methods

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:376](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L376)

#### Returns

`void`

***

### addBody()

> **addBody**(`options?`): [`Physics3DHandle`](../interfaces/Physics3DHandle.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:146](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L146)

#### Parameters

##### options?

[`PhysicsBody3DOptions`](../interfaces/PhysicsBody3DOptions.md) = `{}`

#### Returns

[`Physics3DHandle`](../interfaces/Physics3DHandle.md)

***

### castRay()

> **castRay**(`origin`, `direction`, `maxDistance`): [`RaycastHit`](../interfaces/RaycastHit.md) \| `null`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:304](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L304)

Cast a ray from `origin` in `direction` (does not need to be normalised)
up to `maxDistance` world units. Returns the closest hit, or null.

#### Parameters

##### origin

[`Vec3`](../interfaces/Vec3.md)

##### direction

[`Vec3`](../interfaces/Vec3.md)

##### maxDistance

`number`

#### Returns

[`RaycastHit`](../interfaces/RaycastHit.md) \| `null`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:365](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L365)

Free all Rapier WASM memory. MUST be called when the scene unloads.
The GC cannot see Rapier's WASM heap — not calling this leaks memory permanently.

#### Returns

`void`

***

### init()

> **init**(`gravity?`): `Promise`\<`void`\>

Defined in: [engine/src/systems/PhysicsSystem3D.ts:128](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L128)

#### Parameters

##### gravity?

[`Vec3`](../interfaces/Vec3.md) = `...`

#### Returns

`Promise`\<`void`\>

***

### onCollisionEnter()

> **onCollisionEnter**(`cb`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:137](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L137)

Register a callback fired when two bodies begin overlapping this frame.

#### Parameters

##### cb

`CollisionCallback`

#### Returns

`void`

***

### onCollisionExit()

> **onCollisionExit**(`cb`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:142](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L142)

Register a callback fired when two bodies stop overlapping.

#### Parameters

##### cb

`CollisionCallback`

#### Returns

`void`

***

### removeBody()

> **removeBody**(`index`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:287](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L287)

#### Parameters

##### index

`number`

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:331](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PhysicsSystem3D.ts#L331)

Step the simulation by dt seconds. Call once per game-loop tick.

#### Parameters

##### dt

`number`

#### Returns

`void`
