[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LightingSystemOptions

# Interface: LightingSystemOptions

Defined in: engine/src/systems/LightingSystem.ts:76

## Properties

### maxLights?

> `optional` **maxLights?**: `number`

Defined in: engine/src/systems/LightingSystem.ts:86

Hard cap on simultaneous lights actually rendered. A real-time 2D
lighting pass draws every light into an offscreen texture every frame
(see RenderSystem.syncLighting()); an unbounded light count is an
unbounded per-frame draw-call/fill-rate cost with no ceiling, so this
system enforces one rather than trusting every game to self-limit.
Common real-time 2D lighting implementations land in the 16-32 range;
32 is the default here.

***

### raySamples?

> `optional` **raySamples?**: `number`

Defined in: engine/src/systems/LightingSystem.ts:98

Angle samples cast evenly around the full circle per light, in
addition to the angles `LightOcclusion.ts` already casts at every
nearby occluder corner — see that file's `buildAngleList()` doc
comment for why an occluded light needs these at all (approximating
the unoccluded arcs of its own circular falloff as a polygon). Higher
is a rounder-looking falloff at a real, linear per-light ray cost;
32 is a reasonable default for a torch-sized light. Only matters for a
light that actually has at least one occluder within reach — a light
with none never enters the visibility-polygon path at all.
