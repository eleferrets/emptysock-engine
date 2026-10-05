[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / registerShader

# Function: registerShader()

> **registerShader**(`id`, `source`): `void`

Defined in: engine/src/systems/ShaderRegistry.ts:52

Registers (or replaces) a shader. CR/CRLF line endings are normalised to LF — a lone `\r` inside a `//` comment is not reliably a line end to every GLSL compiler.

## Parameters

### id

`string`

### source

[`ShaderSource`](../interfaces/ShaderSource.md)

## Returns

`void`
