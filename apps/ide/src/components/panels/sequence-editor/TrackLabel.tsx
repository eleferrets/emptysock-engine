import React from "react";
import { ROW_HEIGHT, TYPE_COLORS, LANE_TYPE_OPTIONS } from "./types";
import type { Track, LaneType } from "./types";
import { interpolate } from "./helpers";

// ── Track label with interpolated value badge ─────────────────────────────────

export const TrackLabel: React.FC<{
  track: Track;
  playing: boolean;
  currentTime: number;
  onChangeLaneType: (lt: LaneType) => void;
}> = ({ track, playing, currentTime, onChangeLaneType }) => {
  const laneType = track.laneType ?? "keyframe";
  const interp = playing ? interpolate(track.keyframes, currentTime) : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: ROW_HEIGHT,
        paddingLeft: 8,
        paddingRight: 4,
        borderBottom: "1px solid var(--es-border, #333)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: TYPE_COLORS[track.type],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          color: "var(--es-text, #e2e8f0)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {track.name}
      </span>
      {laneType !== "keyframe" && (
        <span
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: "var(--es-text-muted, #888)",
            border: "1px solid var(--es-border, #444)",
            borderRadius: 3,
            padding: "0px 3px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          [{laneType}]
        </span>
      )}
      {interp !== null && laneType !== "dialogue" && (
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            background: `color-mix(in srgb, ${TYPE_COLORS[track.type]} 20%, transparent)`,
            color: TYPE_COLORS[track.type],
            borderRadius: 3,
            padding: "1px 5px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {interp.toFixed(1)}
        </span>
      )}
      <select
        value={laneType}
        onChange={(e) => onChangeLaneType(e.target.value as LaneType)}
        onClick={(e) => e.stopPropagation()}
        title="Lane type"
        style={{
          fontSize: 9,
          padding: "1px 2px",
          borderRadius: 3,
          border: "1px solid var(--es-border, #444)",
          background: "var(--es-surface, #16213e)",
          color: "var(--es-text-muted, #888)",
          cursor: "pointer",
          flexShrink: 0,
          maxWidth: 56,
        }}
      >
        {LANE_TYPE_OPTIONS.map((lt) => (
          <option key={lt} value={lt}>
            {lt}
          </option>
        ))}
      </select>
    </div>
  );
};
