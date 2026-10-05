[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / stageIncludedFilesForPlatform

# Function: stageIncludedFilesForPlatform()

> **stageIncludedFilesForPlatform**(`projectDir`, `platform`, `destDir`, `manifestPath?`): [`CopyIncludedFilesResult`](../interfaces/CopyIncludedFilesResult.md) \| `null`

Defined in: toolchain/src/includedFiles.ts:189

One-call convenience for build steps other than the desktop one (web zip
export today): load the manifest, filter to `platform`, copy into
`destDir`. No manifest is a silent no-op returning `null`.

## Parameters

### projectDir

`string`

### platform

[`IncludedFilePlatform`](../type-aliases/IncludedFilePlatform.md)

### destDir

`string`

### manifestPath?

`string`

## Returns

[`CopyIncludedFilesResult`](../interfaces/CopyIncludedFilesResult.md) \| `null`
