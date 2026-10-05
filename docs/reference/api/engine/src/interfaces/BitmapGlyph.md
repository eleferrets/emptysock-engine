[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BitmapGlyph

# Interface: BitmapGlyph

Defined in: engine/src/systems/BitmapFontDef.ts:11

A pixi-free description of a pre-rendered bitmap font: an atlas image plus
per-glyph rectangles, advances and kerning. This is the shape
`@emptysock/toolchain`'s font pipeline emits for a
font resource (`glyphs` map + `kerningPairs`), registered in
`FontRegistry.registerBitmap(id, def)`. Keeping it free of any pixi import
keeps the registry, the layout maths and their tests inside the engine
environment boundary; `RenderPipeline`'s `PixiDrawTarget` is the one
place a def becomes a real pixi `BitmapFont`/`BitmapText`.

## Properties

### h

> **h**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:16

***

### offset

> **offset**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:20

Horizontal offset applied when drawing the glyph rect (`offset`, the left bearing).

***

### shift

> **shift**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:18

Horizontal advance to the next glyph (`shift`).

***

### w

> **w**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:15

***

### x

> **x**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:13

Top-left of the glyph's rectangle inside the atlas image, in pixels.

***

### y

> **y**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:14
