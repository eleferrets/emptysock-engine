[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DEFAULT\_CUSTOM\_SHADER\_FRAGMENT

# Variable: DEFAULT\_CUSTOM\_SHADER\_FRAGMENT

> `const` **DEFAULT\_CUSTOM\_SHADER\_FRAGMENT**: "\n  precision mediump float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n\n  void main() \{\n    finalColor = texture(uTexture, vUV);\n  \}\n"

Defined in: [engine/src/systems/CustomShaderFilter.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L34)
