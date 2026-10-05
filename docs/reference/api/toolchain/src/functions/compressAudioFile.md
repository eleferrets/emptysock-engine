[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / compressAudioFile

# Function: compressAudioFile()

> **compressAudioFile**(`srcPath`, `destPathNoExt`, `options?`, `execImpl?`): `Promise`\<[`CompressAudioResult`](../type-aliases/CompressAudioResult.md)\>

Defined in: toolchain/src/audioCompress.ts:80

Transcodes `srcPath` into a compressed file at `destPathNoExt` + the
codec's real extension (`.ogg` for vorbis, `.opus` for opus), returning
that real output path. Never throws — a missing `ffmpeg`, or a transcode
that itself fails, both come back as `{ success: false, skipped: true,
reason }` so the caller can honestly fall back to copying the original
file, exactly like every other "optional tool not present" gap this
toolchain already handles (see `desktopBuild.ts`'s cargo/tauri checks).

## Parameters

### srcPath

`string`

### destPathNoExt

`string`

### options?

[`CompressAudioOptions`](../interfaces/CompressAudioOptions.md) = `{}`

### execImpl?

`ExecFileFn` = `defaultExec`

## Returns

`Promise`\<[`CompressAudioResult`](../type-aliases/CompressAudioResult.md)\>
