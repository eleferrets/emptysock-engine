[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNTextboxOptions

# Interface: VNTextboxOptions

Defined in: vn/src/VNTextbox.ts:14

## Properties

### canvasHeight

> **canvasHeight**: `number`

Defined in: vn/src/VNTextbox.ts:18

Canvas height — used to position the textbox at the bottom.

***

### canvasWidth

> **canvasWidth**: `number`

Defined in: vn/src/VNTextbox.ts:16

Canvas width — used to size and position the textbox.

***

### fontFamily?

> `optional` **fontFamily?**: `string`

Defined in: vn/src/VNTextbox.ts:42

Font family used for text measurement. Must match the font your renderer
applies to dialogue text so that line breaks are calculated correctly.
Default 'sans-serif'.

***

### fontSize?

> `optional` **fontSize?**: `number`

Defined in: vn/src/VNTextbox.ts:36

Font size for dialogue text. Default 16.

***

### height?

> `optional` **height?**: `number`

Defined in: vn/src/VNTextbox.ts:24

Height of the dialogue panel in pixels. Default 160.

***

### namePlateColor?

> `optional` **namePlateColor?**: `string`

Defined in: vn/src/VNTextbox.ts:32

Fill colour of the name plate as a CSS colour string. Default '#3c2d6e'.

***

### namePlateHeight?

> `optional` **namePlateHeight?**: `number`

Defined in: vn/src/VNTextbox.ts:26

Height of the speaker name plate in pixels. Default 36.

***

### paddingX?

> `optional` **paddingX?**: `number`

Defined in: vn/src/VNTextbox.ts:28

Horizontal padding inside the panel. Default 24.

***

### panelColor?

> `optional` **panelColor?**: `string`

Defined in: vn/src/VNTextbox.ts:30

Fill colour of the dialogue panel as a CSS colour string. Default '#0d0d1a'.

***

### scene

> **scene**: `Scene`

Defined in: vn/src/VNTextbox.ts:20

The scene to spawn the textbox's widget entities into.

***

### textColor?

> `optional` **textColor?**: `string`

Defined in: vn/src/VNTextbox.ts:34

Text colour as a CSS colour string. Default '#ffffff'.

***

### tree

> **tree**: `WidgetTree`

Defined in: vn/src/VNTextbox.ts:22

The scene's widget tree — the textbox's entities are spawned/destroyed through it.

***

### typewriterSpeed?

> `optional` **typewriterSpeed?**: `number`

Defined in: vn/src/VNTextbox.ts:49

Typewriter reveal speed in characters per second. When set, text is
revealed character by character with line breaks pre-calculated so words
never split across lines mid-reveal. Call `handlePointerDown()` or
`skipTypewriter()` to jump to the end. Set to 0 or omit for instant display.
