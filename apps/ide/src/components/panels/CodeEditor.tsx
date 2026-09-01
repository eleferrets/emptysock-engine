import React from "react";
import MonacoEditor from "@monaco-editor/react";
import { X } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { gameBuildService } from "../../services/GameBuildService";
import { loadSettings } from "../../services/SettingsService";
import type { IDESettings } from "../../services/SettingsService";

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(() => window.innerWidth < 600);
  React.useEffect(() => {
    const handler = (): void => setNarrow(window.innerWidth < 600);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return narrow;
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
  const [settings] = React.useState<IDESettings>(() => loadSettings());

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
      }
    },
    [editorCode, triggerBuild],
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
    >
      {/* Multi-tab bar */}
      <div
        className="flex items-center overflow-x-auto flex-shrink-0"
        style={{
          height: 33,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          scrollbarWidth: "none",
        }}
      >
        {tabPaths.length === 0 ? (
          <span
            style={{
              padding: "0 12px",
              fontSize: 11,
              color: "var(--text-muted)",
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
                  borderRight: "1px solid var(--border)",
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  color: active ? "var(--text)" : "var(--text-muted)",
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
                    color: "var(--text-muted)",
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

      {/* Monaco editor */}
      <div className="flex-1 overflow-hidden">
        {activeFilePath !== null ? (
          <MonacoEditor
            key={activeFilePath}
            language={editorLanguage}
            theme={monacoTheme}
            value={editorCode}
            onChange={handleChange}
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
            style={{ color: "var(--text-muted)", fontSize: 13 }}
          >
            Open a file from the sidebar
          </div>
        )}
      </div>
    </div>
  );
}
