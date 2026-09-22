[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / evaluateTrackAt

# Function: evaluateTrackAt()

> **evaluateTrackAt**(`track`, `time`): `number`

Defined in: [engine/src/systems/SequenceSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/SequenceSystem.ts#L37)

Pure evaluation of a track's value at an arbitrary time, using the same
per-segment easing math `SequenceSystem.play()` schedules via
`TweenManager`. Safe to call for scrubbing/preview without touching a
TweenManager instance.

## Parameters

### track

[`SequenceTrackDef`](../interfaces/SequenceTrackDef.md)

### time

`number`

## Returns

`number`
