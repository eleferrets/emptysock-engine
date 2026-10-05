[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / evaluateTrackAt

# Function: evaluateTrackAt()

> **evaluateTrackAt**(`track`, `time`): `number`

Defined in: engine/src/systems/SequenceSystem.ts:37

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
