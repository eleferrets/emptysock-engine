[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AmbientLight

# Interface: AmbientLight

Defined in: engine/src/systems/LightingSystem.ts:45

0 = pitch black except lit areas, 1 = fully lit (no darkness at all).

## Properties

### colour

> **colour**: `number`

Defined in: engine/src/systems/LightingSystem.ts:47

Ambient tint, 0xRRGGBB. White (0xffffff) is the ordinary "just dim everything" case.

***

### level

> **level**: `number`

Defined in: engine/src/systems/LightingSystem.ts:49

0..1. See `AmbientLight`'s own doc comment.
