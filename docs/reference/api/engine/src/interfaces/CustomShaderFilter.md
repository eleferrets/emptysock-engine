[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CustomShaderFilter

# Interface: CustomShaderFilter

Defined in: engine/src/systems/CustomShaderFilter.ts:107

A user-authored post-process filter. Construct it from the same GLSL
source the ShaderEditor panel previews, attach it to a layer via
RenderSystem.addLayerShaderFilter(), and call setTime() once per frame
from the game loop if the shader reads uTime.

## Extends

- `Filter`

## Properties

### shaderName

> `readonly` **shaderName**: `string`

Defined in: engine/src/systems/CustomShaderFilter.ts:145

The program name (registry id for generated shaders); used in diagnostics.

## Methods

### setTime()

> **setTime**(`seconds`): `void`

Defined in: engine/src/systems/CustomShaderFilter.ts:155

Updates the uTime uniform. Call once per frame from the game loop.

#### Parameters

##### seconds

`number`

#### Returns

`void`

***

### setUniform()

> **setUniform**(`name`, `value`): `void`

Defined in: engine/src/systems/CustomShaderFilter.ts:150

Writes a uniform previously declared via `options.uniforms`; undeclared names are ignored.

#### Parameters

##### name

`string`

##### value

`number` \| `number`[]

#### Returns

`void`
