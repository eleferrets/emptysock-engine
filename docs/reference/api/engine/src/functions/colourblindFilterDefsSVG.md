[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / colourblindFilterDefsSVG

# Function: colourblindFilterDefsSVG()

> **colourblindFilterDefsSVG**(): `string`

Defined in: [engine/src/systems/PostProcessSystem.ts:90](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L90)

Builds an inert `<svg>` fragment (as markup) containing one `<filter>` per
CVD mode via `feColorMatrix`. The host page/renderer injects this once
(hidden, zero-size) and references a filter with
`cssFilterForLayer()`'s `url(#es-cvd-<mode>)` output. This module never
touches the DOM itself — it only returns markup — so it stays inside the
engine's environment boundary (no DOM APIs are called here).

## Returns

`string`
