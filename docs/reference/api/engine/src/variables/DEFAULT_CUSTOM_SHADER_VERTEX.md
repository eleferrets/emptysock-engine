[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DEFAULT\_CUSTOM\_SHADER\_VERTEX

# Variable: DEFAULT\_CUSTOM\_SHADER\_VERTEX

> `const` **DEFAULT\_CUSTOM\_SHADER\_VERTEX**: "\n  in vec2 aPosition;\n  in vec2 aUV;\n  out vec2 vUV;\n  uniform mat3 uProjectionMatrix;\n  uniform mat3 uWorldTransformMatrix;\n  uniform mat3 uTransformMatrix;\n\n  void main() \{\n    mat3 mvp = uProjectionMatrix \* uWorldTransformMatrix \* uTransformMatrix;\n    gl\_Position = vec4((mvp \* vec3(aPosition, 1.0)).xy, 0.0, 1.0);\n    vUV = aUV;\n  \}\n"

Defined in: [engine/src/systems/CustomShaderFilter.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CustomShaderFilter.ts#L19)
