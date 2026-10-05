[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / boxWithinReach

# Function: boxWithinReach()

> **boxWithinReach**(`lightX`, `lightY`, `radius`, `centreX`, `centreY`, `width`, `height`): `boolean`

Defined in: engine/src/systems/LightOcclusion.ts:244

True when a box occluder (centre + half-extents) could plausibly matter to
a light of the given radius, via the standard AABB-vs-circle distance
test (clamp the circle centre into the box, measure the remaining
distance). This is the spatial-culling pass `collectLights()` runs before
doing any per-ray work — the minimum bar CLAUDE.md's own perf-honesty
convention (e.g. `renderMultiCamera()`'s doc comment) asks new N-ish-cost
rendering paths to clear.

## Parameters

### lightX

`number`

### lightY

`number`

### radius

`number`

### centreX

`number`

### centreY

`number`

### width

`number`

### height

`number`

## Returns

`boolean`
