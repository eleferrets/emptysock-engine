import React from "react";
import type { LaneType } from "./types";

interface Props {
  laneType: LaneType;
  value: string;
  audioVol: number;
  onChangeValue: (v: string) => void;
  onChangeAudioVol: (v: number) => void;
  onCommit: () => void;
  onClose: () => void;
}

export function KfValueEditor({
  laneType,
  value,
  audioVol,
  onChangeValue,
  onChangeAudioVol,
  onCommit,
  onClose,
}: Props): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: laneType === "dialogue" ? "flex-start" : "center",
        gap: 6,
        padding: "4px 12px",
        borderBottom: "1px solid var(--es-border, #333)",
        background: "var(--es-surface, #16213e)",
        flexShrink: 0,
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: "var(--es-text-muted, #888)",
          paddingTop: laneType === "dialogue" ? 4 : 0,
        }}
      >
        Keyframe value:
      </span>
      {laneType === "dialogue" ? (
        <textarea
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              onCommit();
              onClose();
            }
          }}
          autoFocus
          rows={3}
          placeholder="Dialogue text…"
          style={{
            flex: 1,
            maxWidth: 400,
            padding: "4px 8px",
            borderRadius: 3,
            border: "1px solid var(--es-border, #444)",
            background: "var(--es-surface, #16213e)",
            color: "var(--es-text, #e2e8f0)",
            fontSize: 12,
            resize: "vertical",
            fontFamily: "inherit",
            minHeight: 32,
          }}
        />
      ) : laneType === "expression" ? (
        <>
          <input
            type="text"
            list="es-expression-list"
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
                onClose();
              }
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            placeholder="e.g. happy, sad, surprised"
            style={{
              width: 160,
              padding: "4px 8px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "var(--es-surface, #16213e)",
              color: "var(--es-text, #e2e8f0)",
              fontSize: 12,
              minHeight: 32,
            }}
          />
          <datalist id="es-expression-list">
            {[
              "neutral",
              "happy",
              "sad",
              "angry",
              "surprised",
              "embarrassed",
              "thoughtful",
              "determined",
            ].map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </>
      ) : laneType === "audio" ? (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
                onClose();
              }
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            placeholder="audio key, e.g. battle_bgm"
            style={{
              width: 140,
              padding: "4px 8px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "var(--es-surface, #16213e)",
              color: "var(--es-text, #e2e8f0)",
              fontSize: 12,
              minHeight: 32,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "var(--es-text-dim, #888)",
              flexShrink: 0,
            }}
          >
            vol
          </span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={audioVol}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChangeAudioVol(isNaN(v) ? 0 : v);
            }}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
                onClose();
              }
              if (e.key === "Escape") onClose();
            }}
            style={{
              width: 56,
              padding: "4px 4px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "var(--es-surface, #16213e)",
              color: "var(--es-text, #e2e8f0)",
              fontSize: 12,
              minHeight: 32,
            }}
          />
        </>
      ) : laneType === "wait" ? (
        <>
          <span
            style={{
              fontSize: 11,
              color: "var(--es-text-dim, #888)",
              flexShrink: 0,
            }}
          >
            Duration (s)
          </span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
                onClose();
              }
              if (e.key === "Escape") onClose();
            }}
            autoFocus
            style={{
              width: 80,
              padding: "4px 8px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "var(--es-surface, #16213e)",
              color: "var(--es-text, #e2e8f0)",
              fontSize: 12,
              minHeight: 32,
            }}
          />
        </>
      ) : (
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onCommit();
              onClose();
            }
            if (e.key === "Escape") onClose();
          }}
          autoFocus
          style={{
            width: 80,
            padding: "4px 8px",
            borderRadius: 3,
            border: "1px solid var(--es-border, #444)",
            background: "var(--es-surface, #16213e)",
            color: "var(--es-text, #e2e8f0)",
            fontSize: 12,
            minHeight: 32,
          }}
        />
      )}
      <button
        onClick={() => {
          onCommit();
          onClose();
        }}
        style={{
          padding: "2px 8px",
          borderRadius: 3,
          border: "1px solid var(--es-accent)",
          background: "var(--es-accent)",
          color: "var(--es-text-on-accent)",
          cursor: "pointer",
          fontSize: 11,
          alignSelf: laneType === "dialogue" ? "flex-end" : "auto",
        }}
      >
        OK
      </button>
      <button
        onClick={onClose}
        style={{
          padding: "2px 8px",
          borderRadius: 3,
          border: "1px solid var(--es-border, #444)",
          background: "transparent",
          color: "var(--es-text, #e2e8f0)",
          cursor: "pointer",
          fontSize: 11,
          alignSelf: laneType === "dialogue" ? "flex-end" : "auto",
        }}
      >
        ✕
      </button>
    </div>
  );
}
