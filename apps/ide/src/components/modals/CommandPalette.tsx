import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Search,
  Play,
  Square,
  Pause,
  Download,
  Bug,
  Trash2,
  Settings,
  Code,
  Monitor,
  Layers,
  FolderOpen,
  Save,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { BrowserFileService } from "../../services/BrowserFileService";
import { TauriFileService } from "../../services/TauriFileService";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactElement;
  action: () => void;
  keywords: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenExport: () => void;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (query.length === 0) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // simple fuzzy: all chars of q must appear in order in t
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  open,
  onClose,
  onOpenExport,
}: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    playState,
    setPlayState,
    toggleDebugOverlay,
    clearLogs,
    setActiveTab,
    setSettingsOpen,
    toggleBuildMode,
    buildMode,
    clearBuildCache,
    setEditorCode,
    editorCode,
    projectName,
  } = useIDEStore();

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "play",
        label: playState === "playing" ? "Pause Game" : "Play Game",
        description: "Start or pause the game preview",
        icon:
          playState === "playing" ? <Pause size={14} /> : <Play size={14} />,
        action: () => {
          setPlayState(playState === "playing" ? "paused" : "playing");
        },
        keywords: ["play", "pause", "run", "start", "game"],
      },
      {
        id: "stop",
        label: "Stop Game",
        description: "Stop the game preview",
        icon: <Square size={14} />,
        action: () => {
          setPlayState("stopped");
        },
        keywords: ["stop", "halt", "game"],
      },
      {
        id: "export",
        label: "Export Project",
        description: "Export game for web, desktop, or mobile",
        icon: <Download size={14} />,
        action: onOpenExport,
        keywords: [
          "export",
          "build",
          "publish",
          "release",
          "web",
          "windows",
          "macos",
          "linux",
        ],
      },
      {
        id: "toggle-debug",
        label: "Toggle Debug Overlay",
        description: "Show/hide physics and entity debug info",
        icon: <Bug size={14} />,
        action: toggleDebugOverlay,
        keywords: ["debug", "overlay", "physics", "toggle"],
      },
      {
        id: "toggle-mode",
        label: `Switch to ${buildMode === "debug" ? "Release" : "Debug"} Mode`,
        description: "Toggle between debug and release build modes",
        icon: <Bug size={14} />,
        action: toggleBuildMode,
        keywords: ["debug", "release", "mode", "build"],
      },
      {
        id: "clear-console",
        label: "Clear Console",
        description: "Remove all console log entries",
        icon: <Trash2 size={14} />,
        action: clearLogs,
        keywords: ["clear", "console", "logs"],
      },
      {
        id: "clear-cache",
        label: "Clear Build Cache",
        description: "Invalidate the incremental build cache",
        icon: <Trash2 size={14} />,
        action: clearBuildCache,
        keywords: ["clear", "cache", "build", "invalidate"],
      },
      {
        id: "tab-code",
        label: "Go to Code Editor",
        icon: <Code size={14} />,
        action: () => {
          setActiveTab("code");
        },
        keywords: ["code", "editor", "tab"],
      },
      {
        id: "tab-canvas",
        label: "Go to Preview",
        icon: <Monitor size={14} />,
        action: () => {
          setActiveTab("canvas");
        },
        keywords: ["preview", "canvas", "game", "tab"],
      },
      {
        id: "tab-scene",
        label: "Go to Scene Inspector",
        icon: <Layers size={14} />,
        action: () => {
          setActiveTab("scene");
        },
        keywords: ["scene", "inspector", "entities", "tab"],
      },
      {
        id: "open-file",
        label: "Open File",
        description: "Open a .ts file from disk into the editor",
        icon: <FolderOpen size={14} />,
        action: () => {
          const isTauri =
            typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
          const svc = isTauri ? TauriFileService : BrowserFileService;
          void svc.openFile().then((r) => {
            if (r.success && r.content !== undefined) setEditorCode(r.content);
          });
        },
        keywords: ["open", "file", "load", "import"],
      },
      {
        id: "save-file",
        label: "Save File",
        description: "Save the current editor code to disk",
        icon: <Save size={14} />,
        action: () => {
          const isTauri =
            typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
          if (isTauri) {
            void TauriFileService.saveFile(null, editorCode);
          } else {
            void BrowserFileService.saveFile(`${projectName}.ts`, editorCode);
          }
        },
        keywords: ["save", "file", "write", "export"],
      },
      {
        id: "settings",
        label: "Open Settings",
        icon: <Settings size={14} />,
        action: () => {
          setSettingsOpen(true);
        },
        keywords: ["settings", "preferences", "config"],
      },
    ],
    [
      playState,
      setPlayState,
      onOpenExport,
      toggleDebugOverlay,
      buildMode,
      toggleBuildMode,
      clearLogs,
      clearBuildCache,
      setActiveTab,
      setSettingsOpen,
      setEditorCode,
      editorCode,
      projectName,
    ],
  );

  const filtered = useMemo(() => {
    if (query.trim() === "") return commands;
    return commands.filter(
      (cmd) =>
        fuzzyMatch(query, cmd.label) ||
        cmd.keywords.some((k) => fuzzyMatch(query, k)),
    );
  }, [commands, query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const runCommand = useCallback(
    (cmd: Command) => {
      cmd.action();
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const cmd = filtered[selectedIdx];
        if (cmd !== undefined) runCommand(cmd);
      }
    },
    [filtered, selectedIdx, runCommand, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as
      HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(3px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 10,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid var(--es-border)",
          }}
        >
          <Search
            size={14}
            style={{ color: "var(--es-text-muted)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "var(--es-text)",
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "var(--es-text-muted)",
              background: "var(--es-bg)",
              padding: "2px 5px",
              borderRadius: 4,
              border: "1px solid var(--es-border)",
            }}
          >
            esc
          </span>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: 12,
                color: "var(--es-text-muted)",
              }}
            >
              No commands match "{query}"
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => runCommand(cmd)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 14px",
                  background:
                    i === selectedIdx
                      ? "rgba(124,106,247,0.12)"
                      : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${i === selectedIdx ? "var(--es-accent)" : "transparent"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  color:
                    i === selectedIdx
                      ? "var(--es-text)"
                      : "var(--es-text-muted)",
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span
                  style={{
                    color:
                      i === selectedIdx
                        ? "var(--es-accent)"
                        : "var(--es-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {cmd.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {cmd.label}
                  </div>
                  {cmd.description !== undefined && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--es-text-muted)",
                        marginTop: 1,
                      }}
                    >
                      {cmd.description}
                    </div>
                  )}
                </div>
                {i === selectedIdx && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--es-text-muted)",
                      background: "var(--es-bg)",
                      padding: "2px 5px",
                      borderRadius: 4,
                      border: "1px solid var(--es-border)",
                    }}
                  >
                    ↵
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
