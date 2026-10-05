[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / parseShaderUniforms

# Function: parseShaderUniforms()

> **parseShaderUniforms**(`fragmentSrc`): [`ParsedShaderUniform`](../interfaces/ParsedShaderUniform.md)[]

Defined in: engine/src/systems/ShaderRegistry.ts:137

Scans a fragment shader for user-declared scalar/vector uniforms
(`uniform float u_time;`). Samplers, matrices and the engine's own
`uTexture`/`uTime` are skipped: pixi needs each uniform's type declared up
front when the Filter is constructed, and `shader_set_uniform_f/_i`
only ever write scalars/vectors.

## Parameters

### fragmentSrc

`string`

## Returns

[`ParsedShaderUniform`](../interfaces/ParsedShaderUniform.md)[]
