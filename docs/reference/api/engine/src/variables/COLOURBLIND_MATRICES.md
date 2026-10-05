[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / COLOURBLIND\_MATRICES

# Variable: COLOURBLIND\_MATRICES

> `const` **COLOURBLIND\_MATRICES**: `Record`\<[`ColourblindMode`](../type-aliases/ColourblindMode.md), readonly `number`[]\>

Defined in: engine/src/systems/PostProcessSystem.ts:87

Standard colour-vision-deficiency *simulation* matrices (row-major 3x3,
applied to linear-ish sRGB). Source: Viénot, Brettel & Mollon /
Machado-Oliveira-Fernandes (2009), the commonly cited coefficients used
by browser devtools' own CVD emulation. These simulate the deficiency —
they do not correct for it.
