[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / DesktopBuildResult

# Interface: DesktopBuildResult

Defined in: toolchain/src/desktopBuild.ts:77

## Properties

### artifacts?

> `optional` **artifacts?**: `string`[]

Defined in: toolchain/src/desktopBuild.ts:82

Every artifact file found under bundleDir, copied into `out`.

***

### bundleDir?

> `optional` **bundleDir?**: `string`

Defined in: toolchain/src/desktopBuild.ts:80

The real `src-tauri/target/release/bundle/` directory Tauri wrote to.

***

### error?

> `optional` **error?**: `string`

Defined in: toolchain/src/desktopBuild.ts:87

***

### includedFiles?

> `optional` **includedFiles?**: `string`[]

Defined in: toolchain/src/desktopBuild.ts:84

Every Included Files entry actually copied into the packaged app for this platform.

***

### includedFileWarnings?

> `optional` **includedFileWarnings?**: `string`[]

Defined in: toolchain/src/desktopBuild.ts:86

Non-fatal problems from copying Included Files (a missing source path, etc.) — never aborts the build.

***

### success

> **success**: `boolean`

Defined in: toolchain/src/desktopBuild.ts:78
