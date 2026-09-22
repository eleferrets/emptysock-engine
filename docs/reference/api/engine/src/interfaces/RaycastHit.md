[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RaycastHit

# Interface: RaycastHit

Defined in: [engine/src/systems/PhysicsSystem3D.ts:57](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L57)

## Properties

### bodyIndex

> **bodyIndex**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:59](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L59)

The body that was hit.

***

### distance

> **distance**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:61](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L61)

Distance along the ray from the origin to the hit point.

***

### normal

> **normal**: [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:65](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L65)

Surface normal at the hit point.

***

### point

> **point**: [`Vec3`](Vec3.md)

Defined in: [engine/src/systems/PhysicsSystem3D.ts:63](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L63)

World-space hit point.
