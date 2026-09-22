[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CustomShaderOptions

# Interface: CustomShaderOptions

Defined in: [engine/src/systems/CustomShaderFilter.ts:47](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L47)

## Properties

### fragmentSrc

> **fragmentSrc**: `string`

Defined in: [engine/src/systems/CustomShaderFilter.ts:49](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L49)

Fragment shader source. Required — this is what the shader actually does.

***

### name?

> `optional` **name?**: `string`

Defined in: [engine/src/systems/CustomShaderFilter.ts:53](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L53)

GlProgram name, useful for debugging in browser devtools.

***

### vertexSrc?

> `optional` **vertexSrc?**: `string`

Defined in: [engine/src/systems/CustomShaderFilter.ts:51](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L51)

Vertex shader source. Defaults to DEFAULT_CUSTOM_SHADER_VERTEX.
