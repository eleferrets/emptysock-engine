[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsBody3DOptions

# Interface: PhysicsBody3DOptions

Defined in: [engine/src/systems/PhysicsSystem3D.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L37)

## Properties

### bodyType?

> `optional` **bodyType?**: [`BodyType3D`](../type-aliases/BodyType3D.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L38)

***

### ccdEnabled?

> `optional` **ccdEnabled?**: `boolean`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:54](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L54)

Enable continuous collision detection for fast-moving bodies (bullets, etc.).

***

### density?

> `optional` **density?**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:48](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L48)

***

### friction?

> `optional` **friction?**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:50](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L50)

***

### halfExtents?

> `optional` **halfExtents?**: [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L41)

Half-extents for box shape (default 0.5, 0.5, 0.5).

***

### halfHeight?

> `optional` **halfHeight?**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:45](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L45)

Half-height for capsule / cylinder / cone.

***

### isSensor?

> `optional` **isSensor?**: `boolean`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:52](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L52)

When true the collider generates overlap events but does not block movement.

***

### position?

> `optional` **position?**: [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:46](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L46)

***

### radius?

> `optional` **radius?**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:43](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L43)

Radius for sphere / capsule / cylinder / cone.

***

### restitution?

> `optional` **restitution?**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:49](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L49)

***

### rotation?

> `optional` **rotation?**: [`Quat`](Quat.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:47](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L47)

***

### shape?

> `optional` **shape?**: [`Shape3D`](../type-aliases/Shape3D.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:39](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L39)
