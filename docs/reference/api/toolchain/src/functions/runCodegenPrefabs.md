[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / runCodegenPrefabs

# Function: runCodegenPrefabs()

> **runCodegenPrefabs**(`projectDir`, `options?`): `Promise`\<[`CodegenPrefabsResult`](../type-aliases/CodegenPrefabsResult.md)\>

Defined in: toolchain/src/prefabCodegenCli.ts:98

Runs the full codegen step against `projectDir`: finds every
`*.prefab.json`, resolves components, calls `generatePrefabTypes`, and
writes the result to disk. Returns `{ ok: true, prefabCount: 0 }` (no
file written) when the project has no `.prefab.json` files — that's not
an error, just nothing to generate.

## Parameters

### projectDir

`string`

### options?

[`CodegenPrefabsOptions`](../interfaces/CodegenPrefabsOptions.md) = `{}`

## Returns

`Promise`\<[`CodegenPrefabsResult`](../type-aliases/CodegenPrefabsResult.md)\>
