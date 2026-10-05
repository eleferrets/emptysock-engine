[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / stageNativePlatform

# Function: stageNativePlatform()

> **stageNativePlatform**(`opts`): `Promise`\<[`StageNativeResult`](../type-aliases/StageNativeResult.md)\>

Defined in: toolchain/src/nativeStage.ts:62

The CLI's `export --platform android|ios|raspi` step: bundle the entry to
`<out>/game.js`, stage this platform's Included Files (`platforms`-filtered,
including `"raspi"` entries) at `includedFilesDestFor()`, and write
`<platform>-export.json` describing what was staged. It does not run
Gradle/Xcode or produce an apk/ipa: those need the platform's own SDK, which
`packages/export-utils` shells out to separately.

## Parameters

### opts

[`StageNativeOptions`](../interfaces/StageNativeOptions.md)

## Returns

`Promise`\<[`StageNativeResult`](../type-aliases/StageNativeResult.md)\>
