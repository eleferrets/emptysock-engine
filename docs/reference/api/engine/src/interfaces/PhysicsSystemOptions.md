[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsSystemOptions

# Interface: PhysicsSystemOptions

Defined in: engine/src/systems/PhysicsSystem.ts:19

## Properties

### deterministic?

> `optional` **deterministic?**: `boolean`

Defined in: engine/src/systems/PhysicsSystem.ts:32

the engine design notes: swap `@dimforge/rapier2d-compat` for
`@dimforge/rapier2d-deterministic-compat` — same API, a slower
non-SIMD WASM build that's bit-for-bit reproducible across platforms.
Off by default; most games never need it and shouldn't pay the cost.

***

### fixedTimestep?

> `optional` **fixedTimestep?**: `number`

Defined in: engine/src/systems/PhysicsSystem.ts:25

Seconds per physics step (the engine design notes/§15.2 — fixed timestep,
independent of render framerate). Default 1/60.

***

### gravity?

> `optional` **gravity?**: `object`

Defined in: engine/src/systems/PhysicsSystem.ts:20

#### x

> **x**: `number`

#### y

> **y**: `number`
