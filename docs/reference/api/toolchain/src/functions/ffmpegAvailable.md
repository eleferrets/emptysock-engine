[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / ffmpegAvailable

# Function: ffmpegAvailable()

> **ffmpegAvailable**(`execImpl?`): `Promise`\<`boolean`\>

Defined in: toolchain/src/audioCompress.ts:49

Cached "does `ffmpeg -version` run" check. Real inspection only runs once per process unless `resetFfmpegAvailabilityCache()` is called (tests need this to swap in a stub `execImpl`).

## Parameters

### execImpl?

`ExecFileFn` = `defaultExec`

## Returns

`Promise`\<`boolean`\>
