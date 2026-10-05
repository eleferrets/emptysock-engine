[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / layoutBitmapText

# Function: layoutBitmapText()

> **layoutBitmapText**(`def`, `text`): [`BitmapTextLayout`](../interfaces/BitmapTextLayout.md)

Defined in: engine/src/systems/BitmapFontDef.ts:70

Lays out `text` (`\n` starts a new line) the way a bitmap
font: each glyph rect is drawn at `penX + offset`, then the pen advances by
`shift` plus any kerning against the next glyph. Code points with no glyph
are skipped. Pure maths, used to verify the pixi wiring against a known
layout and available to hosts that render bitmap text some other way.

## Parameters

### def

[`BitmapFontDef`](../interfaces/BitmapFontDef.md)

### text

`string`

## Returns

[`BitmapTextLayout`](../interfaces/BitmapTextLayout.md)
