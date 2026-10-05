[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LightSample

# Interface: LightSample

Defined in: engine/src/systems/LightingSystem.ts:53

One light, resolved to world position, ready to render — collectLights()'s output shape.

## Properties

### colour

> **colour**: `number`

Defined in: engine/src/systems/LightingSystem.ts:57

***

### coneAngle

> **coneAngle**: `number`

Defined in: engine/src/systems/LightingSystem.ts:61

Cone wedge angle, radians. `2*Math.PI` (a full circle) is an ordinary point light — see `LightSource.coneAngle`'s doc comment.

***

### coneDirection

> **coneDirection**: `number`

Defined in: engine/src/systems/LightingSystem.ts:63

Cone direction, radians. Only matters when `coneAngle < 2*Math.PI`. See `LightSource.coneDirection`.

***

### falloff

> **falloff**: `number`

Defined in: engine/src/systems/LightingSystem.ts:59

***

### intensity

> **intensity**: `number`

Defined in: engine/src/systems/LightingSystem.ts:58

***

### radius

> **radius**: `number`

Defined in: engine/src/systems/LightingSystem.ts:56

***

### visibility

> **visibility**: [`Point`](Point.md)[] \| `null`

Defined in: engine/src/systems/LightingSystem.ts:73

The light's real, occlusion-aware visible region, in world space —
`null` when no `LightOccluder` was within this light's radius (the
common case for most lights in most scenes), which is what keeps a
scene with zero occluders behaviourally identical to the
pre-occlusion implementation: `RenderSystem.syncLighting()` renders an
ordinary, un-masked circular falloff whenever this is `null`. See
`LightOcclusion.ts`'s doc comment for the actual algorithm.

***

### x

> **x**: `number`

Defined in: engine/src/systems/LightingSystem.ts:54

***

### y

> **y**: `number`

Defined in: engine/src/systems/LightingSystem.ts:55
