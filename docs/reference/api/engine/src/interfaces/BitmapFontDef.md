[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BitmapFontDef

# Interface: BitmapFontDef

Defined in: engine/src/systems/BitmapFontDef.ts:23

## Properties

### atlasPath

> **atlasPath**: `string`

Defined in: engine/src/systems/BitmapFontDef.ts:26

Path of the atlas image, loaded through the same texture path `Sprite.texturePath` uses.

***

### glyphs

> **glyphs**: `Record`\<`number`, [`BitmapGlyph`](BitmapGlyph.md)\>

Defined in: engine/src/systems/BitmapFontDef.ts:32

Glyph rectangles keyed by Unicode code point.

***

### kerning

> **kerning**: readonly readonly \[`number`, `number`, `number`\][]

Defined in: engine/src/systems/BitmapFontDef.ts:34

`[first, second, amount]`: `amount` pixels are added to the advance between glyph `first` and glyph `second`.

***

### lineHeight

> **lineHeight**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:30

Distance between baselines: the tallest glyph's `h`, since every glyph rect spans its own full line box.

***

### name

> **name**: `string`

Defined in: engine/src/systems/BitmapFontDef.ts:24

***

### size

> **size**: `number`

Defined in: engine/src/systems/BitmapFontDef.ts:28

The font's nominal point size (`size`).
