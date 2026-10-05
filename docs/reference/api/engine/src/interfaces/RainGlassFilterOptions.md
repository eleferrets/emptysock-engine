[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RainGlassFilterOptions

# Interface: RainGlassFilterOptions

Defined in: engine/src/systems/RainGlassFilter.ts:128

## Properties

### blur?

> `optional` **blur?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:142

Max fog blur radius in scene px. Default 6.

***

### dropletSize?

> `optional` **dropletSize?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:132

Droplet size; 0.12 is the default size, scales radii proportionally.

***

### dropletSpeed?

> `optional` **dropletSpeed?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:134

Slide speed scale; 0.35 is the default speed.

***

### fog?

> `optional` **fog?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:140

0..1 condensation. Default 0.

***

### intensity?

> `optional` **intensity?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:130

0..1 spawn rate and refraction strength. Default 0.6.

***

### quality?

> `optional` **quality?**: [`RainQuality`](../type-aliases/RainQuality.md)

Defined in: engine/src/systems/RainGlassFilter.ts:138

Quality tier; "auto" (default) uses the host GPU tier.

***

### seed?

> `optional` **seed?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:148

Sim RNG seed. Default 1.

***

### slope?

> `optional` **slope?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:144

0..1 gravity scale (0 flat, 1 vertical glass). Default 1.

***

### streakAmount?

> `optional` **streakAmount?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:136

Trail amount scale; 0.5 is the default, 0 disables trails.

***

### tint?

> `optional` **tint?**: \[`number`, `number`, `number`\]

Defined in: engine/src/systems/RainGlassFilter.ts:151

Fog tint rgb 0..1.

***

### wind?

> `optional` **wind?**: `number`

Defined in: engine/src/systems/RainGlassFilter.ts:146

Lateral wind in map px/s. Default 0.

***

### wiper?

> `optional` **wiper?**: `Partial`\<[`WiperOptions`](WiperOptions.md)\>

Defined in: engine/src/systems/RainGlassFilter.ts:149
