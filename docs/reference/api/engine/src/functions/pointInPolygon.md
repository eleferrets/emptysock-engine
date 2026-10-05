[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / pointInPolygon

# Function: pointInPolygon()

> **pointInPolygon**(`point`, `polygon`): `boolean`

Defined in: engine/src/systems/LightOcclusion.ts:191

Even-odd point-in-polygon test (ray casting). Exported for tests that
want to assert "this world point is/isn't actually lit" against a
computed visibility polygon, and available to any future caller that
needs the same check (e.g. a gameplay query like "is the player in the
dark").

## Parameters

### point

[`Point`](../interfaces/Point.md)

### polygon

readonly [`Point`](../interfaces/Point.md)[]

## Returns

`boolean`
