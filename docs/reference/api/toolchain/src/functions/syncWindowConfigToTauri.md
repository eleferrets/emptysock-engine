[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / syncWindowConfigToTauri

# Function: syncWindowConfigToTauri()

> **syncWindowConfigToTauri**(`projectDir`, `tauriDir?`): `boolean`

Defined in: [toolchain/src/window-config.ts:111](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/toolchain/src/window-config.ts#L111)

Convenience: read window config from a project directory and apply it to
the tauri.conf.json in the same or a sibling location.

projectDir  — directory containing emptysock.project.json
tauriDir    — directory containing tauri.conf.json (defaults to projectDir)

## Parameters

### projectDir

`string`

### tauriDir?

`string` = `projectDir`

## Returns

`boolean`
