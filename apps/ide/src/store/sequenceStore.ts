import { create } from "zustand";
import type { EasingName } from "@emptysock/engine";

// ── Types ────────────────────────────────────────────────────────────────────

export type SequenceTrackType =
  "Position X" | "Position Y" | "Rotation" | "Scale" | "Opacity" | "Custom";

export interface SequenceKeyframe {
  id: string;
  time: number;
  value: number;
  textValue?: string; // string payload for dialogue, expression, and audio lane types
}

/**
 * The property key on a plain numeric target object each track type
 * animates — this is exactly `SequenceTrackDef.property` from
 * `packages/engine/src/systems/SequenceSystem.ts`. A track named
 * "Position X" therefore animates `target.x`, matching what a developer
 * would target with `tweens.to(target, { x: ... }, { ... })`.
 */
export const TRACK_TYPE_TO_PROPERTY: Record<SequenceTrackType, string> = {
  "Position X": "x",
  "Position Y": "y",
  Rotation: "rotation",
  Scale: "scale",
  Opacity: "opacity",
  Custom: "custom",
};

export interface SequenceTrack {
  id: string;
  name: string;
  type: SequenceTrackType;
  keyframes: SequenceKeyframe[];
  /** Easing applied to every segment of this track. Defaults to "linear". */
  ease?: EasingName;
}

// ── Initial data ─────────────────────────────────────────────────────────────

let _seqIdCounter = 0;
function _seqUid(): string {
  return `id-${_seqIdCounter++}`;
}
function _makeTrack(
  type: SequenceTrackType,
  kfs: Array<{ t: number; v: number }> = [],
): SequenceTrack {
  return {
    id: _seqUid(),
    name: type,
    type,
    keyframes: kfs.map(({ t, v }) => ({ id: _seqUid(), time: t, value: v })),
  };
}

const INITIAL_SEQUENCE_TRACKS: SequenceTrack[] = [
  _makeTrack("Position X", [
    { t: 0, v: 0 },
    { t: 1.5, v: 120 },
    { t: 3, v: 0 },
  ]),
  _makeTrack("Position Y", [
    { t: 0, v: 0 },
    { t: 1, v: -60 },
    { t: 2, v: 0 },
  ]),
  _makeTrack("Rotation", [
    { t: 0.5, v: 0 },
    { t: 2, v: 360 },
  ]),
  _makeTrack("Scale", [
    { t: 0, v: 1 },
    { t: 1, v: 1.5 },
  ]),
  _makeTrack("Opacity", [
    { t: 0, v: 0 },
    { t: 0.5, v: 1 },
    { t: 4, v: 1 },
  ]),
];

const INITIAL_SEQUENCE_DURATION = 4;

// ── State / actions ──────────────────────────────────────────────────────────

interface SequenceStoreState {
  sequenceTracks: SequenceTrack[];
  sequenceDuration: number;
  setSequenceTracks: (tracks: SequenceTrack[]) => void;
  setSequenceDuration: (duration: number) => void;
  resetSequenceStore: () => void;
}

export const useSequenceStore = create<SequenceStoreState>((set) => ({
  sequenceTracks: INITIAL_SEQUENCE_TRACKS,
  sequenceDuration: INITIAL_SEQUENCE_DURATION,

  setSequenceTracks: (tracks) => set({ sequenceTracks: tracks }),
  setSequenceDuration: (duration) => set({ sequenceDuration: duration }),

  resetSequenceStore: () => set({ sequenceTracks: [], sequenceDuration: 10 }),
}));
