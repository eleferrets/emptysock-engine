/**
 * Per-entity marker + playhead for a running GMS2-imported Sequence
 * ("Sequence" is GameMaker's keyframe-animation asset — tracks of numeric
 * keyframes driving properties like position/scale/image_angle/image_blend
 * over time; see `gms2-sequence-import.ts`'s doc comment for the real
 * on-disk format this was built against). Mirrors `TimelineState`'s shape:
 * the sequence's actual track/keyframe data is shared, immutable data kept
 * in a module-level registry keyed by id (`registerGmlSequence`); only the
 * playhead (`position`, in frames) and playback flags are genuinely
 * per-entity, mutable state, so that's all this component holds.
 *
 * `speed` is in frames per second (GameMaker Sequences' `playbackSpeed`
 * when `playbackSpeedType` is `0`/"frames per second" — the common case;
 * see the importer's own doc comment for the `playbackSpeedType: 1`/"frames
 * per game frame" case, which the importer normalises to an equivalent fps
 * value at import time so this component never needs to know which mode the
 * source asset used).
 */
export declare const GmlSequenceState: import("../Component.js").ComponentDef<{
  sequenceId: string;
  position: number;
  speed: number;
  playing: boolean;
  loop: boolean;
}>;
/** How a keyframe's value is held between it and the next keyframe on the same channel. */
export type GmlSequenceInterpolation = "linear" | "step";
export interface GmlSequenceKeyframe {
  /** Time, in frames, along the sequence's timeline. */
  readonly time: number;
  readonly value: number;
  /** How the value behaves between THIS keyframe and the next one on the same track. */
  readonly interpolation: GmlSequenceInterpolation;
}
/**
 * The real, cleanly-generalisable subset of a GameMaker Sequence track this
 * importer converts: a flat, numeric-valued track targeting one field of
 * the entity's own `Transform`/`Sprite` component. See
 * `gms2-sequence-import.ts`'s doc comment for exactly which GameMaker track
 * kinds map here and which ones (nested instance/group/graphic tracks,
 * sprite-frame tracks, colour tracks, embedded animation curves) are out of
 * scope and why.
 */
export type GmlSequenceTrackTarget =
  | "transform.x"
  | "transform.y"
  | "transform.scaleX"
  | "transform.scaleY"
  | "transform.rotation"
  | "sprite.alpha"
  | "sprite.tint";
export interface GmlSequenceTrack {
  readonly target: GmlSequenceTrackTarget;
  /** Ascending by `time` — `GmlSequenceSystem` does not re-sort on every sample. */
  readonly keyframes: readonly GmlSequenceKeyframe[];
}
/** The shape a generated `.sequence.ts` module's default export actually takes. */
export interface GmlSequenceData {
  /** Total length, in frames — GameMaker's own Sequence `length` field. */
  readonly length: number;
  readonly tracks: readonly GmlSequenceTrack[];
}
export declare function registerGmlSequence(
  sequenceId: string,
  data: GmlSequenceData,
): void;
export declare function getGmlSequence(
  sequenceId: string,
): GmlSequenceData | undefined;
export declare function unregisterGmlSequence(sequenceId: string): void;
