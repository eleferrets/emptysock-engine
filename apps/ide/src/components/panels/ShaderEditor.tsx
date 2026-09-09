import React from "react";
import MonacoEditor, { useMonaco, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
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

const GLSL_KEYWORDS = [
  "void",
  "float",
  "int",
  "uint",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "ivec2",
  "ivec3",
  "ivec4",
  "uvec2",
  "uvec3",
  "uvec4",
  "bvec2",
  "bvec3",
  "bvec4",
  "mat2",
  "mat3",
  "mat4",
  "mat2x2",
  "mat2x3",
  "mat2x4",
  "mat3x2",
  "mat3x3",
  "mat3x4",
  "mat4x2",
  "mat4x3",
  "mat4x4",
  "sampler2D",
  "samplerCube",
  "sampler3D",
  "sampler2DShadow",
  "uniform",
  "attribute",
  "varying",
  "const",
  "in",
  "out",
  "inout",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "break",
  "continue",
  "discard",
  "precision",
  "highp",
  "mediump",
  "lowp",
  "struct",
  "layout",
];

const GLSL_BUILTINS = [
  "gl_Position",
  "gl_FragColor",
  "gl_FragCoord",
  "gl_PointSize",
  "gl_FrontFacing",
  "gl_PointCoord",
  "gl_FragDepth",
  "texture2D",
  "texture",
  "textureCube",
  "mix",
  "clamp",
  "smoothstep",
  "step",
  "dot",
  "cross",
  "normalize",
  "length",
  "distance",
  "reflect",
  "refract",
  "pow",
  "sqrt",
  "abs",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "floor",
  "ceil",
  "fract",
  "mod",
  "min",
  "max",
  "sign",
  "radians",
  "degrees",
  "inversesqrt",
  "exp",
  "exp2",
  "log",
  "log2",
  "dFdx",
  "dFdy",
  "fwidth",
];

function registerGlsl(monaco: typeof Monaco): void {
  if (monaco.languages.getLanguages().some((l) => l.id === "glsl")) return;
  monaco.languages.register({ id: "glsl" });
  monaco.languages.setMonarchTokensProvider("glsl", {
    keywords: GLSL_KEYWORDS,
    builtins: GLSL_BUILTINS,
    tokenizer: {
      root: [
        [
          /#\s*(version|define|ifdef|ifndef|endif|else|elif|pragma|extension|include)\b/,
          "keyword.control",
        ],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@builtins": "support.function",
              "@default": "identifier",
            },
          },
        ],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/\d+\.\d*([eE][+-]?\d+)?[fF]?/, "number.float"],
        [/\d+[uU]?/, "number"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  } as Monaco.languages.IMonarchLanguage);
  monaco.languages.registerCompletionItemProvider("glsl", {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = [
        ...GLSL_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        })),
        ...GLSL_BUILTINS.map((fn) => ({
          label: fn,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: fn,
          range,
        })),
      ];
      return { suggestions };
    },
  });
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

  const monaco = useMonaco();
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const { theme } = useIDEStore();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  const monacoTheme = isDark ? "vs-dark" : "vs";

  // Register GLSL language once Monaco is available
  React.useEffect(() => {
    if (monaco) registerGlsl(monaco);
  }, [monaco]);

  // Keyboard undo/redo — skip when Monaco editor has focus
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (document.activeElement?.closest(".monaco-editor")) return;
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

  // Sync Monaco content when switching tabs or after undo/redo
  const prevActiveRef = React.useRef(activeShader);
  const prevShaderStateRef = React.useRef(shaderState);
  React.useEffect(() => {
    if (
      shaderState !== prevShaderStateRef.current ||
      activeShader !== prevActiveRef.current
    ) {
      prevShaderStateRef.current = shaderState;
      prevActiveRef.current = activeShader;
      const newSrc =
        activeShader === "vertex" ? shaderState.vertSrc : shaderState.fragSrc;
      editorRef.current?.setValue(newSrc);
    }
  }, [shaderState, activeShader]);

  const commitSrc = (value: string): void => {
    if (activeShader === "vertex") {
      setShaderState({ vertSrc: value, fragSrc });
    } else {
      setShaderState({ vertSrc, fragSrc: value });
    }
  };

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidBlurEditorText(() => {
      commitSrc(editor.getValue());
    });
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

  const runPreview = React.useCallback(
    (vSrc: string, fSrc: string): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext("webgl");
      if (!gl) {
        setCompileError("WebGL not available in this environment.");
        return;
      }
      glRef.current = gl;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      const vert = compileShader(gl, gl.VERTEX_SHADER, vSrc);
      const frag = compileShader(gl, gl.FRAGMENT_SHADER, fSrc);
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
    },
    [addLog],
  );

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
              const editorVal = editorRef.current?.getValue();
              const vs =
                activeShader === "vertex" ? (editorVal ?? vertSrc) : vertSrc;
              const fs =
                activeShader === "fragment" ? (editorVal ?? fragSrc) : fragSrc;
              commitSrc(
                editorVal ?? (activeShader === "vertex" ? vertSrc : fragSrc),
              );
              runPreview(vs, fs);
            }}
            style={{
              margin: "4px 8px",
              padding: "0 12px",
              background: "var(--es-accent)",
              color: "var(--es-text-on-accent)",
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

        {/* Monaco GLSL editor */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MonacoEditor
            language="glsl"
            theme={monacoTheme}
            defaultValue={activeShader === "vertex" ? vertSrc : fragSrc}
            onMount={handleEditorMount}
            options={{
              fontSize: 12,
              fontFamily:
                '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              lineHeight: 1.6,
              tabSize: 2,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              overviewRulerBorder: false,
              renderLineHighlight: "gutter",
              smoothScrolling: true,
              wordWrap: "on",
            }}
          />
        </div>

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
