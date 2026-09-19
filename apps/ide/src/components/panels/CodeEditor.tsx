import React from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { X } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { gameBuildService } from "../../services/GameBuildService";
import { loadSettings } from "../../services/SettingsService";
import type { IDESettings } from "../../services/SettingsService";
import { TauriFileService } from "../../services/TauriFileService";
import {
  setupMonaco,
  registerEditorActions,
} from "../../services/MonacoSetupService";

interface Snippet {
  label: string;
  body: string;
}

const SNIPPETS: Snippet[] = [
  {
    label: "Scene skeleton",
    body: `import { Scene, type SceneConfig } from '@emptysock/engine'\n\nexport class GameScene extends Scene {\n  static readonly config: SceneConfig = { renderMode: '2d', gameSpeed: 60 }\n\n  override async onLoad(): Promise<void> {\n    // load assets and build entities here\n  }\n\n  override onUpdate(dt: number): void {\n    // called every frame; dt = seconds since last frame\n  }\n\n  override onDestroy(): void {\n    // clean up timers, remove listeners\n  }\n}`,
  },
  {
    label: "Entity + Sprite",
    body: `const e = this.createEntity('Player')\ne.addComponent(Sprite, { texture: 'assets/hero.png', anchor: { x: 0.5, y: 1.0 } })\ne.addComponent(PhysicsBody, { shape: 'capsule', bodyType: 'dynamic' })`,
  },
  {
    label: "Camera follow",
    body: `private _camera = new CameraSystem()\n\n// in onLoad:\nthis._camera.attach(this.stage)\nthis._camera.setFollow(() => player.position)\nthis._camera.setLerpFactor(0.08)\nthis._camera.setBounds({ minX: 0, minY: 0, maxX: 3200, maxY: 900 })\n\n// in onUpdate:\nthis._camera.update(dt)\n\n// in onDestroy:\nthis._camera.destroy()`,
  },
  {
    label: "Timer once",
    body: `private _tweens = new TweenManager()\n\n// in onLoad:\nthis._tweens.after(2.0, () => { /* runs once after 2 s */ })\n\n// in onUpdate:\nthis._tweens.update(dt)\n\n// in onDestroy:\nthis._tweens.destroy()`,
  },
  {
    label: "Coroutine",
    body: `entity.startCoroutine(function* () {\n  yield waitSeconds(1.5)\n  yield waitUntil(() => player.isGrounded())\n  // continues here after both conditions\n})`,
  },
  {
    label: "Save / load",
    body: `import { SaveSystem } from '@emptysock/engine'\nimport { z } from 'zod'\n\nconst Schema = z.object({ score: z.number(), level: z.number() })\ntype Data = z.infer<typeof Schema>\n\nconst _save = new SaveSystem()\n\nfunction save(data: Data): void {\n  _save.save('slot-1', data)\n}\n\nfunction load(): Data | null {\n  const slot = _save.load('slot-1')\n  if (slot === null) return null\n  return Schema.parse(slot.data)\n}`,
  },
  {
    label: "Actor receive",
    body: `import { Actor, type Message } from '@emptysock/engine'\n\nclass EnemyActor extends Actor {\n  receive(msg: Message): void {\n    if (msg.type === 'take_damage') {\n      const dmg = (msg.payload as { amount: number }).amount\n      // handle damage\n    }\n  }\n}`,
  },
  {
    label: "Physics collision",
    body: `entity.onCollisionEnter((other, contact) => {\n  if (other.hasTag('hazard')) {\n    // handle collision\n  }\n})\n\nentity.onSensorEnter((other) => {\n  if (other.hasTag('player')) {\n    // handle sensor overlap\n  }\n})`,
  },
];

interface SnippetPanelPos {
  top: number;
  left: number;
}

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 600);
  React.useEffect(() => {
    const handler = (): void => setNarrow(window.innerWidth < 600);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return narrow;
}

function useVirtualKeyboardPadding(): number {
  const [padding, setPadding] = React.useState(0);
  React.useEffect(() => {
    if (typeof window.visualViewport === "undefined") return;
    const vv = window.visualViewport;
    if (vv === null) return;
    const handler = (): void => {
      const keyboardHeight = window.innerHeight - vv.height;
      setPadding(keyboardHeight > 0 ? keyboardHeight : 0);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);
  return padding;
}

export function CodeEditor(): React.ReactElement {
  const {
    editorCode,
    setEditorCode,
    activeFilePath,
    openFiles,
    openFile,
    closeFile,
    buildMode,
    setBuildStatus,
    addLog,
    theme,
  } = useIDEStore();
  const isNarrow = useIsNarrow();
  const keyboardPadding = useVirtualKeyboardPadding();
  const [settings] = React.useState<IDESettings>(() => loadSettings());
  const [showSnippets, setShowSnippets] = React.useState(false);
  const [snippetPos, setSnippetPos] = React.useState<SnippetPanelPos | null>(
    null,
  );
  const [snippetSearch, setSnippetSearch] = React.useState("");
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = React.useRef<typeof Monaco | null>(null);
  const snippetPanelRef = React.useRef<HTMLDivElement>(null);
  const snippetSearchRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const openSnippetPalette = React.useCallback(
    (anchorToToolbar: boolean): void => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const container = containerRef.current;
      if (container === null) {
        setSnippetPos(null);
        setShowSnippets(true);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      if (!anchorToToolbar && editor !== null && monaco !== null) {
        const pos = editor.getPosition();
        if (pos !== null) {
          const pixelPos = editor.getScrolledVisiblePosition(pos);
          if (pixelPos !== null) {
            // editor DOM sits below the 33px tab bar
            const editorTop = 33;
            setSnippetPos({
              top: editorTop + pixelPos.top + 20,
              left: Math.min(pixelPos.left, containerRect.width - 268),
            });
            setSnippetSearch("");
            setShowSnippets(true);
            return;
          }
        }
      }
      // fallback: anchor to top-right toolbar button
      setSnippetPos(null);
      setSnippetSearch("");
      setShowSnippets(true);
    },
    [],
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // One-time Monaco setup: engine types, resource language, hover providers.
    void setupMonaco(monaco);

    // Per-editor actions: snippet palette + open-resource context menu.
    editor.addAction({
      id: "emptysock.insertSnippet",
      label: "Insert Snippet",
      contextMenuGroupId: "9_cutcopypaste",
      contextMenuOrder: 1.5,
      run: () => {
        openSnippetPalette(false);
      },
    });

    registerEditorActions(editor, monaco, (path) => {
      openFile(path, "");
    });
  };

  const insertSnippet = (body: string): void => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (editor === null || monaco === null) return;
    editor.focus();
    const selection = editor.getSelection();
    const range = selection ?? new monaco.Range(1, 1, 1, 1);
    editor.executeEdits("snippet", [{ range, text: body }]);
  };

  // close on click-outside
  React.useEffect(() => {
    if (!showSnippets) return;
    const handleMouseDown = (e: MouseEvent): void => {
      if (
        snippetPanelRef.current !== null &&
        !snippetPanelRef.current.contains(e.target as Node)
      ) {
        setShowSnippets(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showSnippets]);

  // focus search input when panel opens
  React.useEffect(() => {
    if (showSnippets) {
      setTimeout(() => snippetSearchRef.current?.focus(), 0);
    }
  }, [showSnippets]);

  const [systemDark, setSystemDark] = React.useState<boolean>(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent): void => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  const monacoTheme = isDark ? "vs-dark" : "vs";

  const tabPaths = Object.keys(openFiles);

  const triggerBuild = React.useCallback(
    (code: string, immediate: boolean): void => {
      const allFiles = useIDEStore.getState().openFiles;
      if (immediate) {
        setBuildStatus("building");
        addLog("info", "Building…", "BuildService");
        void gameBuildService
          .buildNow({ code, mode: buildMode, virtualFiles: allFiles })
          .then((result) => {
            if (result.success) {
              setBuildStatus("success", [], result.duration);
              addLog(
                "info",
                `Build succeeded in ${result.duration}ms (${result.byteSize} bytes)`,
                "BuildService",
              );
            } else {
              setBuildStatus("error", result.errors, result.duration);
              for (const err of result.errors)
                addLog("error", err, "BuildService");
            }
          });
      } else {
        gameBuildService.queueBuild({
          code,
          mode: buildMode,
          virtualFiles: allFiles,
          onStart: () => {
            setBuildStatus("building");
            addLog("info", "Building…", "BuildService");
          },
          onComplete: (result) => {
            if (result.success) {
              setBuildStatus("success", [], result.duration);
              addLog(
                "info",
                `Build succeeded in ${result.duration}ms (${result.byteSize} bytes)`,
                "BuildService",
              );
            } else {
              setBuildStatus("error", result.errors, result.duration);
              for (const err of result.errors)
                addLog("error", err, "BuildService");
            }
          },
        });
      }
    },
    [buildMode, setBuildStatus, addLog],
  );

  const handleChange = React.useCallback(
    (value: string | undefined): void => {
      if (value === undefined) return;
      setEditorCode(value);
      if (settings.autoBuild) triggerBuild(value, false);
    },
    [setEditorCode, settings.autoBuild, triggerBuild],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Escape") {
        setShowSnippets(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        triggerBuild(editorCode, true);
        if (activeFilePath === null) return;
        if ("__TAURI_INTERNALS__" in window) {
          void TauriFileService.saveFile(activeFilePath, editorCode).then(
            (result) => {
              if (result.success) {
                addLog("info", `Saved ${activeFilePath}`, "CodeEditor");
              } else {
                addLog(
                  "error",
                  `Save failed: ${result.error ?? "unknown error"}`,
                  "CodeEditor",
                );
              }
            },
          );
        } else {
          const blob = new Blob([editorCode], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = activeFilePath.split("/").pop() ?? activeFilePath;
          a.click();
          URL.revokeObjectURL(url);
          addLog("info", `Downloaded ${activeFilePath}`, "CodeEditor");
        }
      }
    },
    [editorCode, triggerBuild, activeFilePath, addLog],
  );

  const handleTabClick = (path: string): void => {
    const content = openFiles[path] ?? "";
    openFile(path, content);
  };

  const handleTabClose = (e: React.MouseEvent, path: string): void => {
    e.stopPropagation();
    closeFile(path);
  };

  React.useEffect(() => {
    return () => {
      gameBuildService.cancel();
    };
  }, []);

  const editorLanguage = React.useMemo(() => {
    if (activeFilePath === null) return "typescript";
    const ext = activeFilePath
      .slice(activeFilePath.lastIndexOf(".") + 1)
      .toLowerCase();
    switch (ext) {
      case "js":
      case "jsx":
        return "javascript";
      case "tsx":
        return "typescript";
      case "json":
        return "json";
      case "glsl":
      case "vert":
      case "frag":
        return "glsl";
      case "esscene":
      case "esmap":
      case "esanim":
      case "esprefab":
      case "esvn":
      case "esparticle":
      case "esui":
      case "esdata":
        return "emptysock-resource";
      case "ts":
      default:
        return "typescript";
    }
  }, [activeFilePath]);

  const filteredSnippets = React.useMemo(() => {
    const q = snippetSearch.trim().toLowerCase();
    if (q === "") return SNIPPETS;
    return SNIPPETS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
    );
  }, [snippetSearch]);

  // panel position: anchored to toolbar button (null) or to cursor coords
  const panelStyle: React.CSSProperties =
    snippetPos !== null
      ? {
          position: "absolute",
          top: snippetPos.top,
          left: snippetPos.left,
          zIndex: 50,
        }
      : {
          position: "absolute",
          top: 33,
          right: 0,
          zIndex: 50,
        };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      style={
        keyboardPadding > 0 ? { paddingBottom: keyboardPadding } : undefined
      }
    >
      {/* Multi-tab bar */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 33,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          position: "relative",
        }}
      >
        <div
          className="flex items-center overflow-x-auto flex-1"
          style={{ height: "100%", scrollbarWidth: "none" }}
        >
          {tabPaths.length === 0 ? (
            <span
              style={{
                padding: "0 12px",
                fontSize: 11,
                color: "var(--es-text-muted)",
              }}
            >
              No files open
            </span>
          ) : (
            tabPaths.map((path) => {
              const label = path.split("/").pop() ?? path;
              const active = path === activeFilePath;
              return (
                <div
                  key={path}
                  onClick={() => handleTabClick(path)}
                  style={{
                    display: "inline-flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    flexGrow: 0,
                    cursor: "pointer",
                    userSelect: "none",
                    height: "100%",
                    padding: "0 10px",
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    borderRight: "1px solid var(--es-border)",
                    borderBottom: active
                      ? "2px solid var(--es-accent)"
                      : "2px solid transparent",
                    color: active ? "var(--es-text)" : "var(--es-text-muted)",
                    background: active
                      ? "color-mix(in srgb, var(--es-accent) 6%, transparent)"
                      : undefined,
                    maxWidth: 200,
                  }}
                >
                  <span
                    style={{
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                  <button
                    onClick={(e) => handleTabClose(e, path)}
                    style={{
                      flexShrink: 0,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--es-text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 1,
                      borderRadius: 2,
                      minHeight: "unset",
                      minWidth: "unset",
                      width: 14,
                      height: 14,
                      lineHeight: 1,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <button
          onClick={() => {
            if (showSnippets) {
              setShowSnippets(false);
            } else {
              openSnippetPalette(true);
            }
          }}
          title="Insert snippet"
          style={{
            flexShrink: 0,
            height: "100%",
            padding: "0 10px",
            background: showSnippets
              ? "color-mix(in srgb, var(--es-accent) 10%, transparent)"
              : "none",
            border: "none",
            borderLeft: "1px solid var(--es-border)",
            color: showSnippets ? "var(--es-accent)" : "var(--es-text-muted)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {"{ }"}
        </button>

        {/* Snippet palette */}
        {showSnippets && (
          <div
            ref={snippetPanelRef}
            style={{
              ...panelStyle,
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 6,
              width: 268,
              maxHeight: 380,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                borderBottom: "1px solid var(--es-border)",
                flexShrink: 0,
              }}
            >
              <input
                ref={snippetSearchRef}
                value={snippetSearch}
                onChange={(e) => setSnippetSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setShowSnippets(false);
                  }
                }}
                placeholder="Filter snippets…"
                style={{
                  width: "100%",
                  background: "var(--es-bg)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  color: "var(--es-text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {filteredSnippets.length === 0 ? (
                <div
                  style={{
                    padding: "16px 12px",
                    fontSize: 12,
                    color: "var(--es-text-muted)",
                    textAlign: "center",
                  }}
                >
                  No snippets match.
                </div>
              ) : (
                filteredSnippets.map((snippet) => (
                  <button
                    key={snippet.label}
                    onClick={() => {
                      insertSnippet(snippet.body);
                      setShowSnippets(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 12px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--es-border)",
                      cursor: "pointer",
                      color: "var(--es-text)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 12,
                        color: "var(--es-text)",
                        marginBottom: 2,
                      }}
                    >
                      {snippet.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: '"JetBrains Mono", monospace',
                        color: "var(--es-text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {snippet.body.split("\n")[0]}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Monaco editor */}
      <div className="flex-1 overflow-hidden">
        {activeFilePath !== null ? (
          <MonacoEditor
            key={activeFilePath}
            language={editorLanguage}
            theme={monacoTheme}
            value={editorCode}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              fontSize: settings.editorFontSize,
              tabSize: settings.editorTabSize,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontLigatures: true,
              lineHeight: 1.6,
              minimap: {
                enabled: settings.editorMinimap && !isNarrow,
                scale: 1,
              },
              lineNumbers: settings.editorLineNumbers ? "on" : "off",
              scrollBeyondLastLine: false,
              wordWrap: settings.editorWordWrap ? "on" : "off",
              padding: { top: 12, bottom: 12 },
              overviewRulerBorder: false,
              renderLineHighlight: "gutter",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              bracketPairColorization: { enabled: true },
              guides: { indentation: true },
            }}
          />
        ) : (
          <div
            className="flex-1 flex items-center justify-center h-full"
            style={{ color: "var(--es-text-muted)", fontSize: 13 }}
          >
            Open a file from the sidebar
          </div>
        )}
      </div>
    </div>
  );
}
