[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / boxOccluderSegments

# Function: boxOccluderSegments()

> **boxOccluderSegments**(`centreX`, `centreY`, `width`, `height`): [`Segment`](../interfaces/Segment.md)[]

Defined in: engine/src/systems/LightOcclusion.ts:214

Axis-aligned-box occluder → its four edges as world-space segments. A
`LightOccluder` is always a plain axis-aligned rectangle (no rotation
field) — see `components/LightOccluder.ts`'s doc comment for why that's
an honest, deliberate limitation rather than an oversight.

## Parameters

### centreX

`number`

### centreY

`number`

### width

`number`

### height

`number`

## Returns

[`Segment`](../interfaces/Segment.md)[]
