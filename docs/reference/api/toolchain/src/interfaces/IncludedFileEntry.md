[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / IncludedFileEntry

# Interface: IncludedFileEntry

Defined in: toolchain/src/includedFiles.ts:24

## Properties

### path

> **path**: `string`

Defined in: toolchain/src/includedFiles.ts:26

File or directory path, relative to the manifest's own directory (a directory copies recursively).

***

### platforms?

> `optional` **platforms?**: [`IncludedFilePlatform`](../type-aliases/IncludedFilePlatform.md)[]

Defined in: toolchain/src/includedFiles.ts:28

Which platform(s) this entry ships to. Omitted, or containing "all", means every platform.
