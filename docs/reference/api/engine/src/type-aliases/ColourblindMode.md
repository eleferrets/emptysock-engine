[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ColourblindMode

# Type Alias: ColourblindMode

> **ColourblindMode** = `"protanopia"` \| `"deuteranopia"` \| `"tritanopia"`

Defined in: [engine/src/systems/PostProcessSystem.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PostProcessSystem.ts#L31)

Colour-vision-deficiency modes. The matrices shipped here (see
`COLOURBLIND_MATRICES`) are the standard Brettel/Viénot/Machado
*simulation* matrices — they show a non-colourblind player what a
colourblind player sees. They are not a correction/daltonisation filter
that increases discriminability for a colourblind player; a full
correction algorithm needs per-scene palette analysis and is out of scope
for this pass. Ship this honestly as a simulation tool for
designers/QA checking their palette, and pair it with palette choices
(avoid red/green as the only distinguishing signal) for real accessibility.
