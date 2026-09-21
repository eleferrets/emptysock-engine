# SequenceSystem

`packages/engine/src/systems/SequenceSystem.ts`

Plays a keyframe `SequenceDefinition` — a list of tracks, each a target property plus keyframes and an optional easing — against a plain numeric target object, by scheduling real `TweenManager.to()` calls. This is the runtime the IDE's **Sequence Editor** panel drives; a sequence exported from the panel and a hand-written `TweenManager` chain produce identical playback, because `play()` schedules exactly the calls a developer would write by hand.

## Types

```typescript
interface SequenceKeyframe {
  time: number;
  value: number;
}

interface SequenceTrackDef {
  property: string; // key set on the target object, e.g. "x", "rotation"
  keyframes: SequenceKeyframe[];
  ease?: EasingName; // defaults to "linear"
}

interface SequenceDefinition {
  duration: number;
  tracks: SequenceTrackDef[];
}
```

## API

```typescript
import {
  TweenManager,
  SequenceSystem,
  evaluateTrackAt,
} from "@emptysock/engine";

const tweens = new TweenManager();
const seq = new SequenceSystem();
const target = { x: 0, opacity: 0 };

seq.play(tweens, target, def);
// or resume mid-sequence:
seq.play(tweens, target, def, /* startAt */ 1.5);

// per frame:
tweens.update(deltaTime);

seq.stop(); // cancels all scheduled tweens
```

`evaluateTrackAt(track, time)` is a pure, side-effect-free evaluation of a single track at an arbitrary time — using the same per-segment easing math `play()` schedules — useful for scrubbing/preview without touching a `TweenManager` instance.

`play(tweens, target, def, startAt)` sets `target[property]` to the exact value at `startAt` immediately, then schedules one `to()` per remaining keyframe segment with `delay` measured from `startAt`, so resuming mid-playback doesn't jump.
