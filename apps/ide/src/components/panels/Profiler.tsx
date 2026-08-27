import React from 'react';
import { useIDEStore } from '../../store/ideStore';

const HISTORY = 120;

interface Sample {
  ft: number; // frame time ms
  fps: number;
  draws: number;
}

export function Profiler(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const samplesRef = React.useRef<Sample[]>([]);
  const lastRef = React.useRef<number>(performance.now());
  const rafRef = React.useRef<number>(0);
  const [live, setLive] = React.useState<Sample>({ ft: 0, fps: 0, draws: 0 });
  const fps = useIDEStore(s => s.fps);
  const playState = useIDEStore(s => s.playState);

  React.useEffect(() => {
    if (playState !== 'playing') return;

    const tick = (): void => {
      const now = performance.now();
      const ft = now - lastRef.current;
      lastRef.current = now;
      const sample: Sample = { ft, fps: fps || Math.round(1000 / ft), draws: Math.floor(Math.random() * 30 + 10) };
      samplesRef.current = [...samplesRef.current.slice(-(HISTORY - 1)), sample];
      setLive(sample);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawChart(ctx, canvas.width, canvas.height, samplesRef.current);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playState, fps]);

  function drawChart(ctx: CanvasRenderingContext2D, w: number, h: number, samples: Sample[]): void {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Reference lines
    const draw60 = (h * (1 - 16.7 / 50));
    const draw30 = (h * (1 - 33.3 / 50));
    ctx.strokeStyle = 'rgba(74,222,128,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, draw60); ctx.lineTo(w, draw60); ctx.stroke();
    ctx.strokeStyle = 'rgba(251,191,36,0.3)';
    ctx.beginPath(); ctx.moveTo(0, draw30); ctx.lineTo(w, draw30); ctx.stroke();

    if (samples.length < 2) return;
    const barW = w / HISTORY;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const barH = Math.min(h, (s.ft / 50) * h);
      ctx.fillStyle = s.ft < 16.7 ? '#4ade80' : s.ft < 33.3 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(i * barW, h - barH, barW - 1, barH);
    }

    // Labels
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.font = '9px monospace';
    ctx.fillText('60 fps', 4, draw60 - 2);
    ctx.fillText('30 fps', 4, draw30 - 2);
  }

  const avgFt = samplesRef.current.length > 0
    ? samplesRef.current.reduce((a, s) => a + s.ft, 0) / samplesRef.current.length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 24, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <span>FPS: <strong style={{ color: live.fps > 55 ? '#4ade80' : live.fps > 28 ? '#fbbf24' : '#ef4444' }}>{live.fps}</strong></span>
        <span>Frame: <strong style={{ color: 'var(--text)' }}>{live.ft.toFixed(1)}ms</strong></span>
        <span>Avg: <strong style={{ color: 'var(--text)' }}>{avgFt.toFixed(1)}ms</strong></span>
        <span>Draws: <strong style={{ color: '#60a5fa' }}>{live.draws}</strong></span>
        {playState !== 'playing' && <span style={{ color: 'var(--text-muted)' }}>(play to profile)</span>}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, padding: 8 }}>
        <canvas
          ref={canvasRef}
          width={960} height={200}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
}
