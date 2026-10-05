[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / toFilterVertexSource

# Function: toFilterVertexSource()

> **toFilterVertexSource**(`vertexSrc`): `string`

Defined in: engine/src/systems/ShaderRegistry.ts:172

Builds the vertex stage a pixi *Filter* needs from a translated
vertex shader. The asset pipeline's vertex stage is a sprite-quad MVP
passthrough (`uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix`),
which is not pixi's Filter contract (a filter's quad is positioned through
`uOutputFrame`/`uOutputTexture`/`uInputSize`, and those MVP matrices are
never set for a filter — that vertex would collapse the quad). Since the
asset pipeline only accepts the standard passthrough position transform, the
position half is safely replaced with pixi's own `filterVertexPosition`
maths and only the `out` varyings are carried over: texcoord-named
varyings take the filter's texture coordinate, everything else
(`v_vColour`) is `vec4(1.0)`, matching what the own vertex stage
assigns them.

## Parameters

### vertexSrc

`string`

## Returns

`string`
