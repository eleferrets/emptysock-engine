import React from 'react';

interface EmitterConfig {
  emissionRate: number;
  speedMin: number;
  speedMax: number;
  lifetimeMin: number;
  lifetimeMax: number;
  gravity: number;
  scaleStart: number;
  scaleEnd: number;
  colorStart: string;
  colorEnd: string;
  shape: 'point' | 'circle' | 'rect';
  shapeRadius: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  scale: number; alpha: number;
  color: string;
}

const DEFAULT_CONFIG: EmitterConfig = {
  emissionRate: 30,
  speedMin: 80,
  speedMax: 150,
  lifetimeMin: 1.0,
  lifetimeMax: 2.5,
  gravity: 120,
  scaleStart: 1.0,
  scaleEnd: 0.0,
  colorStart: '#a78bfa',
  colorEnd: '#f87171',
  shape: 'point',
  shapeRadius: 20,
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function ParticleEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = React.useState<EmitterConfig>(DEFAULT_CONFIG);
  const particlesRef = React.useRef<Particle[]>([]);
  const lastTimeRef = React.useRef<number>(0);
  const accumRef = React.useRef<number>(0);
  const rafRef = React.useRef<number>(0);

  const spawn = (cfg: EmitterConfig): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
    let ox = 0, oy = 0;
    if (cfg.shape === 'circle') {
      ox = Math.cos(angle) * Math.random() * cfg.shapeRadius;
      oy = Math.sin(angle) * Math.random() * cfg.shapeRadius;
    } else if (cfg.shape === 'rect') {
      ox = (Math.random() - 0.5) * cfg.shapeRadius * 2;
      oy = (Math.random() - 0.5) * cfg.shapeRadius * 2;
    }
    const cx = 200, cy = 250;
    const lifetime = cfg.lifetimeMin + Math.random() * (cfg.lifetimeMax - cfg.lifetimeMin);
    return { x: cx + ox, y: cy + oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - speed * 0.5, life: lifetime, maxLife: lifetime, scale: cfg.scaleStart, alpha: 1, color: cfg.colorStart };
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (now: number): void => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      accumRef.current += dt;

      const interval = 1 / config.emissionRate;
      while (accumRef.current >= interval) {
        accumRef.current -= interval;
        particlesRef.current.push(spawn(config));
      }

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += config.gravity * dt;
        const t = 1 - p.life / p.maxLife;
        p.scale = config.scaleStart + (config.scaleEnd - config.scaleStart) * t;
        p.alpha = 1 - t * 0.5;
        p.color = lerpColor(config.colorStart, config.colorEnd, t);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        const r = 4 * p.scale;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [config]);

  const field = (label: string, key: keyof EmitterConfig, min: number, max: number, step = 1): React.ReactElement => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--text)' }}>{typeof config[key] === 'number' ? (config[key] as number).toFixed(step < 1 ? 2 : 0) : config[key]}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={config[key] as number}
        onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
        style={{ width: '100%' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}>
      <div style={{ width: 200, borderRight: '1px solid var(--border)', padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Emitter</div>
        {field('Emission Rate', 'emissionRate', 1, 200)}
        {field('Speed Min', 'speedMin', 0, 500)}
        {field('Speed Max', 'speedMax', 0, 500)}
        {field('Lifetime Min', 'lifetimeMin', 0.1, 10, 0.1)}
        {field('Lifetime Max', 'lifetimeMax', 0.1, 10, 0.1)}
        {field('Gravity', 'gravity', -500, 500)}
        {field('Scale Start', 'scaleStart', 0, 5, 0.1)}
        {field('Scale End', 'scaleEnd', 0, 5, 0.1)}
        {field('Shape Radius', 'shapeRadius', 0, 200)}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Shape</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['point', 'circle', 'rect'] as const).map(s => (
              <button key={s} onClick={() => setConfig(c => ({ ...c, shape: s }))}
                style={{ flex: 1, padding: '3px 0', background: config.shape === s ? 'var(--accent)' : 'var(--surface)', border: 'none', borderRadius: 4, color: 'var(--text)', cursor: 'pointer', fontSize: 11 }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Start Color</div>
            <input type="color" value={config.colorStart} onChange={e => setConfig(c => ({ ...c, colorStart: e.target.value }))} style={{ width: '100%', height: 28 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>End Color</div>
            <input type="color" value={config.colorEnd} onChange={e => setConfig(c => ({ ...c, colorEnd: e.target.value }))} style={{ width: '100%', height: 28 }} />
          </div>
        </div>
        <button onClick={() => { particlesRef.current = []; }}
          style={{ marginTop: 8, padding: '5px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}>Clear Particles</button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <canvas ref={canvasRef} width={400} height={500} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
