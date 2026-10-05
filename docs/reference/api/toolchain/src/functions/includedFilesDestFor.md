[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / includedFilesDestFor

# Function: includedFilesDestFor()

> **includedFilesDestFor**(`platform`, `out`): `string`

Defined in: toolchain/src/nativeStage.ts:18

Where a platform's Included Files land under `<out>`, following each
platform's own "extra resources" convention: Android `assets/` (Gradle
`src/main/assets` source), iOS `Resources/` (an Xcode folder reference),
Raspberry Pi next to `game.js` (its `install.sh` copies the whole directory).

## Parameters

### platform

[`StagedNativePlatform`](../type-aliases/StagedNativePlatform.md)

### out

`string`

## Returns

`string`
