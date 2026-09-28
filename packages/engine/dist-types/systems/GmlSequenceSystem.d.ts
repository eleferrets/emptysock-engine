import type { Scene } from "../Scene.js";
/**
 * Real playback for GMS2-imported Sequences: advances each
 * `GmlSequenceState` entity's frame-based playhead and writes every track's
 * sampled value straight into the matching `Transform`/`Sprite` field. This
 * is a distinct system from the engine's own `SequenceSystem`
 * (`systems/SequenceSystem.ts`, the IDE SequenceEditor panel's runtime
 * counterpart — a `TweenManager`-driven playback of a hand-authored
 * `SequenceDefinition`): that system schedules real tweens against a plain
 * `Record<string, number>` target and has no ECS/entity concept at all,
 * while this one samples a GameMaker-imported keyframe track set directly
 * against a live `Entity`'s components every call — same "component holds
 * state, a system drives it, resample from scratch every call rather than
 * incremental tween bookkeeping" tradeoff, applied to the entity-oriented
 * shape a GMS2 import actually needs.
 *
 * GameMaker's real keyframe interpolation (manual.gamemaker.io's Sequences
 * reference, confirmed live for this pass): "Each keyframe stores a value
 * at a specific time. Between keyframes, GameMaker interpolates the value
 * (linear by default...)". This importer only ever emits `"linear"` or
 * `"step"` per-keyframe (see `gms2-sequence-import.ts`'s own doc comment for
 * why real GameMaker animation-curve keyframes — eased/custom curves — are
 * a documented, honestly-reported gap rather than a guessed approximation):
 * `"linear"` interpolates toward the *next* keyframe's value, `"step"` holds
 * this keyframe's value until the playhead reaches the next one outright
 * (GameMaker's own "None" interpolation mode).
 */
export declare class GmlSequenceSystem {
  /** Advances every playing `GmlSequenceState` entity's playhead by `dt` seconds and applies the sampled values. */
  update(scene: Scene, dt: number): void;
}
//# sourceMappingURL=GmlSequenceSystem.d.ts.map
