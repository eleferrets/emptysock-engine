[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / toFilterWgslVertexSource

# Function: toFilterWgslVertexSource()

> **toFilterWgslVertexSource**(`vertexSrc`): `string`

Defined in: engine/src/systems/ShaderRegistry.ts:213

The WGSL vertex stage that pairs with an generated WGSL fragment
: `gfu` global
filter uniforms at group 0 binding 0, `mainVertex(@location(0) aPosition)`,
pixi's `filterVertexPosition` maths, and one `@location(n)` output per
vertex-stage varying in declaration order (texcoord-named varyings carry
the filter texture coordinate, the rest are `vec4(1.0)`), mirroring
`toFilterVertexSource` for GLSL. Takes the translated GLSL ES 3.00 vertex
(`out` lines) the asset pipeline emits.

## Parameters

### vertexSrc

`string`

## Returns

`string`
