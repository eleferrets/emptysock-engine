[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / resolveIncludedFilesForPlatform

# Function: resolveIncludedFilesForPlatform()

> **resolveIncludedFilesForPlatform**(`manifest`, `platform`): [`IncludedFileEntry`](../interfaces/IncludedFileEntry.md)[]

Defined in: toolchain/src/includedFiles.ts:115

Filters a manifest's entries down to the ones that ship to `platform` — "all" (explicit, or the default when `platforms` is omitted) always matches.

## Parameters

### manifest

[`IncludedFilesManifest`](../interfaces/IncludedFilesManifest.md)

### platform

[`IncludedFilePlatform`](../type-aliases/IncludedFilePlatform.md)

## Returns

[`IncludedFileEntry`](../interfaces/IncludedFileEntry.md)[]
