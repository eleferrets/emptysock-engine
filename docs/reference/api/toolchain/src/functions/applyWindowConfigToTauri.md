[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / applyWindowConfigToTauri

# Function: applyWindowConfigToTauri()

> **applyWindowConfigToTauri**(`tauriConfPath`, `config`): `void`

Defined in: [toolchain/src/window-config.ts:58](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/toolchain/src/window-config.ts#L58)

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
