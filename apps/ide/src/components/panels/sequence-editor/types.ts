import type { EasingName } from "@emptysock/engine";
import type {
  SequenceTrack,
  SequenceTrackType,
} from "../../../store/sequenceStore";

export type { EasingName };

// ── Types ─────────────────────────────────────────────────────────────────────

export type LaneType =
  "keyframe" | "dialogue" | "expression" | "audio" | "wait";

export type TrackType = SequenceTrackType;

export interface Keyframe {
  id: string;
  time: number; // seconds
  value: number; // numeric value for interpolation
  textValue?: string; // string value used when laneType === 'dialogue'
}

export type Track = SequenceTrack & {
  laneType?: LaneType;
  keyframes: Keyframe[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const LABEL_WIDTH = 200;
export const ROW_HEIGHT = 34;
export const RULER_H = 28;
export const RAF_UI_INTERVAL = 1000 / 30; // ~30fps UI updates

export const TRACK_OPTIONS: TrackType[] = [
  "Position X",
  "Position Y",
  "Rotation",
  "Scale",
  "Opacity",
  "Custom",
];

export const LANE_TYPE_OPTIONS: LaneType[] = [
  "keyframe",
  "dialogue",
  "expression",
  "audio",
  "wait",
];

/** Matches `EasingName` in packages/engine/src/core/easing.ts. */
export const EASE_OPTIONS: EasingName[] = [
  "linear",
  "sineIn",
  "sineOut",
  "sineInOut",
  "quadIn",
  "quadOut",
  "quadInOut",
  "cubicIn",
  "cubicOut",
  "cubicInOut",
  "bounceOut",
  "elasticOut",
];

export const TYPE_COLORS: Record<TrackType, string> = {
  "Position X": "var(--es-track-dialogue)",
  "Position Y": "var(--es-track-audio)",
  Rotation: "var(--es-track-animation)",
  Scale: "var(--es-track-script)",
  Opacity: "var(--es-track-wait)",
  Custom: "var(--es-track-default)",
};
