import type { Scene } from "../Scene.js";
import type { Entity } from "../Entity.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import {
  GmlSequenceState,
  getGmlSequence,
  type GmlSequenceTrack,
  type GmlSequenceTrackTarget,
} from "../components/GmlSequence.js";

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
export class GmlSequenceSystem {
  /** Advances every playing `GmlSequenceState` entity's playhead by `dt` seconds and applies the sampled values. */
  update(scene: Scene, dt: number): void {
    scene.each(GmlSequenceState, (state, entity) => {
      if (!state.playing) return;
      const data = getGmlSequence(state.sequenceId);
      if (data === undefined) return;

      let position = state.position + state.speed * dt;
      if (position > data.length) {
        if (state.loop) {
          position = data.length > 0 ? position % data.length : 0;
        } else {
          position = data.length;
          state.playing = false;
        }
      }
      state.position = position;

      for (const track of data.tracks) {
        const value = sampleTrack(track, position);
        if (value === undefined) continue;
        applyTrackValue(entity, track.target, value);
      }
    });
  }
}

function sampleTrack(
  track: GmlSequenceTrack,
  time: number,
): number | undefined {
  const keyframes = track.keyframes;
  if (keyframes.length === 0) return undefined;
  const first = keyframes[0];
  if (first === undefined) return undefined;
  if (keyframes.length === 1 || time <= first.time) return first.value;
  const last = keyframes[keyframes.length - 1];
  if (last !== undefined && time >= last.time) return last.value;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];
    if (current === undefined || next === undefined) continue;
    if (time >= current.time && time <= next.time) {
      if (current.interpolation === "step") return current.value;
      const span = next.time - current.time;
      const t = span === 0 ? 0 : (time - current.time) / span;
      return current.value + (next.value - current.value) * t;
    }
  }
  return last?.value;
}

function applyTrackValue(
  entity: Entity,
  target: GmlSequenceTrackTarget,
  value: number,
): void {
  if (target.startsWith("transform.")) {
    const transform = entity.get(Transform);
    if (transform === undefined) return;
    switch (target) {
      case "transform.x":
        transform.x = value;
        break;
      case "transform.y":
        transform.y = value;
        break;
      case "transform.scaleX":
        transform.scaleX = value;
        break;
      case "transform.scaleY":
        transform.scaleY = value;
        break;
      case "transform.rotation":
        transform.rotation = value;
        break;
    }
    return;
  }

  const sprite = entity.get(Sprite);
  if (sprite === undefined) return;
  switch (target) {
    case "sprite.alpha":
      sprite.alpha = value;
      break;
    case "sprite.tint":
      sprite.tint = value;
      break;
  }
}
