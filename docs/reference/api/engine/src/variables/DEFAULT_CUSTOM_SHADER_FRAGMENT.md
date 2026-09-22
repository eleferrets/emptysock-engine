[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DEFAULT\_CUSTOM\_SHADER\_FRAGMENT

# Variable: DEFAULT\_CUSTOM\_SHADER\_FRAGMENT

> `const` **DEFAULT\_CUSTOM\_SHADER\_FRAGMENT**: "\n  precision mediump float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n\n  void main() \{\n    finalColor = texture(uTexture, vUV);\n  \}\n"

Defined in: [engine/src/systems/CustomShaderFilter.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CustomShaderFilter.ts#L34)
