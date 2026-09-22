[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CustomShaderFilter

# Class: CustomShaderFilter

Defined in: [engine/src/systems/CustomShaderFilter.ts:62](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L62)

A user-authored post-process filter. Construct it from the same GLSL
source the ShaderEditor panel previews, attach it to a layer via
RenderSystem.addLayerShaderFilter(), and call setTime() once per frame
from the game loop if the shader reads uTime.

## Extends

- `Filter`

## Constructors

### Constructor

> **new CustomShaderFilter**(`options`): `CustomShaderFilter`

Defined in: [engine/src/systems/CustomShaderFilter.ts:63](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L63)

#### Parameters

##### options

[`CustomShaderOptions`](../interfaces/CustomShaderOptions.md)

#### Returns

`CustomShaderFilter`

#### Overrides

`Filter.constructor`

## Methods

### setTime()

> **setTime**(`seconds`): `void`

Defined in: [engine/src/systems/CustomShaderFilter.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CustomShaderFilter.ts#L76)

Updates the uTime uniform. Call once per frame from the game loop.

#### Parameters

##### seconds

`number`

#### Returns

`void`
