[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Vec3

# Interface: Vec3

Defined in: [engine/src/systems/PhysicsSystem3D.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L22)

PhysicsSystem3D — full 3D rigid-body physics via @dimforge/rapier3d-compat.

Quick-start:
  const physics = new PhysicsSystem3D();
  await physics.init({ x: 0, y: -9.81, z: 0 });

  const box = physics.addBody({ shape: 'box', bodyType: 'dynamic', position: { x: 0, y: 5, z: 0 } });
  box.setLinearDamping(0.2);

  physics.onCollisionEnter((a, b) => console.log('hit', a, b));

  // in game loop (onUpdate — must NOT be async):
  physics.update(dt);
  const pos = box.getPosition();

  // When the scene unloads, ALWAYS call destroy() — Rapier3D holds WASM
  // memory the GC cannot see.  See CLAUDE.md § PhysicsSystem3D must be destroyed.
  physics.destroy();

## Properties

### x

> **x**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L23)

***

### y

> **y**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L24)

***

### z

> **z**: `number`

Defined in: [engine/src/systems/PhysicsSystem3D.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PhysicsSystem3D.ts#L25)
