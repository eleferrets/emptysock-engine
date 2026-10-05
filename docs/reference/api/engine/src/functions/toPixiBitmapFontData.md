[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / toPixiBitmapFontData

# Function: toPixiBitmapFontData()

> **toPixiBitmapFontData**(`def`, `fontFamily`): [`PixiBitmapFontDataLike`](../interfaces/PixiBitmapFontDataLike.md)

Defined in: engine/src/systems/BitmapFontDef.ts:133

Converts a def to pixi's `BitmapFontData`. pixi keys a glyph by its letter
string and kerns by the *previous* letter (`kerning[previousChar]`), so a
`[first, second, amount]` pair becomes `chars[second].kerning[first]`.

## Parameters

### def

[`BitmapFontDef`](../interfaces/BitmapFontDef.md)

### fontFamily

`string`

## Returns

[`PixiBitmapFontDataLike`](../interfaces/PixiBitmapFontDataLike.md)
