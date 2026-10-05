[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / DesktopBuildOptions

# Interface: DesktopBuildOptions

Defined in: toolchain/src/desktopBuild.ts:55

## Properties

### aggressive?

> `optional` **aggressive?**: `boolean`

Defined in: toolchain/src/desktopBuild.ts:65

***

### dropConsole?

> `optional` **dropConsole?**: `boolean`

Defined in: toolchain/src/desktopBuild.ts:63

***

### entry

> **entry**: `string`

Defined in: toolchain/src/desktopBuild.ts:59

***

### format

> **format**: `string`

Defined in: toolchain/src/desktopBuild.ts:58

Comma-separated Tauri bundle targets, e.g. "nsis,msi" or "appimage,deb".

***

### includedFilesManifest?

> `optional` **includedFilesManifest?**: `string`

Defined in: toolchain/src/desktopBuild.ts:74

Explicit path to an included-files manifest, overriding the default `<projectDir>/build-included-files.json` lookup.

***

### minify?

> `optional` **minify?**: `boolean`

Defined in: toolchain/src/desktopBuild.ts:62

***

### out

> **out**: `string`

Defined in: toolchain/src/desktopBuild.ts:60

***

### platform

> **platform**: [`DesktopPlatform`](../type-aliases/DesktopPlatform.md)

Defined in: toolchain/src/desktopBuild.ts:56

***

### projectDir?

> `optional` **projectDir?**: `string`

Defined in: toolchain/src/desktopBuild.ts:72

The project directory Included Files paths (in `build-included-files.json`)
are resolved against. Defaults to the entry file's own directory —
right for the common case of a project whose entry lives at the
project root, and overridable for anything else.

***

### projectName?

> `optional` **projectName?**: `string`

Defined in: toolchain/src/desktopBuild.ts:61

***

### sourcemap?

> `optional` **sourcemap?**: `boolean`

Defined in: toolchain/src/desktopBuild.ts:64
