[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Vec3

# Interface: Vec3

Defined in: engine/src/systems/PhysicsSystem3D.ts:28

`PhysicsSystem3D` — full 3D rigid-body physics via
`@dimforge/rapier3d-compat` (or the deterministic-compat build, §15.2).

It exposes a handle-returning `addBody()` API rather than a `PhysicsBody`
component (there is no 3D component) — there is no plan to retrofit it
onto `PhysicsBody`/bitECS, since `SceneLifecycle` (Game.ts) only has room
for one physics system slot and 3D games are the minority case
(the engine design notes round 1 item 3: "3D is not held to the same
'hide everything' bar as 2D"). A 3D game constructs and owns this
directly, the same way `{ manageLifecycle: false }` hands back raw
systems for manual ownership — see `Game.ts`'s escape hatch. It adds
fixed-timestep accumulation + interpolation alpha (matching the 2D
`PhysicsSystem`) and the deterministic-build swap.

Quick-start:
  const physics = new PhysicsSystem3D();
  await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
  const box = physics.addBody({ shape: "box", bodyType: "dynamic", position: { x: 0, y: 5, z: 0 } });
  // in game loop (onUpdate — must NOT be async):
  physics.update(dt);
  const alpha = physics.interpolationAlpha; // for a renderer to lerp with
  // when the scene unloads, ALWAYS call destroy() — see CLAUDE.md
  // "PhysicsSystem3D must be destroyed".
  physics.destroy();

## Properties

### x

> **x**: `number`

Defined in: engine/src/systems/PhysicsSystem3D.ts:29

***

### y

> **y**: `number`

Defined in: engine/src/systems/PhysicsSystem3D.ts:30

***

### z

> **z**: `number`

Defined in: engine/src/systems/PhysicsSystem3D.ts:31
