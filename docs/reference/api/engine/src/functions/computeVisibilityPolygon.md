[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / computeVisibilityPolygon

# Function: computeVisibilityPolygon()

> **computeVisibilityPolygon**(`radius`, `segments`, `raySamples?`, `cone?`): [`Point`](../interfaces/Point.md)[] \| `null`

Defined in: engine/src/systems/LightOcclusion.ts:150

Computes a light's real visible region given a set of nearby occluder
segments, as a polygon in the same world space `origin`/`segments` are
given in. `segments` are expected to already be relative to `origin`
(i.e. `ax`/`ay`/`bx`/`by` are offsets from the light, not absolute world
coordinates) — callers building world-space segments should subtract the
light's own position first; this keeps every trig call in this function
origin-relative and avoids re-deriving it per ray.

Returns `null` when `segments` is empty and `cone` is not given — the
light is fully unoccluded, and the caller should render its ordinary,
un-masked circular falloff (this is what keeps "no occluders present"
behaviourally identical to the pre-occlusion implementation: nobody has
to special-case an "everything visible" polygon shaped like a many-sided
circle approximation).

`cone`, when given, restricts the light to a spot/cone wedge —
`direction`/`angle` in radians, the wedge spanning
`[direction - angle/2, direction + angle/2]`. A cone light always returns
a real polygon (never `null`, even with zero occluders) since a wedge is
never "the ordinary un-masked circle" — the returned polygon is a real
pie-slice: the origin `(0, 0)` itself (the light's own position, in the
same origin-relative space every other point here is in) is included as
the first and last vertex so the two straight cone edges are part of the
polygon, not just its arc.

## Parameters

### radius

`number`

### segments

readonly [`Segment`](../interfaces/Segment.md)[]

### raySamples?

`number` = `32`

### cone?

#### angle

`number`

#### direction

`number`

## Returns

[`Point`](../interfaces/Point.md)[] \| `null`
