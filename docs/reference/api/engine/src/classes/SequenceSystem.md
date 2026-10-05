[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SequenceSystem

# Class: SequenceSystem

Defined in: engine/src/systems/SequenceSystem.ts:69

Plays a SequenceDefinition against a plain numeric target object by
scheduling one `TweenManager.to()` call per keyframe segment, each with a
`delay` equal to its keyframe's start time — exactly the calls a developer
would hand-write:
`tweens.to(target, { prop: b.value }, { duration, delay: a.time, ease })`.
All calls are scheduled synchronously in `play()`, so there is no
scheduling-callback layer and no extra frame of lag versus hand-written
code driving the same TweenManager.

## Constructors

### Constructor

> **new SequenceSystem**(): `SequenceSystem`

#### Returns

`SequenceSystem`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/SequenceSystem.ts:126

#### Returns

`void`

***

### play()

> **play**(`tweens`, `target`, `def`, `startAt?`): `void`

Defined in: engine/src/systems/SequenceSystem.ts:79

#### Parameters

##### tweens

[`TweenManager`](TweenManager.md)

##### target

`Record`\<`string`, `number`\>

##### def

[`SequenceDefinition`](../interfaces/SequenceDefinition.md)

##### startAt?

`number` = `0`

Sequence-time (seconds) to begin playback from — e.g. a
  scrubbed/resumed playhead position. Segments that end before this are
  skipped (their end value is applied immediately); a segment straddling
  it starts mid-way, its "from" computed with `evaluateTrackAt()` so
  resuming mid-tween doesn't jump. Defaults to 0.

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: engine/src/systems/SequenceSystem.ts:121

#### Returns

`void`
