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

export function interpolate(keyframes: Keyframe[], time: number): number {
  if (keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a === undefined || b === undefined) continue;
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * t;
    }
  }
  return 0;
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
