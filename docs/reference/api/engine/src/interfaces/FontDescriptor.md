[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / FontDescriptor

# Interface: FontDescriptor

Defined in: engine/src/systems/FontRegistry.ts:23

A real component for working with fonts — a `Game`-scoped registry of
named font descriptors (family/size/bold/italic, plus a precomposed CSS
font string), the exact shape `@emptysock/toolchain`'s font pipeline
already emits (`buildFontAsset` — family/size/style metadata, no
bitmap-glyph-atlas rendering path since this engine's text is plain
Canvas/CSS, see that function's own doc comment). Before this, a
generated `*.font.ts` descriptor had nowhere real to register into —
`Label`/`ButtonState`/`Checkbox` each duplicated a raw `font`/`fontSize`
pair with no shared font-asset concept at all.

Registered as a `Game` service the same way `GlobalStore`/`PluginSystem`
are (see `Services.ts`'s own doc comment and `Game.ts`'s constructor) —
one instance per `Game`, alive for its whole lifetime, handed to scene
code via `SceneLifecycle.fonts` for convenience. `UISystem` optionally
takes a `FontRegistry` (`UISystemOptions.fonts`) and resolves a widget's
`fontId` through it when set, falling back to the widget's own raw
`font`/`fontSize` fields otherwise — additive, so existing widgets with
no `fontId` set keep working unchanged.

## Properties

### bold

> **bold**: `boolean`

Defined in: engine/src/systems/FontRegistry.ts:26

***

### family

> **family**: `string`

Defined in: engine/src/systems/FontRegistry.ts:24

***

### italic

> **italic**: `boolean`

Defined in: engine/src/systems/FontRegistry.ts:27

***

### size

> **size**: `number`

Defined in: engine/src/systems/FontRegistry.ts:25
