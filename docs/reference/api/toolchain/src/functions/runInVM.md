[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / runInVM

# Function: runInVM()

> **runInVM**(`options`, `dockerPath?`): [`VMRunResult`](../interfaces/VMRunResult.md)

Defined in: toolchain/src/VMRunner.ts:47

Run a command inside a Docker container with the workspace mounted.
Used to test Linux/Android builds without requiring the host to have
platform-specific toolchains installed.

## Parameters

### options

[`VMRunOptions`](../interfaces/VMRunOptions.md)

### dockerPath?

`string`

## Returns

[`VMRunResult`](../interfaces/VMRunResult.md)
