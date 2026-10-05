[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsSystem3D

# Class: PhysicsSystem3D

Defined in: engine/src/systems/PhysicsSystem3D.ts:112

## Constructors

### Constructor

> **new PhysicsSystem3D**(): `PhysicsSystem3D`

#### Returns

`PhysicsSystem3D`

## Accessors

### interpolationAlpha

#### Get Signature

> **get** **interpolationAlpha**(): `number`

Defined in: engine/src/systems/PhysicsSystem3D.ts:155

How far (0..1) the current render frame sits between the last two physics steps.

##### Returns

`number`

***

### isInitialized

#### Get Signature

> **get** **isInitialized**(): `boolean`

Defined in: engine/src/systems/PhysicsSystem3D.ts:451

##### Returns

`boolean`

## Methods

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:447

#### Returns

`void`

***

### addBody()

> **addBody**(`options?`): [`Physics3DHandle`](../interfaces/Physics3DHandle.md)

Defined in: engine/src/systems/PhysicsSystem3D.ts:193

#### Parameters

##### options?

[`PhysicsBody3DOptions`](../interfaces/PhysicsBody3DOptions.md) = `{}`

#### Returns

[`Physics3DHandle`](../interfaces/Physics3DHandle.md)

***

### castRay()

> **castRay**(`origin`, `direction`, `maxDistance`): [`RaycastHit`](../interfaces/RaycastHit.md) \| `null`

Defined in: engine/src/systems/PhysicsSystem3D.ts:350

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

Defined in: engine/src/systems/PhysicsSystem3D.ts:434

Free all Rapier WASM memory. MUST be called when the scene unloads —
see CLAUDE.md "PhysicsSystem3D must be destroyed".

#### Returns

`void`

***

### getInterpolatedTransform()

> **getInterpolatedTransform**(`bodyIndex`, `alpha?`): `Snapshot3D`

Defined in: engine/src/systems/PhysicsSystem3D.ts:160

Linearly interpolated transform for a body, for rendering.

#### Parameters

##### bodyIndex

`number`

##### alpha?

`number` = `...`

#### Returns

`Snapshot3D`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: engine/src/systems/PhysicsSystem3D.ts:130

#### Parameters

##### options?

[`PhysicsSystem3DOptions`](../interfaces/PhysicsSystem3DOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### onCollisionEnter()

> **onCollisionEnter**(`cb`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:146

#### Parameters

##### cb

`CollisionCallback`

#### Returns

`void`

***

### onCollisionExit()

> **onCollisionExit**(`cb`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:150

#### Parameters

##### cb

`CollisionCallback`

#### Returns

`void`

***

### removeBody()

> **removeBody**(`index`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:337

#### Parameters

##### index

`number`

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: engine/src/systems/PhysicsSystem3D.ts:382

Fixed-timestep accumulation (§10.3), mirroring the 2D `PhysicsSystem`:
`dt` (real frame time) accumulates and the world steps zero or more
times at exactly `fixedTimestep` seconds each, keeping a
previous/current snapshot per body for `getInterpolatedTransform`.

#### Parameters

##### dt

`number`

#### Returns

`void`
