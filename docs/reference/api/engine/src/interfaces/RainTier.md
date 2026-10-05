[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RainTier

# Interface: RainTier

Defined in: engine/src/systems/RainGlassTiers.ts:8

## Properties

### beadCap

> **beadCap**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:20

Max simultaneous trail beads (0 = wet map only).

***

### blurTaps

> **blurTaps**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:26

Fog blur disc taps (0 = tint only).

***

### chromatic

> **chromatic**: `boolean`

Defined in: engine/src/systems/RainGlassTiers.ts:28

Extra chromatic-split refraction samples.

***

### mapH

> **mapH**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:11

Drop-map height in px; width follows the view aspect.

***

### mapW

> **mapW**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:13

Map width at 16:9 (the default aspect).

***

### maxDrops

> **maxDrops**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:14

***

### name

> **name**: [`RainTierName`](../type-aliases/RainTierName.md)

Defined in: engine/src/systems/RainGlassTiers.ts:9

***

### simHz

> **simHz**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:22

Sim substeps per second.

***

### spawnPerSec

> **spawnPerSec**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:16

Spawns per second at intensity 1.

***

### trails

> **trails**: `boolean`

Defined in: engine/src/systems/RainGlassTiers.ts:18

Sliding drops stamp the wet map and shed volume.

***

### uploadEvery

> **uploadEvery**: `number`

Defined in: engine/src/systems/RainGlassTiers.ts:24

Upload the map every N frames.
