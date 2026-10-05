[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ShaderSource

# Interface: ShaderSource

Defined in: engine/src/systems/ShaderRegistry.ts:18

Module-level registry of named GLSL shaders, keyed by the shader
resource name (`sh_white`). Same "register once, look up by string id"
shape as `FontRegistry`, but module-level rather than
a `Game` service because `shader_set(sh_white)` addresses shaders by
global asset name with no `Game` in reach of a bare compat call.

Plain data only — no pixi import, so this file stays inside the engine
environment boundary. The live `Filter` is built lazily by `RenderPipeline`
(a pixi-allowlisted file) from the source stored here and cached one per
shader id, shared by every entity using that shader.

Uniforms are per-shader-id, shared by every entity using that shader —
The uniforms are global-until-changed state on the currently
bound shader, not per-instance, so this matches it rather than approximating
it. A per-entity uniform value would need one Filter per entity.

## Properties

### fragmentSrc

> **fragmentSrc**: `string`

Defined in: engine/src/systems/ShaderRegistry.ts:21

***

### vertexSrc

> **vertexSrc**: `string`

Defined in: engine/src/systems/ShaderRegistry.ts:20

The translated (GLSL ES 3.00) vertex stage the asset pipeline emitted. Only its `out` varyings are read; see `toFilterVertexSource`.

***

### wgslFragmentSrc?

> `optional` **wgslFragmentSrc?**: `string`

Defined in: engine/src/systems/ShaderRegistry.ts:28

Optional WGSL fragment stage (entry point `main`) the asset pipeline converted
from the GLSL one at build time. Present, the shader can also run under
the WebGPU renderer; absent, it is GL-only. Its bind layout and locations
follow pixi 8.21's filter contract, see `toFilterWgslVertexSource`.
