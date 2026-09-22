[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LayerFilterOptions

# Interface: LayerFilterOptions

Defined in: [engine/src/systems/PostProcessSystem.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L33)

## Properties

### colour?

> `optional` **colour?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:46](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L46)

outline: colour 0xRRGGBB

***

### contrast?

> `optional` **contrast?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:42](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L42)

colour-grade: independent contrast override (0..2, 1 = identity)

***

### degrees?

> `optional` **degrees?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:44](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L44)

hue-rotate: degrees

***

### enabled?

> `optional` **enabled?**: `boolean`

Defined in: [engine/src/systems/PostProcessSystem.ts:51](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L51)

***

### mode?

> `optional` **mode?**: [`ColourblindMode`](../type-aliases/ColourblindMode.md)

Defined in: [engine/src/systems/PostProcessSystem.ts:50](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L50)

colourblind: which deficiency to simulate

***

### radius?

> `optional` **radius?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L36)

blur: radius in px

***

### saturation?

> `optional` **saturation?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:40](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L40)

colour-grade: independent saturation override (0..2, 1 = identity)

***

### thickness?

> `optional` **thickness?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:48](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L48)

outline: thickness px

***

### type

> **type**: [`LayerFilterType`](../type-aliases/LayerFilterType.md)

Defined in: [engine/src/systems/PostProcessSystem.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L34)

***

### value?

> `optional` **value?**: `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L38)

colour-grade, brightness, contrast, saturate: 0..2 (1 = identity)
