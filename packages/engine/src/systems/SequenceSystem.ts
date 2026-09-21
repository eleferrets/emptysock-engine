// Keyframe sequence playback — the runtime counterpart to the IDE's
// SequenceEditor panel. A sequence authored there is a SequenceDefinition:
// a list of tracks, each a property name plus keyframes, closely mirroring
// what a developer would otherwise hand-write as a chain of
// TweenManager.to()/after() calls. play() schedules exactly that chain —
// there is no separate interpreter, so panel playback and code playback
// produce identical results.

import type { TweenManager, TweenHandle } from "./TweenSystem.js";
import { ease } from "../core/easing.js";
import type { EasingName } from "../core/easing.js";

export interface SequenceKeyframe {
  time: number;
  value: number;
}

export interface SequenceTrackDef {
  /** Key set on the target object, e.g. "x", "rotation", "alpha". */
  property: string;
  keyframes: SequenceKeyframe[];
  /** Easing applied to every segment of this track. Defaults to "linear". */
  ease?: EasingName;
}

export interface SequenceDefinition {
  duration: number;
  tracks: SequenceTrackDef[];
}

/**
 * Pure evaluation of a track's value at an arbitrary time, using the same
 * per-segment easing math `SequenceSystem.play()` schedules via
 * `TweenManager`. Safe to call for scrubbing/preview without touching a
 * TweenManager instance.
 */
export function evaluateTrackAt(track: SequenceTrackDef, time: number): number {
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  if (first === undefined) return 0;
  const last = sorted[sorted.length - 1];
  if (last === undefined || time <= first.time) return first.value;
  if (time >= last.time) return last.value;

  const easing = track.ease ?? "linear";
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a === undefined || b === undefined) continue;
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      const t = span <= 0 ? 1 : (time - a.time) / span;
      return a.value + (b.value - a.value) * ease(easing, t);
    }
  }
  return last.value;
}

/**
 * Plays a SequenceDefinition against a plain numeric target object by
 * scheduling one `TweenManager.to()` call per keyframe segment, each with a
 * `delay` equal to its keyframe's start time — exactly the calls a developer
 * would hand-write:
 * `tweens.to(target, { prop: b.value }, { duration, delay: a.time, ease })`.
 * All calls are scheduled synchronously in `play()`, so there is no
 * scheduling-callback layer and no extra frame of lag versus hand-written
 * code driving the same TweenManager.
 */
export class SequenceSystem {
  private _handles: TweenHandle[] = [];

  /**
   * @param startAt Sequence-time (seconds) to begin playback from — e.g. a
   *   scrubbed/resumed playhead position. Segments that end before this are
   *   skipped (their end value is applied immediately); a segment straddling
   *   it starts mid-way, its "from" computed with `evaluateTrackAt()` so
   *   resuming mid-tween doesn't jump. Defaults to 0.
   */
  play(
    tweens: TweenManager,
    target: Record<string, number>,
    def: SequenceDefinition,
    startAt = 0,
  ): void {
    this.stop();
    for (const track of def.tracks) {
      const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
      const first = sorted[0];
      if (first === undefined) continue;
      target[track.property] = evaluateTrackAt(track, startAt);

      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a === undefined || b === undefined) continue;
        if (b.time <= startAt) continue; // fully elapsed before startAt

        const segStart = Math.max(a.time, startAt);
        const duration = Math.max(0.0001, b.time - segStart);
        const delay = Math.max(0, a.time - startAt);
        const fromValue =
          segStart > a.time ? evaluateTrackAt(track, segStart) : a.value;

        // `to()` snapshots `target[key]` as the tween's "from" value the
        // moment it's called — set it to this segment's start value just
        // long enough to take that snapshot, then restore, so scheduling
        // a later segment doesn't clobber the live value of an earlier one.
        const liveValue = target[track.property] ?? 0;
        target[track.property] = fromValue;
        const handle = tweens.to(
          target,
          { [track.property]: b.value },
          { duration, delay, ease: track.ease ?? "linear" },
        );
        target[track.property] = liveValue;
        this._handles.push(handle);
      }
    }
  }

  stop(): void {
    for (const h of this._handles) h.cancel();
    this._handles = [];
  }

  destroy(): void {
    this.stop();
  }
}
