[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LayerFilterOptions

# Interface: LayerFilterOptions

Defined in: engine/src/systems/PostProcessSystem.ts:35

## Properties

### blur?

> `optional` **blur?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:66

rain-glass: max fog blur radius in scene px. Default 6.

***

### colour?

> `optional` **colour?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:48

outline: colour 0xRRGGBB

***

### contrast?

> `optional` **contrast?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:44

colour-grade: independent contrast override (0..2, 1 = identity)

***

### degrees?

> `optional` **degrees?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:46

hue-rotate: degrees

***

### dropletSize?

> `optional` **dropletSize?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:56

rain-glass: droplet size; 0.12 is the default, radii scale proportionally.

***

### dropletSpeed?

> `optional` **dropletSpeed?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:58

rain-glass: slide speed; 0.35 is the default, speed scales proportionally.

***

### enabled?

> `optional` **enabled?**: `boolean`

Defined in: engine/src/systems/PostProcessSystem.ts:77

***

### fog?

> `optional` **fog?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:64

rain-glass: 0..1 condensation fog. Default 0.

***

### intensity?

> `optional` **intensity?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:54

rain-glass: 0..1 spawn rate and refraction strength. Default 0.6.

***

### mode?

> `optional` **mode?**: [`ColourblindMode`](../type-aliases/ColourblindMode.md)

Defined in: engine/src/systems/PostProcessSystem.ts:52

colourblind: which deficiency to simulate

***

### quality?

> `optional` **quality?**: [`RainQuality`](../type-aliases/RainQuality.md)

Defined in: engine/src/systems/PostProcessSystem.ts:62

rain-glass: quality tier, "auto" (default) follows the host GPU tier.

***

### radius?

> `optional` **radius?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:38

blur: radius in px

***

### saturation?

> `optional` **saturation?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:42

colour-grade: independent saturation override (0..2, 1 = identity)

***

### seed?

> `optional` **seed?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:72

rain-glass: sim RNG seed. Default 1.

***

### slope?

> `optional` **slope?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:68

rain-glass: 0..1 gravity scale (0 flat, 1 vertical glass). Default 1.

***

### streakAmount?

> `optional` **streakAmount?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:60

rain-glass: trail amount; 0.5 is the default, 0 disables trails.

***

### thickness?

> `optional` **thickness?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:50

outline: thickness px

***

### type

> **type**: [`LayerFilterType`](../type-aliases/LayerFilterType.md)

Defined in: engine/src/systems/PostProcessSystem.ts:36

***

### value?

> `optional` **value?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:40

colour-grade, brightness, contrast, saturate: 0..2 (1 = identity)

***

### wind?

> `optional` **wind?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:70

rain-glass: lateral wind in map px/s. Default 0.

***

### wiperEnabled?

> `optional` **wiperEnabled?**: `boolean`

Defined in: engine/src/systems/PostProcessSystem.ts:74

rain-glass: run the wiper continuously. Default false.

***

### wiperPeriod?

> `optional` **wiperPeriod?**: `number`

Defined in: engine/src/systems/PostProcessSystem.ts:76

rain-glass: wiper out-and-back time in seconds.
