import React from "react";
import { useHistory } from "../../hooks/useHistory";

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
  shape: "point" | "circle" | "rect";
  shapeRadius: number;
  rotationSpeed: number;
  alphaEnd: number;
  /** Name of the loaded sprite texture (display only; the canvas uses spriteImg). */
  textureName: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
  alpha: number;
  color: string;
  rotation: number;
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
  colorStart: "#a78bfa",
  colorEnd: "#f87171",
  shape: "point",
  shapeRadius: 20,
  rotationSpeed: 0,
  alphaEnd: 0,
  textureName: "",
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasSizeRef = React.useRef({ w: 400, h: 500 });
  const {
    state: config,
    set: setConfig,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<EmitterConfig>(DEFAULT_CONFIG);
  // Live state for controls (updates on every slider drag without committing to history)
  const [liveConfig, setLiveConfig] =
    React.useState<EmitterConfig>(DEFAULT_CONFIG);
  // Live ref for RAF loop (bypasses React re-renders during drag)
  const liveConfigRef = React.useRef<EmitterConfig>(DEFAULT_CONFIG);
  const [spriteImg, setSpriteImg] = React.useState<HTMLImageElement | null>(
    null,
  );

  // Keep liveConfig in sync with history config (on undo/redo)
  const prevConfigRef = React.useRef<EmitterConfig>(config);
  React.useEffect(() => {
    if (config !== prevConfigRef.current) {
      prevConfigRef.current = config;
      liveConfigRef.current = config;
    }
  }, [config]);

  // Keyboard undo/redo
  React.useEffect(() => {
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
  const particlesRef = React.useRef<Particle[]>([]);
  const lastTimeRef = React.useRef<number>(0);
  const accumRef = React.useRef<number>(0);
  const rafRef = React.useRef<number>(0);
  const spriteImgRef = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    spriteImgRef.current = spriteImg;
  }, [spriteImg]);

  // ResizeObserver: update physical canvas size and store logical dimensions
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvasSizeRef.current = { w: width, h: height };
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleSpriteUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = (): void => {
      setSpriteImg(img);
      const next = { ...liveConfigRef.current, textureName: file.name };
      setLiveConfig(next);
      liveConfigRef.current = next;
      prevConfigRef.current = next;
      setConfig(next);
    };
    img.src = url;
    e.target.value = "";
  };

  const clearSprite = (): void => {
    setSpriteImg(null);
    const next = { ...liveConfigRef.current, textureName: "" };
    setLiveConfig(next);
    liveConfigRef.current = next;
    prevConfigRef.current = next;
    setConfig(next);
  };

  const spawn = (cfg: EmitterConfig): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
    let ox = 0,
      oy = 0;
    if (cfg.shape === "circle") {
      ox = Math.cos(angle) * Math.random() * cfg.shapeRadius;
      oy = Math.sin(angle) * Math.random() * cfg.shapeRadius;
    } else if (cfg.shape === "rect") {
      ox = (Math.random() - 0.5) * cfg.shapeRadius * 2;
      oy = (Math.random() - 0.5) * cfg.shapeRadius * 2;
    }
    const cx = canvasSizeRef.current.w / 2,
      cy = canvasSizeRef.current.h / 2;
    const lifetime =
      cfg.lifetimeMin + Math.random() * (cfg.lifetimeMax - cfg.lifetimeMin);
    return {
      x: cx + ox,
      y: cy + oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - speed * 0.5,
      life: lifetime,
      maxLife: lifetime,
      scale: cfg.scaleStart,
      alpha: 1,
      color: cfg.colorStart,
      rotation: Math.random() * Math.PI * 2,
    };
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number): void => {
      const cfg = liveConfigRef.current;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      accumRef.current += dt;

      const interval = 1 / cfg.emissionRate;
      while (accumRef.current >= interval) {
        accumRef.current -= interval;
        particlesRef.current.push(spawn(cfg));
      }

      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += cfg.gravity * dt;
        p.rotation += cfg.rotationSpeed * dt;
        const t = 1 - p.life / p.maxLife;
        p.scale = cfg.scaleStart + (cfg.scaleEnd - cfg.scaleStart) * t;
        p.alpha = 1 - t * (1 - cfg.alphaEnd);
        p.color = lerpColor(cfg.colorStart, cfg.colorEnd, t);
      }

      const dpr = window.devicePixelRatio || 1;
      const { w: lw, h: lh } = canvasSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, lw, lh);
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, lw, lh);

      const img = spriteImgRef.current;
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (img !== null) {
          const size = 24 * p.scale;
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
        } else {
          const r = 4 * p.scale;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.5, r), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // Uses liveConfigRef so no deps needed

  const field = (
    label: string,
    key: keyof EmitterConfig,
    min: number,
    max: number,
    step = 1,
  ): React.ReactElement => (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span style={{ color: "var(--es-text-muted)" }}>{label}</span>
        <span style={{ color: "var(--es-text)" }}>
          {typeof liveConfig[key] === "number"
            ? (liveConfig[key] as number).toFixed(step < 1 ? 2 : 0)
            : liveConfig[key]}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={liveConfig[key] as number}
        onChange={(e) => {
          const next = { ...liveConfig, [key]: Number(e.target.value) };
          setLiveConfig(next);
          liveConfigRef.current = next;
        }}
        onPointerUp={() => {
          const next = liveConfigRef.current;
          prevConfigRef.current = next;
          setConfig(next);
        }}
        style={{ width: "100%", accentColor: "var(--es-accent)" }}
      />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
      }}
    >
      {/* Controls */}
      <div
        style={{
          width: 220,
          borderRight: "1px solid var(--es-border)",
          padding: 12,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ fontWeight: 600 }}>Emitter</span>
          <div style={{ display: "flex", gap: 2 }}>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              style={{
                padding: "2px 6px",
                background: "none",
                border: "none",
                color: "var(--es-text)",
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
                padding: "2px 6px",
                background: "none",
                border: "none",
                color: "var(--es-text)",
                cursor: canRedo ? "pointer" : "default",
                opacity: canRedo ? 1 : 0.4,
                fontSize: 14,
              }}
            >
              ↪
            </button>
          </div>
        </div>

        {/* Sprite texture */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              color: "var(--es-text-muted)",
              marginBottom: 4,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Sprite Texture
          </div>
          {liveConfig.textureName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  flex: 1,
                  fontSize: 10,
                  color: "var(--es-accent)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {liveConfig.textureName}
              </span>
              <button
                onClick={clearSprite}
                style={{
                  padding: "2px 6px",
                  background: "none",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-red)",
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <label
              style={{
                display: "block",
                padding: "5px 0",
                textAlign: "center",
                border: "1px dashed var(--es-border)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--es-text-muted)",
                fontSize: 11,
              }}
            >
              Upload image…
              <input
                type="file"
                accept="image/*"
                onChange={handleSpriteUpload}
                style={{ display: "none" }}
              />
            </label>
          )}
          <div
            style={{
              fontSize: 10,
              color: "var(--es-text-muted)",
              marginTop: 3,
            }}
          >
            PNG, JPG, GIF, WebP accepted
          </div>
        </div>

        {field("Emission Rate", "emissionRate", 1, 200)}
        {field("Speed Min", "speedMin", 0, 500)}
        {field("Speed Max", "speedMax", 0, 500)}
        {field("Lifetime Min", "lifetimeMin", 0.1, 10, 0.1)}
        {field("Lifetime Max", "lifetimeMax", 0.1, 10, 0.1)}
        {field("Gravity", "gravity", -500, 500)}
        {field("Scale Start", "scaleStart", 0, 5, 0.1)}
        {field("Scale End", "scaleEnd", 0, 5, 0.1)}
        {field("Alpha End", "alphaEnd", 0, 1, 0.05)}
        {field("Rotation Speed", "rotationSpeed", -20, 20, 0.1)}
        {field("Shape Radius", "shapeRadius", 0, 200)}

        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Shape
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["point", "circle", "rect"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  const next = { ...liveConfig, shape: s };
                  setLiveConfig(next);
                  liveConfigRef.current = next;
                  prevConfigRef.current = next;
                  setConfig(next);
                }}
                style={{
                  flex: 1,
                  padding: "3px 0",
                  background:
                    liveConfig.shape === s
                      ? "var(--es-accent)"
                      : "var(--es-surface)",
                  border: "none",
                  borderRadius: 4,
                  color: "var(--es-text)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {!spriteImg && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--es-text-muted)", marginBottom: 2 }}>
                Start Color
              </div>
              <input
                type="color"
                value={config.colorStart}
                onChange={(e) => {
                  const next = { ...liveConfig, colorStart: e.target.value };
                  setLiveConfig(next);
                  liveConfigRef.current = next;
                  prevConfigRef.current = next;
                  setConfig(next);
                }}
                style={{ width: "100%", height: 28 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--es-text-muted)", marginBottom: 2 }}>
                End Color
              </div>
              <input
                type="color"
                value={config.colorEnd}
                onChange={(e) => {
                  const next = { ...liveConfig, colorEnd: e.target.value };
                  setLiveConfig(next);
                  liveConfigRef.current = next;
                  prevConfigRef.current = next;
                  setConfig(next);
                }}
                style={{ width: "100%", height: 28 }}
              />
            </div>
          </div>
        )}

        <button
          onClick={() => {
            particlesRef.current = [];
          }}
          style={{
            marginTop: 8,
            padding: "5px 0",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
          }}
        >
          Clear Particles
        </button>

        <div
          style={{
            fontSize: 10,
            color: "var(--es-text-muted)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Use the <code>texture</code> property in <code>ParticleEmitter</code>{" "}
          options to reference your sprite at runtime.
        </div>
      </div>

      {/* Preview canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative" }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 10,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          {particlesRef.current.length} particles
        </div>
      </div>
    </div>
  );
}
