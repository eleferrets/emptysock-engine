import {
  evaluateTrackAt,
  type SequenceDefinition,
  type SequenceTrackDef,
} from "@emptysock/engine/ecs";
import { TRACK_TYPE_TO_PROPERTY } from "../../../store/sequenceStore";
import type { TrackType, Keyframe, Track } from "./types";

// ── Counter ───────────────────────────────────────────────────────────────────

let _idCounter = 0;
export function uid(): string {
  return `id-${_idCounter++}`;
}

// ── Track factory ─────────────────────────────────────────────────────────────

export function makeTrack(
  type: TrackType,
  kfs: Array<{ t: number; v: number }> = [],
): Track {
  return {
    id: uid(),
    name: type,
    type,
    laneType: "keyframe",
    keyframes: kfs.map(({ t, v }) => ({ id: uid(), time: t, value: v })),
  };
}

// ── Keyframe interpolation ────────────────────────────────────────────────────
//
// Delegates to the engine's own `evaluateTrackAt()` (SequenceSystem.ts) so a
// value shown here — while scrubbing or reading a track's badge — always
// matches what `SequenceSystem.play()` produces by driving a real
// `TweenManager`, not a separately maintained linear-only formula.

export function interpolate(keyframes: Keyframe[], time: number): number {
  const track: SequenceTrackDef = {
    property: "value",
    keyframes: keyframes.map((k) => ({ time: k.time, value: k.value })),
  };
  return evaluateTrackAt(track, time);
}

// ── Panel Track[] → engine SequenceDefinition ──────────────────────────────────
//
// Only numeric "keyframe"-lane tracks feed playback — dialogue/expression/
// audio/wait lanes are timeline markers, not tween targets. The saved shape
// (property + keyframes + ease) is exactly `SequenceTrackDef`; no lossy
// translation happens here.

export function tracksToSequenceDefinition(
  tracks: Track[],
  duration: number,
): SequenceDefinition {
  const seqTracks: SequenceTrackDef[] = tracks
    .filter((t) => (t.laneType ?? "keyframe") === "keyframe")
    .map((t) => ({
      property: TRACK_TYPE_TO_PROPERTY[t.type],
      keyframes: t.keyframes.map((k) => ({ time: k.time, value: k.value })),
      ...(t.ease !== undefined ? { ease: t.ease } : {}),
    }));
  return { duration, tracks: seqTracks };
}

// ── Ruler label generator ─────────────────────────────────────────────────────

export function rulerTicks(
  duration: number,
  pxPerSec: number,
  _containerWidth: number,
): number[] {
  // Pick a tick interval so labels don't overlap (each label ~36px wide)
  const minPxBetween = 36;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  let interval = candidates.find((c) => c * pxPerSec >= minPxBetween) ?? 10;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + interval * 0.1; t += interval) {
    ticks.push(parseFloat(t.toFixed(4)));
  }
  return ticks;
}
