import React from "react";
import MonacoEditor, { useMonaco, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { autoDetectRenderer, Sprite, Texture, type Renderer } from "pixi.js";
import {
  createCustomShaderFilter,
  type CustomShaderFilter,
} from "@emptysock/engine/ecs";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { useShaderStore, type ShaderState } from "../../store/shaderStore";

type ShaderType = "vertex" | "fragment";

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

  const storeShader = useShaderStore((s) => s.shader);
  const storeSetShader = useShaderStore((s) => s.setShader);

  const {
    state: shaderState,
    set: setHistoryShader,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<ShaderState>(storeShader);

  // Sync history → store, mirroring ParticleEditor's pattern so shader
  // edits survive the panel unmounting/remounting.
  const prevHistShaderRef = React.useRef(shaderState);
  React.useEffect(() => {
    if (shaderState !== prevHistShaderRef.current) {
      prevHistShaderRef.current = shaderState;
      storeSetShader(shaderState);
    }
  }, [shaderState, storeSetShader]);

  const setShaderState = React.useCallback(
    (next: ShaderState): void => {
      prevHistShaderRef.current = next;
      setHistoryShader(next);
      storeSetShader(next);
    },
    [setHistoryShader, storeSetShader],
  );

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
  const rendererRef = React.useRef<Renderer | null>(null);
  const spriteRef = React.useRef<Sprite | null>(null);
  const filterRef = React.useRef<CustomShaderFilter | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(Date.now());
  const runTokenRef = React.useRef(0);

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

  // Preview renders through the exact same `CustomShaderFilter` class
  // `RenderSystem.addLayerShaderFilter()` attaches in real game code (see
  // packages/engine/src/systems/CustomShaderFilter.ts). There is no separate
  // "preview" shader path that could drift from production behaviour —
  // errors shown here are PixiJS's own compile/link diagnostics, captured
  // from the console during the real compile.
  const runPreview = React.useCallback(
    (vSrc: string, fSrc: string): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const token = ++runTokenRef.current;

      let filter: CustomShaderFilter;
      try {
        filter = createCustomShaderFilter({
          vertexSrc: vSrc,
          fragmentSrc: fSrc,
        });
      } catch (err) {
        setCompileError(err instanceof Error ? err.message : String(err));
        return;
      }

      const captured: string[] = [];
      const origError = console.error;
      const origWarn = console.warn;
      console.error = (...args: unknown[]): void => {
        captured.push(args.map(String).join(" "));
      };
      console.warn = (...args: unknown[]): void => {
        captured.push(args.map(String).join(" "));
      };

      void (async () => {
        try {
          if (!rendererRef.current) {
            rendererRef.current = await autoDetectRenderer({
              canvas,
              width: canvas.width,
              height: canvas.height,
              backgroundColor: 0x000000,
              preference: "webgl",
            });
          }
          if (token !== runTokenRef.current) return; // superseded by a newer run
          const renderer = rendererRef.current;

          if (!spriteRef.current) {
            const sprite = new Sprite(Texture.WHITE);
            sprite.width = canvas.width;
            sprite.height = canvas.height;
            spriteRef.current = sprite;
          }
          spriteRef.current.filters = [filter];
          filterRef.current = filter;

          // First render triggers the real GL compile/link.
          renderer.render(spriteRef.current);

          console.error = origError;
          console.warn = origWarn;

          if (captured.length > 0) {
            setCompileError(captured.join("\n"));
            setCompiled(false);
            return;
          }

          setCompileError(null);
          setCompiled(true);
          addLog("info", "[ShaderEditor] Shader compiled OK");

          startRef.current = Date.now();
          const sprite = spriteRef.current;
          const tick = (): void => {
            if (token !== runTokenRef.current) return;
            const t = (Date.now() - startRef.current) / 1000;
            filter.setTime(t);
            renderer.render(sprite);
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch (err) {
          console.error = origError;
          console.warn = origWarn;
          setCompileError(err instanceof Error ? err.message : String(err));
          setCompiled(false);
        }
      })();
    },
    [addLog],
  );

  React.useEffect(() => {
    return () => {
      runTokenRef.current++;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.destroy();
      rendererRef.current = null;
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
            Available: <code>uTime</code> (seconds), <code>uTexture</code>{" "}
            (input texture), <code>aPosition</code>/<code>aUV</code> attributes,{" "}
            <code>uProjectionMatrix</code>/<code>uWorldTransformMatrix</code>/
            <code>uTransformMatrix</code>.
          </p>
          <p style={{ marginTop: 6 }}>
            To use in-game:{" "}
            <code>
              createCustomShaderFilter(&#123; vertexSrc, fragmentSrc &#125;)
            </code>
            , then{" "}
            <code>renderSystem.addLayerShaderFilter(layerName, filter)</code>.
            Call <code>filter.setTime(seconds)</code> once per frame if the
            shader reads <code>uTime</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
