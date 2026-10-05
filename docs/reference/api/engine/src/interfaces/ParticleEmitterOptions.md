[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleEmitterOptions

# Interface: ParticleEmitterOptions

Defined in: engine/src/systems/ParticleSystem.ts:44

## Properties

### acceleration?

> `optional` **acceleration?**: `object`

Defined in: engine/src/systems/ParticleSystem.ts:53

#### x?

> `optional` **x?**: `number`

#### y?

> `optional` **y?**: `number`

***

### blendMode?

> `optional` **blendMode?**: `ParticleBlendMode`

Defined in: engine/src/systems/ParticleSystem.ts:98

Blend mode every particle in this emitter renders with — see
`ParticleBlendMode`'s doc comment. `"normal"` (the default) is
ordinary alpha blending; `"add"` is additive blending, the common
"glowing embers/fire" look `part_type_blend(ind, true)`
produces.

***

### colorGradient?

> `optional` **colorGradient?**: `number`[]

Defined in: engine/src/systems/ParticleSystem.ts:69

***

### dirWiggle?

> `optional` **dirWiggle?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:90

Per-step random fluctuation applied to a particle's current direction
of travel, in degrees — `part_type_direction`'s
`dir_wiggle` parameter. Same "redrawn every step" semantic as
`sizeWiggle`. `0` (the default) disables it.

***

### emissionRate?

> `optional` **emissionRate?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:47

***

### endAlpha?

> `optional` **endAlpha?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:68

***

### endScale?

> `optional` **endScale?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:55

***

### lifetime?

> `optional` **lifetime?**: `object`

Defined in: engine/src/systems/ParticleSystem.ts:48

#### max

> **max**: `number`

#### min

> **min**: `number`

***

### maxParticles?

> `optional` **maxParticles?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:75

***

### rotationSpeed?

> `optional` **rotationSpeed?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:74

***

### shape?

> `optional` **shape?**: [`EmitterShape`](../type-aliases/EmitterShape.md)

Defined in: engine/src/systems/ParticleSystem.ts:70

***

### shapeHeight?

> `optional` **shapeHeight?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:73

***

### shapeRadius?

> `optional` **shapeRadius?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:71

***

### shapeWidth?

> `optional` **shapeWidth?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:72

***

### sizeWiggle?

> `optional` **sizeWiggle?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:66

Per-step random fluctuation applied to a particle's scale, on top of
the deterministic `startScale`->`endScale` ramp —
`part_type_size`'s `size_wiggle` parameter. Each step, a fresh random
offset in `[-sizeWiggle, sizeWiggle]` is added to the particle's
interpolated scale; the offset itself is redrawn every step (real
step-to-step randomness, not a fixed per-particle phase), matching
The "wiggle" semantic of continuous jitter rather than a
smooth oscillation. `0` (the default) disables it entirely.

***

### speedWiggle?

> `optional` **speedWiggle?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:83

Per-step random fluctuation applied to a particle's current speed
(its velocity vector's magnitude), on top of `acceleration` —
`part_type_speed`'s `speed_wiggle` parameter. Same
"redrawn every step" semantic as `sizeWiggle`. `0` (the default)
disables it.

***

### startAlpha?

> `optional` **startAlpha?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:67

***

### startScale?

> `optional` **startScale?**: `number`

Defined in: engine/src/systems/ParticleSystem.ts:54

***

### texture?

> `optional` **texture?**: `string`

Defined in: engine/src/systems/ParticleSystem.ts:46

Texture / sprite name for each particle (display layer handles actual rendering).

***

### velocity?

> `optional` **velocity?**: `object`

Defined in: engine/src/systems/ParticleSystem.ts:49

#### x?

> `optional` **x?**: `object`

##### x.max

> **max**: `number`

##### x.min

> **min**: `number`

#### y?

> `optional` **y?**: `object`

##### y.max

> **max**: `number`

##### y.min

> **min**: `number`
