import React from "react";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { X } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { gameBuildService } from "../../services/GameBuildService";
import { loadSettings } from "../../services/SettingsService";
import type { IDESettings } from "../../services/SettingsService";
import { TauriFileService } from "../../services/TauriFileService";

interface Snippet {
  label: string;
  text: string;
  preview: string;
}

const SNIPPETS: Snippet[] = [
  {
    label: "Scene class",
    text: 'import { Scene } from "@emptysock/engine";\n\nexport class MyScene extends Scene {\n  async onLoad(): Promise<void> {}\n  onUpdate(_dt: number): void {}\n  onDestroy(): void {}\n}\n',
    preview: "class MyScene extends Scene",
  },
  {
    label: "Entity + component",
    text: 'const e = this.createEntity("name");\ne.addComponent({ type: "Transform", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });\n',
    preview: "createEntity / addComponent",
  },
  {
    label: "Coroutine",
    text: "entity.startCoroutine(function* () {\n  yield 1; // wait one frame\n  // your code here\n});\n",
    preview: "entity.startCoroutine",
  },
  {
    label: "ActorSystem",
    text: 'import { ActorSystem } from "@emptysock/engine";\n\nconst actors = new ActorSystem();\n// actors.register(myActor);\n// actors.update(dt);\n',
    preview: "new ActorSystem()",
  },
  {
    label: "Timer",
    text: 'import { Timer } from "@emptysock/engine";\n\nconst t = new Timer(2.0); // seconds\nif (t.update(dt)) { /* fired */ }\n',
    preview: "new Timer(seconds)",
  },
];

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
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const monacoRef = React.useRef<typeof Monaco | null>(null);
  const snippetPanelRef = React.useRef<HTMLDivElement>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const insertSnippet = (text: string): void => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (editor === null || monaco === null) return;
    editor.focus();
    const selection = editor.getSelection();
    const range = selection ?? new monaco.Range(1, 1, 1, 1);
    editor.executeEdits("snippet", [{ range, text }]);
  };

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
        return "javascript";
      case "jsx":
        return "javascript";
      case "tsx":
        return "typescript";
      case "json":
        return "json";
      case "ts":
      default:
        return "typescript";
    }
  }, [activeFilePath]);

  return (
    <div
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
                  className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none"
                  style={{
                    height: "100%",
                    padding: "0 10px",
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    borderRight: "1px solid var(--es-border)",
                    borderBottom: active
                      ? "2px solid var(--es-accent)"
                      : "2px solid transparent",
                    color: active ? "var(--es-text)" : "var(--es-text-muted)",
                    background: active ? "rgba(124,106,247,0.06)" : undefined,
                    maxWidth: 180,
                  }}
                >
                  <span className="truncate" style={{ maxWidth: 120 }}>
                    {label}
                  </span>
                  <button
                    onClick={(e) => handleTabClose(e, path)}
                    className="flex-shrink-0"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--es-text-muted)",
                      display: "flex",
                      padding: 1,
                      borderRadius: 2,
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
          onClick={() => setShowSnippets((v) => !v)}
          title="Insert snippet"
          style={{
            flexShrink: 0,
            height: "100%",
            padding: "0 10px",
            background: showSnippets ? "rgba(124,106,247,0.1)" : "none",
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
        {showSnippets && (
          <div
            ref={snippetPanelRef}
            style={{
              position: "absolute",
              top: 33,
              right: 0,
              zIndex: 50,
              background: "var(--es-surface, #1e1e1e)",
              border: "1px solid var(--es-border, #333)",
              borderRadius: 6,
              width: 260,
              maxHeight: 400,
              overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                onClick={() => {
                  insertSnippet(snippet.text);
                  setShowSnippets(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  borderBottom: "1px solid var(--es-border, #333)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {snippet.label}
                </div>
                <div
                  style={{
                    opacity: 0.6,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                >
                  {snippet.preview}
                </div>
              </button>
            ))}
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
