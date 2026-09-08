import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  useSequenceStore,
  type SequenceTrack,
  type SequenceTrackType,
} from "../../store/sequenceStore";
import { useHistory } from "../../hooks/useHistory";

// ── Types ────────────────────────────────────────────────────────────────────

type LaneType = 'keyframe' | 'dialogue' | 'expression' | 'audio' | 'wait';

type TrackType = SequenceTrackType;

interface Keyframe {
  id: string;
  time: number; // seconds
  value: number; // numeric value for interpolation
  textValue?: string; // string value used when laneType === 'dialogue'
}

type Track = SequenceTrack & { laneType?: LaneType; keyframes: Keyframe[] };

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_WIDTH = 200;
const ROW_HEIGHT = 34;
const RULER_H = 28;
const RAF_UI_INTERVAL = 1000 / 30; // ~30fps UI updates

const TRACK_OPTIONS: TrackType[] = [
  "Position X",
  "Position Y",
  "Rotation",
  "Scale",
  "Opacity",
  "Custom",
];

const LANE_TYPE_OPTIONS: LaneType[] = [
  'keyframe',
  'dialogue',
  'expression',
  'audio',
  'wait',
];

const TYPE_COLORS: Record<TrackType, string> = {
  "Position X": "#2563eb",
  "Position Y": "#7c3aed",
  Rotation: "#dc2626",
  Scale: "#16a34a",
  Opacity: "#ca8a04",
  Custom: "#64748b",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string {
  return `id-${_idCounter++}`;
}

function makeTrack(
  type: TrackType,
  kfs: Array<{ t: number; v: number }> = [],
): Track {
  return {
    id: uid(),
    name: type,
    type,
    laneType: 'keyframe',
    keyframes: kfs.map(({ t, v }) => ({ id: uid(), time: t, value: v })),
  };
}

// ── Keyframe interpolation ────────────────────────────────────────────────────

function interpolate(keyframes: Keyframe[], time: number): number {
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

function rulerTicks(
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

// ── Track label with interpolated value badge ─────────────────────────────────

const TrackLabel: React.FC<{
  track: Track;
  playing: boolean;
  currentTime: number;
  onChangeLaneType: (lt: LaneType) => void;
}> = ({ track, playing, currentTime, onChangeLaneType }) => {
  const laneType = track.laneType ?? 'keyframe';
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
      {laneType !== 'keyframe' && (
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
      {interp !== null && laneType !== 'dialogue' && (
        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            background: TYPE_COLORS[track.type] + "33",
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
          <option key={lt} value={lt}>{lt}</option>
        ))}
      </select>
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export function SequenceEditor(): React.ReactElement {
  const storeTracks = useSequenceStore((s) => s.sequenceTracks) as Track[];
  const setStoreTracks = useSequenceStore((s) => s.setSequenceTracks);
  const duration = useSequenceStore((s) => s.sequenceDuration);
  const setDuration = useSequenceStore((s) => s.setSequenceDuration);

  // Shadow history state
  const {
    state: tracks,
    set: setHistoryTracks,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Track[]>(storeTracks);
  const prevTracksRef = useRef<Track[]>(tracks);

  // Sync history → store (only on undo/redo, detected by reference change)
  useEffect(() => {
    if (tracks !== prevTracksRef.current) {
      prevTracksRef.current = tracks;
      setStoreTracks(tracks);
    }
  }, [tracks, setStoreTracks]);

  const setTracks = useCallback(
    (next: Track[]): void => {
      prevTracksRef.current = next;
      setHistoryTracks(next);
      setStoreTracks(next);
    },
    [setHistoryTracks, setStoreTracks],
  );

  // Keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Snapshot before keyframe drag
  const dragStartTracksRef = useRef<Track[]>(tracks);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedKf, setSelectedKf] = useState<{
    trackId: string;
    kfId: string;
  } | null>(null);
  const [kfEditValue, setKfEditValue] = useState("");
  const [audioVol, setAudioVol] = useState<number>(1);

  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0); // stays in sync for RAF
  const playingRef = useRef<boolean>(false);

  const [draggingKf, setDraggingKf] = useState<{
    trackId: string;
    kfId: string;
    pointerId: number;
    startClientX: number;
    startTime: number;
    moved: boolean;
  } | null>(null);
  const containerDivRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // ── Compute pxPerSec dynamically ──────────────────────────────────────────

  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 600;
      setContainerWidth(w);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // px per second: fill container with a small minimum
  const pxPerSec = Math.max(80, (containerWidth - 40) / Math.max(duration, 1));
  const timelineWidth = duration * pxPerSec + 80;

  // ── RAF playback loop ─────────────────────────────────────────────────────

  const startRAF = useCallback(() => {
    lastTimestampRef.current = performance.now();
    lastUIUpdateRef.current = performance.now();

    function loop(ts: number) {
      if (!playingRef.current) return;
      const dt = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;
      currentTimeRef.current = Math.min(currentTimeRef.current + dt, duration);

      // Throttle React state updates to ~30fps
      if (ts - lastUIUpdateRef.current >= RAF_UI_INTERVAL) {
        lastUIUpdateRef.current = ts;
        setCurrentTime(currentTimeRef.current);
      }

      if (currentTimeRef.current >= duration) {
        setPlaying(false);
        setCurrentTime(duration);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [duration]);

  const stopRAF = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      stopRAF();
      setPlaying(false);
    } else {
      if (currentTimeRef.current >= duration) {
        currentTimeRef.current = 0;
        setCurrentTime(0);
      }
      setPlaying(true);
      // startRAF is called via the effect below
    }
  }, [playing, duration, stopRAF]);

  // When playing flips to true, start RAF
  useEffect(() => {
    if (playing) {
      startRAF();
    } else {
      stopRAF();
    }
    return () => stopRAF();
  }, [playing]); // startRAF and stopRAF are stable refs — intentionally omitted

  const stop = useCallback(() => {
    stopRAF();
    setPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, [stopRAF]);

  // ── Ruler click → scrub ──────────────────────────────────────────────────

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const t = Math.max(0, Math.min(duration, x / pxPerSec));
      const rounded = parseFloat(t.toFixed(2));
      setCurrentTime(rounded);
      currentTimeRef.current = rounded;
    },
    [duration, pxPerSec],
  );

  // ── Track row click → add keyframe ───────────────────────────────────────

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, trackId: string) => {
      if ((e.target as HTMLElement).closest("[data-kf]")) return; // clicked a keyframe
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const time = Math.max(0, Math.min(duration, x / pxPerSec));
      const t = parseFloat(time.toFixed(2));
      setTracks(
        tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                keyframes: [
                  ...track.keyframes,
                  { id: uid(), time: t, value: 0 },
                ],
              }
            : track,
        ),
      );
    },
    [duration, pxPerSec, tracks, setTracks],
  );

  // ── Lane type change ─────────────────────────────────────────────────────

  const changeTrackLaneType = useCallback(
    (trackId: string, lt: LaneType): void => {
      setTracks(tracks.map((t) => (t.id === trackId ? { ...t, laneType: lt } : t)));
    },
    [tracks, setTracks],
  );

  // ── Keyframe selection + value edit ──────────────────────────────────────

  const commitKfValue = useCallback(() => {
    if (!selectedKf) return;
    const track = tracks.find((t) => t.id === selectedKf.trackId);
    if (!track) return;
    const laneType = track.laneType ?? 'keyframe';
    if (laneType === 'dialogue' || laneType === 'expression') {
      setTracks(
        tracks.map((tr) =>
          tr.id === selectedKf.trackId
            ? {
                ...tr,
                keyframes: tr.keyframes.map((kf) =>
                  kf.id === selectedKf.kfId
                    ? { ...kf, textValue: kfEditValue }
                    : kf,
                ),
              }
            : tr,
        ),
      );
    } else if (laneType === 'audio') {
      const clampedVol = isNaN(audioVol) ? 1 : Math.min(1, Math.max(0, audioVol));
      setTracks(
        tracks.map((tr) =>
          tr.id === selectedKf.trackId
            ? {
                ...tr,
                keyframes: tr.keyframes.map((kf) =>
                  kf.id === selectedKf.kfId
                    ? { ...kf, textValue: kfEditValue, value: clampedVol }
                    : kf,
                ),
              }
            : tr,
        ),
      );
    } else {
      const v = parseFloat(kfEditValue);
      if (!isNaN(v)) {
        setTracks(
          tracks.map((tr) =>
            tr.id === selectedKf.trackId
              ? {
                  ...tr,
                  keyframes: tr.keyframes.map((kf) =>
                    kf.id === selectedKf.kfId ? { ...kf, value: v } : kf,
                  ),
                }
              : tr,
          ),
        );
      }
    }
  }, [selectedKf, kfEditValue, audioVol, tracks, setTracks]);

  // ── Keyframe delete ──────────────────────────────────────────────────────

  const removeKeyframe = useCallback(
    (trackId: string, kfId: string) => {
      setTracks(
        tracks.map((t) =>
          t.id === trackId
            ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== kfId) }
            : t,
        ),
      );
      setSelectedKf((prev) =>
        prev?.trackId === trackId && prev.kfId === kfId ? null : prev,
      );
    },
    [tracks, setTracks],
  );

  // ── Keyframe drag handlers ───────────────────────────────────────────────

  const handleKfPointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      trackId: string,
      kfId: string,
      kfTime: number,
      kfValue: number,
    ) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartTracksRef.current = tracks;
      setDraggingKf({
        trackId,
        kfId,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startTime: kfTime,
        moved: false,
      });
      // pre-select so value editor is ready if user doesn't drag
      setSelectedKf({ trackId, kfId });
      const track = tracks.find((t) => t.id === trackId);
      const laneType = track?.laneType ?? 'keyframe';
      if (laneType === 'dialogue' || laneType === 'expression' || laneType === 'audio') {
        const kf = track?.keyframes.find((k) => k.id === kfId);
        setKfEditValue(kf?.textValue ?? '');
        if (laneType === 'audio') {
          setAudioVol(kf?.value ?? 1);
        }
      } else {
        setKfEditValue(String(kfValue));
      }
    },
    [tracks],
  );

  const handleKfPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, trackId: string, kfId: string) => {
      if (draggingKf === null) return;
      if (draggingKf.trackId !== trackId || draggingKf.kfId !== kfId) return;
      const dx = e.clientX - draggingKf.startClientX;
      if (!draggingKf.moved && Math.abs(dx) < 4) return;
      const newTime = Math.max(
        0,
        Math.min(duration, draggingKf.startTime + dx / pxPerSec),
      );
      const t = parseFloat(newTime.toFixed(2));
      setDraggingKf((prev) => (prev ? { ...prev, moved: true } : prev));
      // Live update store only (no history entry during drag)
      const next = tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              keyframes: track.keyframes.map((kf) =>
                kf.id === kfId ? { ...kf, time: t } : kf,
              ),
            }
          : track,
      );
      prevTracksRef.current = next;
      setStoreTracks(next);
    },
    [draggingKf, duration, pxPerSec, tracks, setStoreTracks],
  );

  const handleKfPointerUp = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      trackId: string,
      kfId: string,
      kfValue: number,
    ) => {
      if (draggingKf === null) return;
      if (draggingKf.trackId !== trackId || draggingKf.kfId !== kfId) return;
      if (draggingKf.moved) {
        // Use the live store value via ref to compute final state
        const finalTracks = storeTracks;
        prevTracksRef.current = finalTracks;
        setHistoryTracks(finalTracks);
      } else {
        // treat as click — selection already set in pointerdown
        const track = tracks.find((t) => t.id === trackId);
        const laneType = track?.laneType ?? 'keyframe';
        if (laneType === 'dialogue' || laneType === 'expression' || laneType === 'audio') {
          const kf = track?.keyframes.find((k) => k.id === kfId);
          setKfEditValue(kf?.textValue ?? '');
          if (laneType === 'audio') {
            setAudioVol(kf?.value ?? 1);
          }
        } else {
          setKfEditValue(String(kfValue));
        }
      }
      setDraggingKf(null);
    },
    [draggingKf, tracks, storeTracks, setHistoryTracks],
  );

  // ── Keyboard delete of selected keyframe ─────────────────────────────────

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedKf) {
        e.preventDefault();
        removeKeyframe(selectedKf.trackId, selectedKf.kfId);
      }
    },
    [selectedKf, removeKeyframe],
  );

  // ── Add track ─────────────────────────────────────────────────────────────

  const addTrack = useCallback(
    (type: TrackType) => {
      setTracks([...tracks, makeTrack(type)]);
    },
    [tracks, setTracks],
  );

  // ── Ticks for ruler ──────────────────────────────────────────────────────

  const ticks = rulerTicks(duration, pxPerSec, containerWidth);

  // ── Playhead x position ───────────────────────────────────────────────────

  const playheadX = currentTime * pxPerSec;

  // ── Selected track laneType (for value editor) ────────────────────────────

  const selectedTrack = selectedKf
    ? tracks.find((t) => t.id === selectedKf.trackId)
    : undefined;
  const selectedLaneType: LaneType = selectedTrack?.laneType ?? 'keyframe';

  return (
    <div
      ref={containerDivRef}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg, #1a1a2e)",
        overflow: "hidden",
        outline: "none",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderBottom: "1px solid var(--es-border, #333)",
          background: "var(--es-surface, #16213e)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: `1px solid ${playing ? "#ef4444" : "var(--es-border, #444)"}`,
            background: playing ? "#ef444422" : "transparent",
            color: playing ? "#ef4444" : "var(--es-text, #e2e8f0)",
            cursor: "pointer",
            fontSize: 12,
            minWidth: 60,
          }}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <button
          onClick={stop}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid var(--es-border, #444)",
            background: "transparent",
            color: "var(--es-text, #e2e8f0)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ⏹ Stop
        </button>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            color: playing ? "#ef4444" : "var(--es-text, #e2e8f0)",
            minWidth: 56,
          }}
        >
          {currentTime.toFixed(2)}s
        </span>

        <label
          style={{
            fontSize: 12,
            color: "var(--es-text-muted, #888)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Duration
          <input
            type="number"
            min={1}
            max={60}
            step={0.5}
            value={duration}
            onChange={(e) =>
              setDuration(Math.max(1, parseFloat(e.target.value) || 4))
            }
            style={{
              width: 52,
              padding: "2px 4px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "var(--es-surface, #16213e)",
              color: "var(--es-text, #e2e8f0)",
              fontSize: 12,
            }}
          />
          s
        </label>

        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--es-border, #444)",
            background: "transparent",
            color: "var(--es-text, #e2e8f0)",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.4,
            fontSize: 14,
          }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--es-border, #444)",
            background: "transparent",
            color: "var(--es-text, #e2e8f0)",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.4,
            fontSize: 14,
          }}
        >
          ↪
        </button>

        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) addTrack(e.target.value as TrackType);
            e.target.value = "";
          }}
          style={{
            marginLeft: "auto",
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid var(--es-border, #444)",
            background: "var(--es-surface, #16213e)",
            color: "var(--es-text, #e2e8f0)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          <option value="" disabled>
            Add Track
          </option>
          {TRACK_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Keyframe value editor popover */}
      {selectedKf && (
        <div
          style={{
            display: "flex",
            alignItems: selectedLaneType === 'dialogue' ? "flex-start" : "center",
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
              paddingTop: selectedLaneType === 'dialogue' ? 4 : 0,
            }}
          >
            Keyframe value:
          </span>
          {selectedLaneType === 'dialogue' ? (
            <textarea
              value={kfEditValue}
              onChange={(e) => setKfEditValue(e.target.value)}
              onBlur={commitKfValue}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSelectedKf(null);
                // Ctrl+Enter commits
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  commitKfValue();
                  setSelectedKf(null);
                }
              }}
              autoFocus
              rows={3}
              placeholder="Dialogue text…"
              style={{
                flex: 1,
                maxWidth: 400,
                padding: "3px 6px",
                borderRadius: 3,
                border: "1px solid var(--es-border, #444)",
                background: "var(--es-surface, #16213e)",
                color: "var(--es-text, #e2e8f0)",
                fontSize: 12,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <input
              type="number"
              step="any"
              value={kfEditValue}
              onChange={(e) => setKfEditValue(e.target.value)}
              onBlur={commitKfValue}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitKfValue();
                  setSelectedKf(null);
                }
                if (e.key === "Escape") setSelectedKf(null);
              }}
              autoFocus
              style={{
                width: 80,
                padding: "2px 4px",
                borderRadius: 3,
                border: "1px solid var(--es-border, #444)",
                background: "var(--es-surface, #16213e)",
                color: "var(--es-text, #e2e8f0)",
                fontSize: 12,
              }}
            />
          )}
          <button
            onClick={() => {
              commitKfValue();
              setSelectedKf(null);
            }}
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: 11,
              alignSelf: selectedLaneType === 'dialogue' ? "flex-end" : "auto",
            }}
          >
            OK
          </button>
          <button
            onClick={() => setSelectedKf(null)}
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              border: "1px solid var(--es-border, #444)",
              background: "transparent",
              color: "var(--es-text, #e2e8f0)",
              cursor: "pointer",
              fontSize: 11,
              alignSelf: selectedLaneType === 'dialogue' ? "flex-end" : "auto",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Editor body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Track labels column */}
        <div
          style={{
            width: LABEL_WIDTH,
            flexShrink: 0,
            borderRight: "1px solid var(--es-border, #333)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              height: RULER_H,
              borderBottom: "1px solid var(--es-border, #333)",
              background: "var(--es-surface, #16213e)",
            }}
          />
          {tracks.map((t) => (
            <TrackLabel
              key={t.id}
              track={t}
              playing={playing}
              currentTime={currentTime}
              onChangeLaneType={(lt) => changeTrackLaneType(t.id, lt)}
            />
          ))}
        </div>

        {/* Timeline scroll container */}
        <div
          ref={timelineRef}
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "auto",
            position: "relative",
          }}
        >
          <div
            ref={containerRef}
            style={{
              width: timelineWidth,
              position: "relative",
              minWidth: "100%",
            }}
          >
            {/* Ruler */}
            <div
              onClick={handleRulerClick}
              style={{
                height: RULER_H,
                borderBottom: "1px solid var(--es-border, #333)",
                background: "var(--es-surface, #16213e)",
                position: "sticky",
                top: 0,
                zIndex: 10,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              {ticks.map((t) => {
                const x = t * pxPerSec;
                return (
                  <div
                    key={t}
                    style={{
                      position: "absolute",
                      left: x,
                      bottom: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--es-text-muted, #888)",
                        paddingBottom: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t % 1 === 0 ? `${t}s` : `${t}`}
                    </span>
                    <div
                      style={{
                        width: 1,
                        height: 6,
                        background: "var(--es-border, #555)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Track rows */}
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={(e) => handleRowClick(e, track.id)}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid var(--es-border, #333)",
                  position: "relative",
                  cursor: "crosshair",
                  background: "transparent",
                  userSelect: "none",
                }}
              >
                {/* Grid lines */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    style={{
                      position: "absolute",
                      left: t * pxPerSec,
                      top: 0,
                      width: 1,
                      height: "100%",
                      background: "var(--es-border, #333)",
                      opacity: 0.4,
                      pointerEvents: "none",
                    }}
                  />
                ))}

                {/* Keyframes */}
                {track.keyframes.map((kf) => {
                  const isSelected =
                    selectedKf?.trackId === track.id &&
                    selectedKf.kfId === kf.id;
                  const laneType = track.laneType ?? 'keyframe';
                  const titleText = laneType === 'dialogue'
                    ? `t=${kf.time}s  "${kf.textValue ?? ''}"`
                    : `t=${kf.time}s  v=${kf.value}`;
                  return (
                    <div
                      key={kf.id}
                      data-kf="1"
                      title={titleText}
                      onPointerDown={(e) =>
                        handleKfPointerDown(
                          e,
                          track.id,
                          kf.id,
                          kf.time,
                          kf.value,
                        )
                      }
                      onPointerMove={(e) =>
                        handleKfPointerMove(e, track.id, kf.id)
                      }
                      onPointerUp={(e) =>
                        handleKfPointerUp(e, track.id, kf.id, kf.value)
                      }
                      style={{
                        position: "absolute",
                        left: kf.time * pxPerSec,
                        top: "50%",
                        transform: "translate(-50%, -50%) rotate(45deg)",
                        width: 10,
                        height: 10,
                        background: isSelected
                          ? "#fff"
                          : TYPE_COLORS[track.type],
                        border: `2px solid ${isSelected ? TYPE_COLORS[track.type] : "rgba(255,255,255,0.35)"}`,
                        cursor:
                          draggingKf?.kfId === kf.id ? "grabbing" : "grab",
                        zIndex: 5,
                        touchAction: "none",
                      }}
                    >
                      {isSelected && (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeKeyframe(track.id, kf.id);
                          }}
                          style={{
                            position: "absolute",
                            top: -12,
                            left: "50%",
                            transform: "translateX(-50%) rotate(-45deg)",
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#ef4444",
                            color: "#fff",
                            fontSize: 9,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            zIndex: 10,
                            lineHeight: 1,
                          }}
                        >
                          \xD7
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: playheadX,
                width: 2,
                height: "100%",
                background: "#ef4444",
                zIndex: 20,
                pointerEvents: "none",
                boxShadow: "0 0 6px #ef4444",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: -5,
                  width: 12,
                  height: 12,
                  background: "#ef4444",
                  clipPath: "polygon(50% 100%, 0 0, 100% 0)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
