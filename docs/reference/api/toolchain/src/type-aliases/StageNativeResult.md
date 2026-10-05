[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / StageNativeResult

# Type Alias: StageNativeResult

> **StageNativeResult** = \{ `artifacts`: `string`[]; `includedFiles`: `string`[]; `success`: `true`; `warnings`: `string`[]; \} \| \{ `error`: `string`; `success`: `false`; \}

Defined in: toolchain/src/nativeStage.ts:44

## Union Members

### Type Literal

\{ `artifacts`: `string`[]; `includedFiles`: `string`[]; `success`: `true`; `warnings`: `string`[]; \}

#### artifacts

> **artifacts**: `string`[]

Written files: the bundle, the export descriptor, then every staged Included File.

#### includedFiles

> **includedFiles**: `string`[]

#### success

> **success**: `true`

#### warnings

> **warnings**: `string`[]

***

### Type Literal

\{ `error`: `string`; `success`: `false`; \}
