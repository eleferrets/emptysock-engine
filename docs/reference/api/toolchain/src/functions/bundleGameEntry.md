[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / bundleGameEntry

# Function: bundleGameEntry()

> **bundleGameEntry**(`opts`): `Promise`\<[`BundleGameEntryResult`](../type-aliases/BundleGameEntryResult.md)\>

Defined in: toolchain/src/desktopBuild.ts:145

Bundles a single game entry point into one IIFE string, in memory — the
Rolldown equivalent of esbuild's old `{ bundle: true, write: false,
format: "iife" }` call. Exported standalone (not just inlined in
`buildDesktopApp`) so it's testable without a Rust/`cargo tauri`
toolchain, which the rest of `buildDesktopApp` requires.

## Parameters

### opts

[`BundleGameEntryOptions`](../interfaces/BundleGameEntryOptions.md)

## Returns

`Promise`\<[`BundleGameEntryResult`](../type-aliases/BundleGameEntryResult.md)\>
