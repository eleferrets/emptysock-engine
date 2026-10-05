[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / copyIncludedFiles

# Function: copyIncludedFiles()

> **copyIncludedFiles**(`projectDir`, `entries`, `destDir`): [`CopyIncludedFilesResult`](../interfaces/CopyIncludedFilesResult.md)

Defined in: toolchain/src/includedFiles.ts:155

Copies every entry (already filtered to one platform via
`resolveIncludedFilesForPlatform`) from `projectDir` into `destDir`,
preserving each entry's relative path. A missing source file is a real,
named warning — never a silent skip or a thrown error that aborts the
whole build over one missing asset.

## Parameters

### projectDir

`string`

### entries

readonly [`IncludedFileEntry`](../interfaces/IncludedFileEntry.md)[]

### destDir

`string`

## Returns

[`CopyIncludedFilesResult`](../interfaces/CopyIncludedFilesResult.md)
