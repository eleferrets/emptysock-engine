[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNTextboxOptions

# Interface: VNTextboxOptions

Defined in: [vn/src/VNTextbox.ts:5](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L5)

## Properties

### canvasHeight

> **canvasHeight**: `number`

Defined in: [vn/src/VNTextbox.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L9)

Canvas height — used to position the textbox at the bottom.

***

### canvasWidth

> **canvasWidth**: `number`

Defined in: [vn/src/VNTextbox.ts:7](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L7)

Canvas width — used to size and position the textbox.

***

### fontFamily?

> `optional` **fontFamily?**: `string`

Defined in: [vn/src/VNTextbox.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L34)

Font family used for text measurement. Must match the font your renderer
applies to dialogue text so that line breaks are calculated correctly.
Default 'sans-serif'.

***

### fontSize?

> `optional` **fontSize?**: `number`

Defined in: [vn/src/VNTextbox.ts:28](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L28)

Font size for dialogue text. Default 16.

***

### height?

> `optional` **height?**: `number`

Defined in: [vn/src/VNTextbox.ts:16](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L16)

Height of the dialogue panel in pixels. Default 160.

***

### namePlateColor?

> `optional` **namePlateColor?**: `string`

Defined in: [vn/src/VNTextbox.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L24)

Fill colour of the name plate as a CSS colour string. Default '#3c2d6e'.

***

### namePlateHeight?

> `optional` **namePlateHeight?**: `number`

Defined in: [vn/src/VNTextbox.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L18)

Height of the speaker name plate in pixels. Default 36.

***

### paddingX?

> `optional` **paddingX?**: `number`

Defined in: [vn/src/VNTextbox.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L20)

Horizontal padding inside the panel. Default 24.

***

### panelColor?

> `optional` **panelColor?**: `string`

Defined in: [vn/src/VNTextbox.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L22)

Fill colour of the dialogue panel as a CSS colour string. Default '#0d0d1a'.

***

### textColor?

> `optional` **textColor?**: `string`

Defined in: [vn/src/VNTextbox.ts:26](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L26)

Text colour as a CSS colour string. Default '#ffffff'.

***

### typewriterSpeed?

> `optional` **typewriterSpeed?**: `number`

Defined in: [vn/src/VNTextbox.ts:41](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L41)

Typewriter reveal speed in characters per second. When set, text is
revealed character by character with line breaks pre-calculated so words
never split across lines mid-reveal. Click or call skipTypewriter() to
jump to the end. Set to 0 or omit for instant display.

***

### ui

> **ui**: `UISystem`

Defined in: [vn/src/VNTextbox.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNTextbox.ts#L14)

Scene UI system. The textbox registers itself as a root widget here and
removes itself when destroy() is called.
