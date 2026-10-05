[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RainGlassSimOptions

# Interface: RainGlassSimOptions

Defined in: engine/src/systems/RainGlassSim.ts:118

## Properties

### beadCap?

> `optional` **beadCap?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:148

Max simultaneous trail beads; 0 leaves trails to the wet map only. Default 0.

***

### evapRate?

> `optional` **evapRate?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:138

Evaporation, map-height-relative radius loss per second for static drops. Default 0.02.

***

### fog?

> `optional` **fog?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:152

Target condensation 0..1. Default 0.

***

### height

> **height**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:124

Map height in px.

***

### intensity?

> `optional` **intensity?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:132

0..1 spawn rate scale. Default 0.6.

***

### maxDrops

> **maxDrops**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:126

Pool capacity.

***

### seed?

> `optional` **seed?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:130

RNG seed. Default 1.

***

### sizeScale?

> `optional` **sizeScale?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:134

Scales spawned radii (1 = default; the legacy 0.12 default maps to 1).

***

### slope?

> `optional` **slope?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:140

Gravity scale, 0 (flat) to 1 (vertical glass). Default 1.

***

### spawnPerSec

> **spawnPerSec**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:128

Spawns per second at intensity 1.

***

### speedScale?

> `optional` **speedScale?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:144

Scales slide speed (legacy dropletSpeed / 0.35). Default 1.

***

### stepSec?

> `optional` **stepSec?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:136

Fixed substep length in seconds. Default 1/60.

***

### trails?

> `optional` **trails?**: `boolean`

Defined in: engine/src/systems/RainGlassSim.ts:150

Whether sliding drops stamp the wet map and shed volume. Default true.

***

### trailScale?

> `optional` **trailScale?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:146

Scales trail wet stamp and shed rate (legacy streakAmount / 0.5). 0 disables trails. Default 1.

***

### width

> **width**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:122

Map width in px.

***

### wind?

> `optional` **wind?**: `number`

Defined in: engine/src/systems/RainGlassSim.ts:142

Lateral drift in map px/s at unit scale. Default 0.

***

### wiper?

> `optional` **wiper?**: `Partial`\<[`WiperOptions`](WiperOptions.md)\>

Defined in: engine/src/systems/RainGlassSim.ts:120

Wiper overrides.
