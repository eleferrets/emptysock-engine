import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";

const VERTEX_PLACEHOLDER = `attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
varying vec2 vTextureCoord;

void main(void) {
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}`;

const FRAGMENT_PLACEHOLDER = `precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;

void main(void) {
  vec2 uv = vTextureCoord;
  // Example: chromatic aberration
  float offset = 0.003 * sin(uTime * 2.0);
  float r = texture2D(uSampler, uv + vec2(offset, 0.0)).r;
  float g = texture2D(uSampler, uv).g;
  float b = texture2D(uSampler, uv - vec2(offset, 0.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}`;

type ShaderType = "vertex" | "fragment";

interface ShaderState {
  vertSrc: string;
  fragSrc: string;
}

export function ShaderEditor(): React.ReactElement {
  const [activeShader, setActiveShader] =
    React.useState<ShaderType>("fragment");
  const {
    state: shaderState,
    set: setShaderState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ShaderState>({
    vertSrc: VERTEX_PLACEHOLDER,
    fragSrc: FRAGMENT_PLACEHOLDER,
  });
  const vertSrc = shaderState.vertSrc;
  const fragSrc = shaderState.fragSrc;
  const [compileError, setCompileError] = React.useState<string | null>(null);
  const [compiled, setCompiled] = React.useState(false);

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
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const glRef = React.useRef<WebGLRenderingContext | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(Date.now());

  const addLog = useIDEStore((s) => s.addLog);

  const src = activeShader === "vertex" ? vertSrc : fragSrc;
  const [liveSrc, setLiveSrc] = React.useState(src);
  // Keep liveSrc in sync when switching tabs or undoing
  const prevActiveRef = React.useRef(activeShader);
  const prevShaderStateRef = React.useRef(shaderState);
  React.useEffect(() => {
    if (
      shaderState !== prevShaderStateRef.current ||
      activeShader !== prevActiveRef.current
    ) {
      prevShaderStateRef.current = shaderState;
      prevActiveRef.current = activeShader;
      setLiveSrc(
        activeShader === "vertex" ? shaderState.vertSrc : shaderState.fragSrc,
      );
    }
  }, [shaderState, activeShader]);
  const commitSrc = (value: string): void => {
    if (activeShader === "vertex") {
      setShaderState({ vertSrc: value, fragSrc });
    } else {
      setShaderState({ vertSrc, fragSrc: value });
    }
  };

  const compileShader = (
    gl: WebGLRenderingContext,
    type: number,
    source: string,
  ): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? "Unknown compile error";
      gl.deleteShader(shader);
      setCompileError(info);
      return null;
    }
    return shader;
  };

  const runPreview = React.useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      setCompileError("WebGL not available in this environment.");
      return;
    }
    glRef.current = gl;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setCompileError(gl.getProgramInfoLog(prog) ?? "Link failed");
      return;
    }

    setCompileError(null);
    setCompiled(true);
    addLog("info", "[ShaderEditor] Shader compiled OK");

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(prog, "aVertexPosition");
    const uvLoc = gl.getAttribLocation(prog, "aTextureCoord");
    const projLoc = gl.getUniformLocation(prog, "projectionMatrix");
    const timeLoc = gl.getUniformLocation(prog, "uTime");

    gl.useProgram(prog);
    if (projLoc !== null) {
      gl.uniformMatrix3fv(projLoc, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    if (uvLoc >= 0) {
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    }

    const tick = (): void => {
      if (!glRef.current) return;
      const t = (Date.now() - startRef.current) / 1000;
      if (timeLoc !== null) gl.uniform1f(timeLoc, t);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(tick);
    };
    startRef.current = Date.now();
    tick();
  }, [vertSrc, fragSrc, addLog]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      glRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      {/* Editor column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--es-border)",
          minWidth: 0,
        }}
      >
        {/* Shader tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--es-border)",
            flexShrink: 0,
          }}
        >
          {(["vertex", "fragment"] as ShaderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveShader(t)}
              style={{
                padding: "6px 14px",
                background:
                  activeShader === t ? "var(--es-surface)" : "transparent",
                border: "none",
                borderBottom:
                  activeShader === t
                    ? "2px solid var(--es-accent)"
                    : "2px solid transparent",
                color:
                  activeShader === t
                    ? "var(--es-text)"
                    : "var(--es-text-muted)",
                cursor: "pointer",
                fontSize: 12,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              margin: "4px 2px",
              padding: "0 8px",
              background: "transparent",
              color: "var(--es-text)",
              border: "none",
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
              margin: "4px 2px",
              padding: "0 8px",
              background: "transparent",
              color: "var(--es-text)",
              border: "none",
              cursor: canRedo ? "pointer" : "default",
              opacity: canRedo ? 1 : 0.4,
              fontSize: 14,
            }}
          >
            ↪
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              commitSrc(liveSrc);
              runPreview();
            }}
            style={{
              margin: "4px 8px",
              padding: "0 12px",
              background: "var(--es-accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ▶ Compile & Run
          </button>
        </div>

        {/* Source textarea */}
        <textarea
          value={liveSrc}
          onChange={(e) => setLiveSrc(e.target.value)}
          onBlur={(e) => commitSrc(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            resize: "none",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            border: "none",
            outline: "none",
            padding: "12px",
            fontFamily:
              '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
            fontSize: 12,
            lineHeight: 1.6,
            tabSize: 2,
          }}
        />

        {/* Error bar */}
        {compileError !== null && (
          <div
            style={{
              background: "color-mix(in srgb, var(--es-red) 12%, transparent)",
              borderTop:
                "1px solid color-mix(in srgb, var(--es-red) 30%, transparent)",
              color: "var(--es-red)",
              padding: "6px 12px",
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              maxHeight: 80,
              overflow: "auto",
              flexShrink: 0,
            }}
          >
            {compileError}
          </div>
        )}
        {compiled && compileError === null && (
          <div
            style={{
              background:
                "color-mix(in srgb, var(--es-green) 10%, transparent)",
              borderTop:
                "1px solid color-mix(in srgb, var(--es-green) 25%, transparent)",
              color: "var(--es-green)",
              padding: "4px 12px",
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            ✓ Compiled OK
          </div>
        )}
      </div>

      {/* Preview column */}
      <div
        style={{
          width: 320,
          display: "flex",
          flexDirection: "column",
          background: "var(--es-surface)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--es-border)",
            color: "var(--es-text-muted)",
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          Preview
        </div>
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          style={{
            display: "block",
            background: "#000",
            width: "100%",
            aspectRatio: "4/3",
          }}
        />
        <div
          style={{
            padding: "10px",
            color: "var(--es-text-muted)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <p>
            Write GLSL vertex and fragment shaders. Click{" "}
            <strong style={{ color: "var(--es-text)" }}>
              Compile &amp; Run
            </strong>{" "}
            to see a live preview on the quad above.
          </p>
          <p style={{ marginTop: 6 }}>
            Available uniforms: <code>uTime</code> (seconds),{" "}
            <code>uSampler</code> (texture), <code>projectionMatrix</code>.
          </p>
          <p style={{ marginTop: 6 }}>
            To use in-game, pass the GLSL source to{" "}
            <code>RenderSystem.addShaderFilter()</code> and attach it to an
            entity.
          </p>
        </div>
      </div>
    </div>
  );
}
