import type { TweenManager } from "./TweenSystem.js";
import type { EasingName } from "../easing.js";
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
export declare function evaluateTrackAt(
  track: SequenceTrackDef,
  time: number,
): number;
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
export declare class SequenceSystem {
  private _handles;
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
    startAt?: number,
  ): void;
  stop(): void;
  destroy(): void;
}
