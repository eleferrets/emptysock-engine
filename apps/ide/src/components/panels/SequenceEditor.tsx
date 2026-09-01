import React, { useRef, useState, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

type TrackType = 'Position X' | 'Position Y' | 'Rotation' | 'Scale' | 'Opacity' | 'Custom';

interface Keyframe {
  id: string;
  time: number; // seconds
}

interface Track {
  id: string;
  name: string;
  type: TrackType;
  keyframes: Keyframe[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const LABEL_WIDTH = 180;
const ROW_HEIGHT = 32;
const PX_PER_SEC = 120; // pixels per second at default zoom
const RULER_TICKS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]; // seconds

const TRACK_OPTIONS: TrackType[] = [
  'Position X',
  'Position Y',
  'Rotation',
  'Scale',
  'Opacity',
  'Custom',
];

const TYPE_COLORS: Record<TrackType, string> = {
  'Position X': '#2563eb',
  'Position Y': '#7c3aed',
  Rotation: '#dc2626',
  Scale: '#16a34a',
  Opacity: '#ca8a04',
  Custom: '#64748b',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string {
  return `id-${_idCounter++}`;
}

function makeTrack(type: TrackType, keyframes: number[] = []): Track {
  return {
    id: uid(),
    name: type,
    type,
    keyframes: keyframes.map(t => ({ id: uid(), time: t })),
  };
}

const DEFAULT_TRACKS: Track[] = [
  makeTrack('Position X', [0.5, 1.5, 3]),
  makeTrack('Position Y', [0, 1, 2]),
  makeTrack('Rotation', [0.5, 2]),
  makeTrack('Scale', [0, 1]),
  makeTrack('Opacity', [0, 0.5, 4]),
];

// ── Sub-components ──────────────────────────────────────────────────────────

const TrackLabel: React.FC<{ track: Track }> = ({ track }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: ROW_HEIGHT,
      paddingLeft: 8,
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: TYPE_COLORS[track.type],
        flexShrink: 0,
      }}
    />
    <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {track.name}
    </span>
    <span
      style={{
        fontSize: 10,
        background: TYPE_COLORS[track.type] + '33',
        color: TYPE_COLORS[track.type],
        borderRadius: 3,
        padding: '1px 4px',
        marginRight: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {track.type}
    </span>
  </div>
);

// ── Main Panel ──────────────────────────────────────────────────────────────

export function SequenceEditor(): React.ReactElement {
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(4);
  const [playheadX, setPlayheadX] = useState(0); // px from left of timeline area
  const timelineRef = useRef<HTMLDivElement>(null);
  const draggingPlayhead = useRef(false);

  // Add a keyframe to a track at a given time
  const addKeyframe = useCallback((trackId: string, time: number) => {
    setTracks(ts =>
      ts.map(t =>
        t.id === trackId
          ? { ...t, keyframes: [...t.keyframes, { id: uid(), time }] }
          : t,
      ),
    );
  }, []);

  // Click on timeline row → add keyframe at that x position
  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, trackId: string) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + (timelineRef.current.scrollLeft ?? 0);
      const time = Math.max(0, Math.min(duration, x / PX_PER_SEC));
      addKeyframe(trackId, parseFloat(time.toFixed(2)));
    },
    [addKeyframe, duration],
  );

  // Playhead drag
  const startPlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    draggingPlayhead.current = true;
    const onMove = (mv: MouseEvent): void => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, mv.clientX - rect.left + timelineRef.current.scrollLeft);
      setPlayheadX(x);
      setCurrentTime(parseFloat((x / PX_PER_SEC).toFixed(2)));
    };
    const onUp = (): void => {
      draggingPlayhead.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const addTrack = useCallback((type: TrackType) => {
    setTracks(ts => [...ts, makeTrack(type)]);
  }, []);

  const timelineWidth = Math.max(duration * PX_PER_SEC + 80, 400);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setPlaying(p => !p)}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: playing ? 'var(--accent)' : 'var(--surface)',
            color: playing ? '#fff' : 'var(--text)',
            cursor: 'pointer',
            fontSize: 12,
            minWidth: 52,
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          onClick={() => { setPlaying(false); setCurrentTime(0); setPlayheadX(0); }}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ⏹ Stop
        </button>

        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', minWidth: 52 }}>
          {currentTime.toFixed(2)}s
        </span>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Duration
          <input
            type="number"
            min={1}
            max={60}
            step={0.5}
            value={duration}
            onChange={e => setDuration(Math.max(1, parseFloat(e.target.value) || 4))}
            style={{
              width: 52,
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          s
        </label>

        <select
          defaultValue=""
          onChange={e => {
            if (e.target.value) addTrack(e.target.value as TrackType);
            e.target.value = '';
          }}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          <option value="" disabled>
            Add Track
          </option>
          {TRACK_OPTIONS.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track labels */}
        <div
          style={{
            width: LABEL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
          }}
        >
          {/* Header spacer to align with ruler */}
          <div style={{ height: 24, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }} />
          {tracks.map(t => (
            <TrackLabel key={t.id} track={t} />
          ))}
        </div>

        {/* Timeline */}
        <div
          ref={timelineRef}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ width: timelineWidth, position: 'relative' }}>
            {/* Ruler */}
            <div
              style={{
                height: 24,
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              {RULER_TICKS.filter(t => t <= duration + 0.1).map(t => (
                <div
                  key={t}
                  style={{
                    position: 'absolute',
                    left: t * PX_PER_SEC,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', paddingBottom: 2 }}>
                    {t}s
                  </span>
                  <div style={{ width: 1, height: 6, background: 'var(--border)' }} />
                </div>
              ))}
            </div>

            {/* Track rows */}
            {tracks.map(track => (
              <div
                key={track.id}
                onClick={e => handleRowClick(e, track.id)}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                  cursor: 'crosshair',
                  background: 'transparent',
                  userSelect: 'none',
                }}
              >
                {/* Keyframes */}
                {track.keyframes.map(kf => (
                  <div
                    key={kf.id}
                    title={`${kf.time}s`}
                    style={{
                      position: 'absolute',
                      left: kf.time * PX_PER_SEC,
                      top: '50%',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      width: 10,
                      height: 10,
                      background: TYPE_COLORS[track.type],
                      border: '1px solid rgba(255,255,255,0.4)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: playheadX,
                width: 2,
                height: '100%',
                background: '#ef4444',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              {/* Playhead handle */}
              <div
                onMouseDown={startPlayheadDrag}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -6,
                  width: 14,
                  height: 14,
                  background: '#ef4444',
                  borderRadius: 2,
                  cursor: 'ew-resize',
                  pointerEvents: 'all',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
