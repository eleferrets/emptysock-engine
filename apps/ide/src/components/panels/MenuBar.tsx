import React, { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { useIDEStore } from "../../store/ideStore";
import { BrowserFileService } from "../../services/BrowserFileService";
import { TauriFileService } from "../../services/TauriFileService";
import { ALL_MODULES } from "../../services/ModuleRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItem {
  type: "item";
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface MenuSeparator {
  type: "separator";
}

type MenuEntry = MenuItem | MenuSeparator;

interface MenuDef {
  label: string;
  items: MenuEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function Kbd({ shortcut }: { shortcut: string }): React.ReactElement {
  return (
    <kbd
      style={{
        marginLeft: "auto",
        paddingLeft: 20,
        color: "var(--es-text-muted)",
        fontSize: 10,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontStyle: "normal",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          border: "1px solid var(--es-border)",
          borderRadius: 3,
          padding: "1px 4px",
          fontSize: 10,
          lineHeight: 1.4,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {shortcut}
      </span>
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Single dropdown menu
// ---------------------------------------------------------------------------

interface DropdownProps {
  def: MenuDef;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHoverSibling: (open: boolean) => void;
}

function Dropdown({
  def,
  open,
  onOpen,
  onClose,
  onHoverSibling,
}: DropdownProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          open ? onClose() : onOpen();
        }}
        onMouseEnter={() => onHoverSibling(open)}
        style={{
          background: open ? "rgba(124,106,247,0.14)" : "transparent",
          border: "none",
          color: open ? "var(--es-text)" : "var(--es-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          padding: "0 10px",
          height: 28,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          transition: "background 0.1s, color 0.1s",
          userSelect: "none",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--es-text)";
        }}
        onMouseOut={(e) => {
          if (!open)
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--es-text-muted)";
        }}
      >
        {def.label}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 7,
            boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            minWidth: 240,
            padding: "4px 0",
            marginTop: 2,
          }}
        >
          {def.items.map((item, i) => {
            if (item.type === "separator") {
              return (
                <div
                  key={i}
                  style={{
                    height: 1,
                    background: "var(--es-border)",
                    margin: "4px 0",
                  }}
                />
              );
            }
            return (
              <button
                key={i}
                type="button"
                disabled={item.disabled === true}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (item.disabled !== true) {
                    item.action();
                    onClose();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: item.disabled === true ? "default" : "pointer",
                  color:
                    item.disabled === true
                      ? "var(--es-text-muted)"
                      : "var(--es-text)",
                  fontSize: 12,
                  textAlign: "left",
                  opacity: item.disabled === true ? 0.45 : 1,
                }}
                onMouseOver={(e) => {
                  if (item.disabled !== true)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(124,106,247,0.1)";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                {item.label}
                {item.shortcut !== undefined && (
                  <Kbd shortcut={item.shortcut} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MenuBar
// ---------------------------------------------------------------------------

interface MenuBarProps {
  onOpenExport: () => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  onOpenDownload: () => void;
  onOpenPanel: (id: string) => void;
  onOpenModules: () => void;
}

export function MenuBar({
  onOpenExport,
  onOpenPalette,
  onOpenShortcuts,
  onOpenDownload,
  onOpenPanel,
  onOpenModules,
}: MenuBarProps): React.ReactElement {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const {
    playState,
    setPlayState,
    toggleDebugOverlay,
    clearLogs,
    setSettingsOpen,
    toggleBuildMode,
    buildMode,
    clearBuildCache,
    setEditorCode,
    editorCode,
    projectName,
    resetProject,
    loadProjectFiles,
  } = useIDEStore();

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "⌘" : "Ctrl";

  // ── File actions ────────────────────────────────────────────────────────

  const newProject = useCallback((): void => {
    if (!window.confirm("Create a new project? Unsaved changes will be lost."))
      return;
    resetProject();
  }, [resetProject]);

  const openProjectFiles = useCallback((): void => {
    // Use showOpenFilePicker (multi-select) so users can open several files at once.
    // Falls back to single-file open when the API is unavailable.
    if ("showOpenFilePicker" in window) {
      void (async () => {
        try {
          const handles = await window.showOpenFilePicker({
            multiple: true,
            types: [
              {
                description: "Script files",
                accept: {
                  "text/plain": [".ts", ".tsx", ".js", ".jsx", ".json"],
                },
              },
            ],
          });
          const entries: Record<string, string> = {};
          for (const handle of handles) {
            const file = await handle.getFile();
            entries[file.name] = await file.text();
          }
          if (Object.keys(entries).length > 0) loadProjectFiles(entries);
        } catch (e) {
          if (e instanceof Error && e.name !== "AbortError") console.error(e);
        }
      })();
    } else {
      // Firefox / unsupported — fall back to single-file open
      const svc = isTauri() ? TauriFileService : BrowserFileService;
      void svc.openFile().then((r) => {
        if (r.success && r.content !== undefined && r.path !== undefined) {
          loadProjectFiles({ [r.path]: r.content });
        }
      });
    }
  }, [loadProjectFiles]);

  const openFile = useCallback((): void => {
    const svc = isTauri() ? TauriFileService : BrowserFileService;
    void svc.openFile().then((r) => {
      if (r.success && r.content !== undefined) setEditorCode(r.content);
    });
  }, [setEditorCode]);

  const saveFile = useCallback((): void => {
    if (isTauri()) {
      void TauriFileService.saveFile(null, editorCode);
    } else {
      void BrowserFileService.saveFile(`${projectName}.ts`, editorCode);
    }
  }, [editorCode, projectName]);

  const downloadProjectZip = useCallback((): void => {
    const zip = new JSZip();
    const files = useIDEStore.getState().openFiles;
    const name = useIDEStore.getState().projectName;
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    void zip
      .generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })
      .then((blob) => {
        BrowserFileService.downloadBlob(`${name}.zip`, blob);
      });
  }, []);

  // ── Help actions ────────────────────────────────────────────────────────

  const openManual = useCallback((): void => {
    window.open("/manual/", "_blank", "noopener");
  }, []);

  const openLanguageRef = useCallback((): void => {
    window.open("/manual/10-language-reference.md", "_blank", "noopener");
  }, []);

  const openApiRef = useCallback((): void => {
    window.open("/api-reference.json", "_blank", "noopener");
  }, []);

  // ── Menu definitions ────────────────────────────────────────────────────

  const menus: MenuDef[] = [
    {
      label: "File",
      items: [
        {
          type: "item",
          label: "New Project",
          shortcut: `${mod}+N`,
          action: newProject,
        },
        { type: "item", label: "Open Project…", action: openProjectFiles },
        { type: "separator" },
        {
          type: "item",
          label: "Open File…",
          shortcut: `${mod}+O`,
          action: openFile,
        },
        {
          type: "item",
          label: "Save File",
          shortcut: `${mod}+S`,
          action: saveFile,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Download Project as ZIP",
          shortcut: `${mod}+Shift+Z`,
          action: downloadProjectZip,
        },
        {
          type: "item",
          label: "Export…",
          shortcut: `${mod}+Shift+E`,
          action: onOpenExport,
        },
        { type: "separator" },
        {
          type: "item",
          label: "Settings",
          shortcut: `${mod}+,`,
          action: () => setSettingsOpen(true),
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          type: "item",
          label: "Command Palette",
          shortcut: `${mod}+K`,
          action: onOpenPalette,
        },
        { type: "separator" },
        { type: "item", label: "Clear Console", action: clearLogs },
        { type: "item", label: "Clear Build Cache", action: clearBuildCache },
      ],
    },
    {
      label: "View",
      items: [
        {
          type: "item",
          label: "Code Editor",
          shortcut: `${mod}+1`,
          action: () => onOpenPanel("code"),
        },
        {
          type: "item",
          label: "Preview",
          shortcut: `${mod}+2`,
          action: () => onOpenPanel("canvas"),
        },
        {
          type: "item",
          label: "Scene Inspector",
          shortcut: `${mod}+3`,
          action: () => onOpenPanel("scene"),
        },
        { type: "separator" },
        {
          type: "item",
          label: "Toggle Debug Overlay",
          shortcut: `${mod}+D`,
          action: toggleDebugOverlay,
        },
        {
          type: "item",
          label:
            buildMode === "debug"
              ? "Switch to Release Mode"
              : "Switch to Debug Mode",
          action: toggleBuildMode,
        },
      ],
    },
    {
      label: "Run",
      items: [
        {
          type: "item",
          label: playState === "playing" ? "Pause" : "Play",
          shortcut: `${mod}+Enter`,
          action: () =>
            setPlayState(playState === "playing" ? "paused" : "playing"),
        },
        {
          type: "item",
          label: "Stop",
          shortcut: `${mod}+.`,
          disabled: playState === "stopped",
          action: () => setPlayState("stopped"),
        },
      ],
    },
    {
      label: "Window",
      items: [
        {
          type: "item",
          label: "Reset Layout",
          action: () => {
            try {
              localStorage.removeItem("es-dock-layout");
            } catch {
              // ignore
            }
            window.location.reload();
          },
        },
        { type: "separator" },
        {
          type: "item",
          label: "Code Editor",
          shortcut: `${mod}+1`,
          action: () => onOpenPanel("code"),
        },
        {
          type: "item",
          label: "Preview Canvas",
          shortcut: `${mod}+2`,
          action: () => onOpenPanel("canvas"),
        },
        {
          type: "item",
          label: "Scene Inspector",
          shortcut: `${mod}+3`,
          action: () => onOpenPanel("scene"),
        },
        { type: "item", label: "Files", action: () => onOpenPanel("files") },
        {
          type: "item",
          label: "Console",
          action: () => onOpenPanel("console"),
        },
        { type: "item", label: "Assets", action: () => onOpenPanel("assets") },
        {
          type: "item",
          label: "Inspector",
          action: () => onOpenPanel("inspector"),
        },
        ...(() => {
          const { enabledModules } = useIDEStore.getState();
          const moduleItems = ALL_MODULES.filter((m) =>
            enabledModules.includes(m.id),
          ).map((m) => ({
            type: "item" as const,
            label: m.label,
            action: () => onOpenPanel(m.id),
          }));
          return moduleItems.length > 0
            ? [{ type: "separator" as const }, ...moduleItems]
            : [];
        })(),
        { type: "separator" },
        { type: "item", label: "Modules…", action: onOpenModules },
      ],
    },
    {
      label: "Help",
      items: [
        { type: "item", label: "View Manual", action: openManual },
        {
          type: "item",
          label: "Language Reference (TS & JS)",
          action: openLanguageRef,
        },
        { type: "item", label: "API Reference (JSON)", action: openApiRef },
        { type: "separator" },
        {
          type: "item",
          label: "Keyboard Shortcuts",
          shortcut: "?",
          action: onOpenShortcuts,
        },
        ...(!isTauri()
          ? [
              { type: "separator" as const },
              {
                type: "item" as const,
                label: "Download EmptySock Engine…",
                action: onOpenDownload,
              },
            ]
          : []),
        { type: "separator" },
        {
          type: "item",
          label: "About EmptySock Engine v0.1.0",
          action: () => {
            window.alert(
              "EmptySock Engine v0.1.0\n\nA portable, cross-platform game engine.\nBuild games with TypeScript or JavaScript.",
            );
          },
        },
      ],
    },
  ];

  // ── Global keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpenIdx(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (e.key === "n") {
          e.preventDefault();
          newProject();
        } else if (e.key === "o") {
          e.preventDefault();
          openFile();
        } else if (e.key === "s") {
          e.preventDefault();
          saveFile();
        } else if (e.shiftKey && e.key === "Z") {
          e.preventDefault();
          downloadProjectZip();
        } else if (e.shiftKey && e.key === "E") {
          e.preventDefault();
          onOpenExport();
        } else if (e.key === "Enter") {
          e.preventDefault();
          setPlayState(playState === "playing" ? "paused" : "playing");
        } else if (e.key === ".") {
          e.preventDefault();
          setPlayState("stopped");
        } else if (e.key === "1") {
          e.preventDefault();
          onOpenPanel("code");
        } else if (e.key === "2") {
          e.preventDefault();
          onOpenPanel("canvas");
        } else if (e.key === "3") {
          e.preventDefault();
          onOpenPanel("scene");
        } else if (e.key === "d") {
          e.preventDefault();
          toggleDebugOverlay();
        } else if (e.key === ",") {
          e.preventDefault();
          setSettingsOpen(true);
        }
      } else if (
        e.key === "?" &&
        !e.shiftKey &&
        (e.target as HTMLElement).tagName !== "INPUT" &&
        (e.target as HTMLElement).tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        onOpenShortcuts();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    newProject,
    openFile,
    saveFile,
    downloadProjectZip,
    playState,
    setPlayState,
    onOpenPanel,
    toggleDebugOverlay,
    setSettingsOpen,
    onOpenExport,
    onOpenShortcuts,
  ]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        padding: "0 6px",
        gap: 2,
        background: "var(--es-bg)",
        borderBottom: "1px solid var(--es-border)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {menus.map((menu, i) => (
        <Dropdown
          key={menu.label}
          def={menu}
          open={openIdx === i}
          onOpen={() => setOpenIdx(i)}
          onClose={() => setOpenIdx(null)}
          onHoverSibling={(anyOpen) => {
            if (anyOpen) setOpenIdx(i);
          }}
        />
      ))}
    </div>
  );
}
