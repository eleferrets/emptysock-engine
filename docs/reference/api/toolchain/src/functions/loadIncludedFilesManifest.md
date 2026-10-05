[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / loadIncludedFilesManifest

# Function: loadIncludedFilesManifest()

> **loadIncludedFilesManifest**(`projectDir`, `manifestPath?`): [`IncludedFilesManifest`](../interfaces/IncludedFilesManifest.md) \| `null`

Defined in: toolchain/src/includedFiles.ts:51

Reads and validates the manifest at `manifestPath` (or the default
`<projectDir>/included-files.json`). Returns `null` — not an error — when
the file simply doesn't exist, since most projects have no included
files at all; a genuinely malformed manifest throws a descriptive error
instead of silently producing an empty file list.

## Parameters

### projectDir

`string`

### manifestPath?

`string`

## Returns

[`IncludedFilesManifest`](../interfaces/IncludedFilesManifest.md) \| `null`
