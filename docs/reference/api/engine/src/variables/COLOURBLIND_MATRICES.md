[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / COLOURBLIND\_MATRICES

# Variable: COLOURBLIND\_MATRICES

> `const` **COLOURBLIND\_MATRICES**: `Record`\<[`ColourblindMode`](../type-aliases/ColourblindMode.md), readonly `number`[]\>

Defined in: [engine/src/systems/PostProcessSystem.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L61)

Standard colour-vision-deficiency *simulation* matrices (row-major 3x3,
applied to linear-ish sRGB). Source: Viénot, Brettel & Mollon /
Machado-Oliveira-Fernandes (2009), the commonly cited coefficients used
by browser devtools' own CVD emulation. These simulate the deficiency —
they do not correct for it.
