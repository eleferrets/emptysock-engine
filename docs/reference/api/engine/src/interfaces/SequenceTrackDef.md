[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SequenceTrackDef

# Interface: SequenceTrackDef

Defined in: engine/src/systems/SequenceSystem.ts:18

## Properties

### ease?

> `optional` **ease?**: [`EasingName`](../type-aliases/EasingName.md)

Defined in: engine/src/systems/SequenceSystem.ts:23

Easing applied to every segment of this track. Defaults to "linear".

***

### keyframes

> **keyframes**: `SequenceKeyframe`[]

Defined in: engine/src/systems/SequenceSystem.ts:21

***

### property

> **property**: `string`

Defined in: engine/src/systems/SequenceSystem.ts:20

Key set on the target object, e.g. "x", "rotation", "alpha".
