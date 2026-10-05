[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / applyWindowConfigToTauri

# Function: applyWindowConfigToTauri()

> **applyWindowConfigToTauri**(`tauriConfPath`, `config`): `void`

Defined in: toolchain/src/window-config.ts:58

Patch the first window entry in tauri.conf.json to match the given
WindowConfig. Creates or overwrites only the keys EmptySock manages;
all other tauri.conf.json keys are left intact.

## Parameters

### tauriConfPath

`string`

### config

[`WindowConfig`](../interfaces/WindowConfig.md)

## Returns

`void`
