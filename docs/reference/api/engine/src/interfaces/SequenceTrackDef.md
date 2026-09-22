[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SequenceTrackDef

# Interface: SequenceTrackDef

Defined in: [engine/src/systems/SequenceSystem.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SequenceSystem.ts#L18)

## Properties

### ease?

> `optional` **ease?**: [`EasingName`](../type-aliases/EasingName.md)

Defined in: [engine/src/systems/SequenceSystem.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SequenceSystem.ts#L23)

Easing applied to every segment of this track. Defaults to "linear".

***

### keyframes

> **keyframes**: [`SequenceKeyframe`](SequenceKeyframe.md)[]

Defined in: [engine/src/systems/SequenceSystem.ts:21](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SequenceSystem.ts#L21)

***

### property

> **property**: `string`

Defined in: [engine/src/systems/SequenceSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SequenceSystem.ts#L20)

Key set on the target object, e.g. "x", "rotation", "alpha".
