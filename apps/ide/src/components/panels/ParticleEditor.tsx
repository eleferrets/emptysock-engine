import React from "react";
import { useHistory } from "../../hooks/useHistory";
import {
  useParticleStore,
  DEFAULT_PARTICLE_OPTIONS,
} from "../../store/particleStore";
import {
  ParticleEmitter,
  type ParticleEmitterOptions,
  type EmitterShape,
} from "@emptysock/engine";

// The panel edits ParticleEmitterOptions directly — the exact shape
// `new ParticleEmitter(options)` accepts in code (see
// packages/engine/src/systems/ParticleSystem.ts). No ad hoc intermediate
// shape and no translation step: a config saved here is code-ready as-is.

function rgbToHexString(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexStringToNumber(s: string): number {
  return parseInt(s.slice(1), 16) || 0;
}

const SHAPES: EmitterShape[] = ["point", "circle", "rectangle", "line"];

export function ParticleEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasSizeRef = React.useRef({ w: 400, h: 500 });

  const storeOptions = useParticleStore((s) => s.particleOptions);
  const storeSetOptions = useParticleStore((s) => s.setParticleOptions);

  const {
    state: histOptions,
    set: commitToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ParticleEmitterOptions>(storeOptions);

  // Live options for fast slider updates; committed to history on release.
  const [liveOptions, setLiveOptions] =
    React.useState<ParticleEmitterOptions>(storeOptions);
  const liveOptionsRef = React.useRef<ParticleEmitterOptions>(storeOptions);

  const prevHistRef = React.useRef(histOptions);
  React.useEffect(() => {
    if (prevHistRef.current !== histOptions) {
      prevHistRef.current = histOptions;
      liveOptionsRef.current = histOptions;
      setLiveOptions(histOptions);
      storeSetOptions(histOptions);
    }
  }, [histOptions, storeSetOptions]);

  const setLive = React.useCallback((next: ParticleEmitterOptions) => {
    liveOptionsRef.current = next;
    setLiveOptions(next);
  }, []);

  const commit = React.useCallback(
    (next: ParticleEmitterOptions) => {
      liveOptionsRef.current = next;
      setLiveOptions(next);
      storeSetOptions(next);
      commitToHistory(next);
    },
    [storeSetOptions, commitToHistory],
  );

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

  const [spriteImg, setSpriteImg] = React.useState<HTMLImageElement | null>(
    null,
  );
  const spriteImgRef = React.useRef<HTMLImageElement | null>(null);
  React.useEffect(() => {
    spriteImgRef.current = spriteImg;
  }, [spriteImg]);

  // Real engine emitter drives the preview — no hand-rolled simulation.
  const emitterRef = React.useRef<ParticleEmitter>(
    new ParticleEmitter(storeOptions),
  );
  const rafRef = React.useRef<number>(0);
  const lastTimeRef = React.useRef<number>(0);

  // Rebuild the emitter whenever committed options change (shape changes,
  // maxParticles, etc. require a fresh instance; cheap since emitters are
  // lightweight pooled arrays).
  React.useEffect(() => {
    emitterRef.current = new ParticleEmitter(liveOptions);
    const { w, h } = canvasSizeRef.current;
    emitterRef.current.x = w / 2;
    emitterRef.current.y = h / 2;
  }, [liveOptions]);

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
      emitterRef.current.x = width / 2;
      emitterRef.current.y = height / 2;
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
      commit({ ...liveOptionsRef.current, texture: file.name });
    };
    img.src = url;
    e.target.value = "";
  };

  const clearSprite = (): void => {
    setSpriteImg(null);
    commit({ ...liveOptionsRef.current, texture: "" });
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number): void => {
      const dt = Math.min(
        lastTimeRef.current === 0 ? 0 : (now - lastTimeRef.current) / 1000,
        0.05,
      );
      lastTimeRef.current = now;

      emitterRef.current.update(dt);

      const dpr = window.devicePixelRatio || 1;
      const { w: lw, h: lh } = canvasSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, lw, lh);
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, lw, lh);

      const img = spriteImgRef.current;
      for (const p of emitterRef.current.getParticles()) {
        if (!p.active) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (img !== null) {
          const size = 24 * p.scale;
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
        } else {
          const r = 4 * p.scale;
          ctx.fillStyle = rgbToHexString(p.colour);
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
  }, []);

  const numField = (
    label: string,
    get: (o: ParticleEmitterOptions) => number,
    set: (o: ParticleEmitterOptions, v: number) => ParticleEmitterOptions,
    min: number,
    max: number,
    step = 1,
  ): React.ReactElement => {
    const value = get(liveOptions);
    return (
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
            {value.toFixed(step < 1 ? 2 : 0)}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            setLive(set(liveOptionsRef.current, Number(e.target.value)));
          }}
          onPointerUp={() => commit(liveOptionsRef.current)}
          style={{ width: "100%", accentColor: "var(--es-accent)" }}
        />
      </div>
    );
  };

  const gradient = liveOptions.colorGradient ??
    DEFAULT_PARTICLE_OPTIONS.colorGradient ?? [0xffffff];

  const setGradientStop = (index: number, hex: string): void => {
    const next = gradient.slice();
    next[index] = hexStringToNumber(hex);
    commit({ ...liveOptionsRef.current, colorGradient: next });
  };

  const addGradientStop = (): void => {
    const last = gradient[gradient.length - 1] ?? 0xffffff;
    commit({ ...liveOptionsRef.current, colorGradient: [...gradient, last] });
  };

  const removeGradientStop = (index: number): void => {
    if (gradient.length <= 1) return;
    const next = gradient.filter((_, i) => i !== index);
    commit({ ...liveOptionsRef.current, colorGradient: next });
  };

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
          width: 240,
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
            Texture
          </div>
          {liveOptions.texture ? (
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
                {liveOptions.texture}
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
            PNG, JPG, GIF, WebP accepted. Preview only — sets{" "}
            <code>options.texture</code>.
          </div>
        </div>

        {numField(
          "Emission Rate",
          (o) => o.emissionRate ?? 0,
          (o, v) => ({ ...o, emissionRate: v }),
          0,
          200,
        )}
        {numField(
          "Max Particles",
          (o) => o.maxParticles ?? 0,
          (o, v) => ({ ...o, maxParticles: v }),
          1,
          2000,
        )}
        {numField(
          "Lifetime Min",
          (o) => o.lifetime?.min ?? 0,
          (o, v) => ({ ...o, lifetime: { min: v, max: o.lifetime?.max ?? v } }),
          0.1,
          10,
          0.1,
        )}
        {numField(
          "Lifetime Max",
          (o) => o.lifetime?.max ?? 0,
          (o, v) => ({ ...o, lifetime: { min: o.lifetime?.min ?? v, max: v } }),
          0.1,
          10,
          0.1,
        )}
        {numField(
          "Velocity X Min",
          (o) => o.velocity?.x?.min ?? 0,
          (o, v) => ({
            ...o,
            velocity: {
              ...o.velocity,
              x: { min: v, max: o.velocity?.x?.max ?? v },
            },
          }),
          -500,
          500,
        )}
        {numField(
          "Velocity X Max",
          (o) => o.velocity?.x?.max ?? 0,
          (o, v) => ({
            ...o,
            velocity: {
              ...o.velocity,
              x: { min: o.velocity?.x?.min ?? v, max: v },
            },
          }),
          -500,
          500,
        )}
        {numField(
          "Velocity Y Min",
          (o) => o.velocity?.y?.min ?? 0,
          (o, v) => ({
            ...o,
            velocity: {
              ...o.velocity,
              y: { min: v, max: o.velocity?.y?.max ?? v },
            },
          }),
          -500,
          500,
        )}
        {numField(
          "Velocity Y Max",
          (o) => o.velocity?.y?.max ?? 0,
          (o, v) => ({
            ...o,
            velocity: {
              ...o.velocity,
              y: { min: o.velocity?.y?.min ?? v, max: v },
            },
          }),
          -500,
          500,
        )}
        {numField(
          "Acceleration X",
          (o) => o.acceleration?.x ?? 0,
          (o, v) => ({ ...o, acceleration: { ...o.acceleration, x: v } }),
          -500,
          500,
        )}
        {numField(
          "Acceleration Y (Gravity)",
          (o) => o.acceleration?.y ?? 0,
          (o, v) => ({ ...o, acceleration: { ...o.acceleration, y: v } }),
          -500,
          500,
        )}
        {numField(
          "Scale Start",
          (o) => o.startScale ?? 0,
          (o, v) => ({ ...o, startScale: v }),
          0,
          5,
          0.1,
        )}
        {numField(
          "Scale End",
          (o) => o.endScale ?? 0,
          (o, v) => ({ ...o, endScale: v }),
          0,
          5,
          0.1,
        )}
        {numField(
          "Alpha Start",
          (o) => o.startAlpha ?? 0,
          (o, v) => ({ ...o, startAlpha: v }),
          0,
          1,
          0.05,
        )}
        {numField(
          "Alpha End",
          (o) => o.endAlpha ?? 0,
          (o, v) => ({ ...o, endAlpha: v }),
          0,
          1,
          0.05,
        )}
        {numField(
          "Rotation Speed",
          (o) => o.rotationSpeed ?? 0,
          (o, v) => ({ ...o, rotationSpeed: v }),
          -20,
          20,
          0.1,
        )}

        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Shape
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {SHAPES.map((s) => (
              <button
                key={s}
                onClick={() => commit({ ...liveOptionsRef.current, shape: s })}
                style={{
                  flex: 1,
                  padding: "3px 0",
                  background:
                    liveOptions.shape === s
                      ? "var(--es-accent)"
                      : "var(--es-surface)",
                  border: "none",
                  borderRadius: 4,
                  color: "var(--es-text)",
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {liveOptions.shape === "circle" &&
          numField(
            "Shape Radius",
            (o) => o.shapeRadius ?? 0,
            (o, v) => ({ ...o, shapeRadius: v }),
            0,
            200,
          )}
        {(liveOptions.shape === "rectangle" || liveOptions.shape === "line") &&
          numField(
            "Shape Width",
            (o) => o.shapeWidth ?? 0,
            (o, v) => ({ ...o, shapeWidth: v }),
            0,
            400,
          )}
        {liveOptions.shape === "rectangle" &&
          numField(
            "Shape Height",
            (o) => o.shapeHeight ?? 0,
            (o, v) => ({ ...o, shapeHeight: v }),
            0,
            400,
          )}

        {!spriteImg && (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ color: "var(--es-text-muted)" }}>
                Colour Gradient
              </span>
              <button
                onClick={addGradientStop}
                title="Add stop"
                style={{
                  padding: "1px 6px",
                  background: "var(--es-surface)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-text)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                +
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {gradient.map((c, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="color"
                    value={rgbToHexString(c)}
                    onChange={(e) => setGradientStop(i, e.target.value)}
                    style={{ flex: 1, height: 24 }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--es-text-muted)",
                      width: 30,
                    }}
                  >
                    {gradient.length > 1
                      ? `${Math.round((i / (gradient.length - 1)) * 100)}%`
                      : "100%"}
                  </span>
                  {gradient.length > 1 && (
                    <button
                      onClick={() => removeGradientStop(i)}
                      style={{
                        padding: "1px 5px",
                        background: "none",
                        border: "1px solid var(--es-border)",
                        borderRadius: 4,
                        color: "var(--es-red)",
                        cursor: "pointer",
                        fontSize: 9,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            emitterRef.current.clear();
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
          This is the real <code>ParticleEmitterOptions</code> shape — copy it
          straight into <code>particleSystem.create(options)</code> in code.
        </div>
      </div>

      {/* Preview canvas — driven by a real ParticleEmitter instance */}
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
          {emitterRef.current.activeCount} particles
        </div>
      </div>
    </div>
  );
}
