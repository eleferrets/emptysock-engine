import React, { useRef, useState, useCallback, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type TrackType = 'Position X' | 'Position Y' | 'Rotation' | 'Scale' | 'Opacity' | 'Custom';

interface Keyframe {
  id: string;
  time: number;  // seconds
  value: number; // numeric value for interpolation
}

interface Track {
  id: string;
  name: string;
  type: TrackType;
  keyframes: Keyframe[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_WIDTH = 200;
const ROW_HEIGHT = 34;
const RULER_H = 28;
const RAF_UI_INTERVAL = 1000 / 30; // ~30fps UI updates

const TRACK_OPTIONS: TrackType[] = ['Position X', 'Position Y', 'Rotation', 'Scale', 'Opacity', 'Custom'];

const TYPE_COLORS: Record<TrackType, string> = {
  'Position X': '#2563eb',
  'Position Y': '#7c3aed',
  Rotation:    '#dc2626',
  Scale:       '#16a34a',
  Opacity:     '#ca8a04',
  Custom:      '#64748b',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string { return `id-${_idCounter++}`; }

function makeTrack(type: TrackType, kfs: Array<{ t: number; v: number }> = []): Track {
  return {
    id: uid(), name: type, type,
    keyframes: kfs.map(({ t, v }) => ({ id: uid(), time: t, value: v })),
  };
}

const DEFAULT_TRACKS: Track[] = [
  makeTrack('Position X', [{ t: 0, v: 0 }, { t: 1.5, v: 120 }, { t: 3, v: 0 }]),
  makeTrack('Position Y', [{ t: 0, v: 0 }, { t: 1, v: -60 }, { t: 2, v: 0 }]),
  makeTrack('Rotation',   [{ t: 0.5, v: 0 }, { t: 2, v: 360 }]),
  makeTrack('Scale',      [{ t: 0, v: 1 }, { t: 1, v: 1.5 }]),
  makeTrack('Opacity',    [{ t: 0, v: 0 }, { t: 0.5, v: 1 }, { t: 4, v: 1 }]),
];

// ── Keyframe interpolation ────────────────────────────────────────────────────

function interpolate(keyframes: Keyframe[], time: number): number {
  if (keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time);
      return a.value + (b.value - a.value) * t;
    }
  }
  return 0;
}

// ── Ruler label generator ─────────────────────────────────────────────────────

function rulerTicks(duration: number, pxPerSec: number, containerWidth: number): number[] {
  // Pick a tick interval so labels don't overlap (each label ~36px wide)
  const minPxBetween = 36;
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  let interval = candidates.find(c => c * pxPerSec >= minPxBetween) ?? 10;
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
}> = ({ track, playing, currentTime }) => {
  const interp = playing ? interpolate(track.keyframes, currentTime) : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: ROW_HEIGHT, paddingLeft: 8,
      borderBottom: '1px solid var(--border, #333)', flexShrink: 0,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: TYPE_COLORS[track.type], flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, color: 'var(--text, #e2e8f0)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {track.name}
      </span>
      {interp !== null && (
        <span style={{
          fontSize: 10, fontFamily: 'monospace',
          background: TYPE_COLORS[track.type] + '33',
          color: TYPE_COLORS[track.type],
          borderRadius: 3, padding: '1px 5px', marginRight: 4, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {interp.toFixed(1)}
        </span>
      )}
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export function SequenceEditor(): React.ReactElement {
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(4);
  const [selectedKf, setSelectedKf] = useState<{ trackId: string; kfId: string } | null>(null);
  const [kfEditValue, setKfEditValue] = useState('');

  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0); // stays in sync for RAF
  const playingRef = useRef<boolean>(false);

  // Keep refs in sync
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // ── Compute pxPerSec dynamically ──────────────────────────────────────────

  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
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
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    stopRAF();
    setPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, [stopRAF]);

  // ── Ruler click → scrub ──────────────────────────────────────────────────

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const t = Math.max(0, Math.min(duration, x / pxPerSec));
    const rounded = parseFloat(t.toFixed(2));
    setCurrentTime(rounded);
    currentTimeRef.current = rounded;
  }, [duration, pxPerSec]);

  // ── Track row click → add keyframe ───────────────────────────────────────

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>, trackId: string) => {
    if ((e.target as HTMLElement).closest('[data-kf]')) return; // clicked a keyframe
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = Math.max(0, Math.min(duration, x / pxPerSec));
    const t = parseFloat(time.toFixed(2));
    setTracks(ts =>
      ts.map(track =>
        track.id === trackId
          ? { ...track, keyframes: [...track.keyframes, { id: uid(), time: t, value: 0 }] }
          : track,
      ),
    );
  }, [duration, pxPerSec]);

  // ── Keyframe selection + value edit ──────────────────────────────────────

  const selectKeyframe = useCallback((e: React.MouseEvent, trackId: string, kfId: string, value: number) => {
    e.stopPropagation();
    setSelectedKf({ trackId, kfId });
    setKfEditValue(String(value));
  }, []);

  const commitKfValue = useCallback(() => {
    if (!selectedKf) return;
    const v = parseFloat(kfEditValue);
    if (!isNaN(v)) {
      setTracks(ts => ts.map(track =>
        track.id === selectedKf.trackId
          ? { ...track, keyframes: track.keyframes.map(kf => kf.id === selectedKf.kfId ? { ...kf, value: v } : kf) }
          : track,
      ));
    }
  }, [selectedKf, kfEditValue]);

  // ── Add track ─────────────────────────────────────────────────────────────

  const addTrack = useCallback((type: TrackType) => {
    setTracks(ts => [...ts, makeTrack(type)]);
  }, []);

  // ── Ticks for ruler ──────────────────────────────────────────────────────

  const ticks = rulerTicks(duration, pxPerSec, containerWidth);

  // ── Playhead x position ───────────────────────────────────────────────────

  const playheadX = currentTime * pxPerSec;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg, #1a1a2e)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid var(--border, #333)',
        background: 'var(--surface, #16213e)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button onClick={togglePlay} style={{
          padding: '4px 12px', borderRadius: 4,
          border: `1px solid ${playing ? '#ef4444' : 'var(--border, #444)'}`,
          background: playing ? '#ef444422' : 'transparent',
          color: playing ? '#ef4444' : 'var(--text, #e2e8f0)',
          cursor: 'pointer', fontSize: 12, minWidth: 60,
        }}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        <button onClick={stop} style={{
          padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border, #444)',
          background: 'transparent', color: 'var(--text, #e2e8f0)', cursor: 'pointer', fontSize: 12,
        }}>
          ⏹ Stop
        </button>

        <span style={{ fontFamily: 'monospace', fontSize: 13, color: playing ? '#ef4444' : 'var(--text, #e2e8f0)', minWidth: 56 }}>
          {currentTime.toFixed(2)}s
        </span>

        <label style={{ fontSize: 12, color: 'var(--text-muted, #888)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Duration
          <input
            type="number" min={1} max={60} step={0.5} value={duration}
            onChange={e => setDuration(Math.max(1, parseFloat(e.target.value) || 4))}
            style={{
              width: 52, padding: '2px 4px', borderRadius: 3,
              border: '1px solid var(--border, #444)', background: 'var(--surface, #16213e)',
              color: 'var(--text, #e2e8f0)', fontSize: 12,
            }}
          />
          s
        </label>

        <select defaultValue="" onChange={e => { if (e.target.value) addTrack(e.target.value as TrackType); e.target.value = ''; }}
          style={{
            marginLeft: 'auto', padding: '4px 8px', borderRadius: 4,
            border: '1px solid var(--border, #444)', background: 'var(--surface, #16213e)',
            color: 'var(--text, #e2e8f0)', cursor: 'pointer', fontSize: 12,
          }}>
          <option value="" disabled>Add Track</option>
          {TRACK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Keyframe value editor popover */}
      {selectedKf && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderBottom: '1px solid var(--border, #333)',
          background: 'var(--surface, #16213e)', flexShrink: 0, fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-muted, #888)' }}>Keyframe value:</span>
          <input
            type="number" step="any" value={kfEditValue}
            onChange={e => setKfEditValue(e.target.value)}
            onBlur={commitKfValue}
            onKeyDown={e => { if (e.key === 'Enter') { commitKfValue(); setSelectedKf(null); } if (e.key === 'Escape') setSelectedKf(null); }}
            autoFocus
            style={{
              width: 80, padding: '2px 4px', borderRadius: 3,
              border: '1px solid var(--border, #444)', background: 'var(--surface, #16213e)',
              color: 'var(--text, #e2e8f0)', fontSize: 12,
            }}
          />
          <button onClick={() => { commitKfValue(); setSelectedKf(null); }} style={{
            padding: '2px 8px', borderRadius: 3, border: '1px solid #2563eb',
            background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 11,
          }}>OK</button>
          <button onClick={() => setSelectedKf(null)} style={{
            padding: '2px 8px', borderRadius: 3, border: '1px solid var(--border, #444)',
            background: 'transparent', color: 'var(--text, #e2e8f0)', cursor: 'pointer', fontSize: 11,
          }}>✕</button>
        </div>
      )}

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track labels column */}
        <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid var(--border, #333)', overflowY: 'auto' }}>
          <div style={{ height: RULER_H, borderBottom: '1px solid var(--border, #333)', background: 'var(--surface, #16213e)' }} />
          {tracks.map(t => (
            <TrackLabel key={t.id} track={t} playing={playing} currentTime={currentTime} />
          ))}
        </div>

        {/* Timeline scroll container */}
        <div ref={timelineRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
          <div ref={containerRef} style={{ width: timelineWidth, position: 'relative', minWidth: '100%' }}>
            {/* Ruler */}
            <div
              onClick={handleRulerClick}
              style={{
                height: RULER_H, borderBottom: '1px solid var(--border, #333)',
                background: 'var(--surface, #16213e)',
                position: 'sticky', top: 0, zIndex: 10,
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              {ticks.map(t => {
                const x = t * pxPerSec;
                return (
                  <div key={t} style={{ position: 'absolute', left: x, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted, #888)', paddingBottom: 3, whiteSpace: 'nowrap' }}>
                      {t % 1 === 0 ? `${t}s` : `${t}`}
                    </span>
                    <div style={{ width: 1, height: 6, background: 'var(--border, #555)' }} />
                  </div>
                );
              })}
            </div>

            {/* Track rows */}
            {tracks.map(track => (
              <div
                key={track.id}
                onClick={e => handleRowClick(e, track.id)}
                style={{
                  height: ROW_HEIGHT, borderBottom: '1px solid var(--border, #333)',
                  position: 'relative', cursor: 'crosshair',
                  background: 'transparent', userSelect: 'none',
                }}
              >
                {/* Grid lines */}
                {ticks.map(t => (
                  <div key={t} style={{
                    position: 'absolute', left: t * pxPerSec, top: 0,
                    width: 1, height: '100%', background: 'var(--border, #333)', opacity: 0.4,
                    pointerEvents: 'none',
                  }} />
                ))}

                {/* Keyframes */}
                {track.keyframes.map(kf => {
                  const isSelected = selectedKf?.trackId === track.id && selectedKf.kfId === kf.id;
                  return (
                    <div
                      key={kf.id}
                      data-kf="1"
                      title={`t=${kf.time}s  v=${kf.value}`}
                      onClick={e => selectKeyframe(e, track.id, kf.id, kf.value)}
                      style={{
                        position: 'absolute',
                        left: kf.time * pxPerSec,
                        top: '50%',
                        transform: 'translate(-50%, -50%) rotate(45deg)',
                        width: 10, height: 10,
                        background: isSelected ? '#fff' : TYPE_COLORS[track.type],
                        border: `2px solid ${isSelected ? TYPE_COLORS[track.type] : 'rgba(255,255,255,0.35)'}`,
                        cursor: 'pointer',
                        zIndex: 5,
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div style={{
              position: 'absolute', top: 0, left: playheadX,
              width: 2, height: '100%',
              background: '#ef4444', zIndex: 20, pointerEvents: 'none',
              boxShadow: '0 0 6px #ef4444',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: -5,
                width: 12, height: 12, background: '#ef4444',
                clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
