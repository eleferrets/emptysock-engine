[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SequenceTrackDef

# Interface: SequenceTrackDef

Defined in: [engine/src/systems/SequenceSystem.ts:18](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/SequenceSystem.ts#L18)

## Properties

### ease?

> `optional` **ease?**: [`EasingName`](../type-aliases/EasingName.md)

Defined in: [engine/src/systems/SequenceSystem.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/SequenceSystem.ts#L23)

Easing applied to every segment of this track. Defaults to "linear".

***

### keyframes

> **keyframes**: [`SequenceKeyframe`](SequenceKeyframe.md)[]

Defined in: [engine/src/systems/SequenceSystem.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/SequenceSystem.ts#L21)

***

### property

> **property**: `string`

Defined in: [engine/src/systems/SequenceSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/SequenceSystem.ts#L20)

Key set on the target object, e.g. "x", "rotation", "alpha".
