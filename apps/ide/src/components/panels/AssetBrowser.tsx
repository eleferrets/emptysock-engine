import React, { useState, useRef, useCallback, useEffect } from "react";
import { getAssetStore, browserAssetStore } from "../../services/AssetStore";
import {
  Search,
  Upload,
  ChevronDown,
  ChevronRight,
  List,
  RotateCcw,
  RotateCw,
  FolderOpen,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { AssetItem } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { Button } from "../ui/Button";
import { ContextMenu } from "../ui/ContextMenu";
import type { ContextMenuEntry } from "../ui/ContextMenu";
import {
  AssetIcon,
  AssetIconSmall,
  formatSize,
  guessAssetType,
  STRIP_RE,
  MAX_RECENT,
} from "./asset-browser/helpers";
import { AssetPreviewPopover } from "./asset-browser/AssetPreviewPopover";
import { RoomOrderDialog } from "./asset-browser/RoomOrderDialog";
import { SpriteSheetStripDialog } from "./asset-browser/SpriteSheetStripDialog";
import type { StripDialog } from "./asset-browser/SpriteSheetStripDialog";

export function AssetBrowser(): React.ReactElement {
  const assets = useIDEStore((s) => s.assets);
  const setAssets = useIDEStore((s) => s.setAssets);
  const openImageEditor = useIDEStore((s) => s.openImageEditor);
  const openFile = useIDEStore((s) => s.openFile);
  const requestOpenPanel = useIDEStore((s) => s.requestOpenPanel);
  const openFiles = useIDEStore((s) => s.openFiles);
  const recentIds = useIDEStore((s) => s.recentAssetIds);
  const setRecentIds = useIDEStore((s) => s.setRecentAssetIds);
  const roomOrder = useIDEStore((s) => s.roomOrder);
  const setRoomOrder = useIDEStore((s) => s.setRoomOrder);
  const dropImportFolder = useIDEStore((s) => s.dropImportFolder);
  const setDropImportFolder = useIDEStore((s) => s.setDropImportFolder);

  const {
    state: histAssets,
    set: histSet,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<AssetItem[]>(assets);

  // Sync history state → store (handles undo/redo restores and all UI mutations)
  useEffect(() => {
    setAssets(histAssets);
  }, [histAssets, setAssets]);

  // Keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, undo, redo]);

  // Load assets from disk on mount (if a directory root is already open).
  // histSet is stable (useCallback with no deps) so omitting it is safe.
  useEffect(() => {
    const store = getAssetStore();
    if (!store.hasRoot()) return;
    void store.list().then((items) => {
      if (items.length > 0) histSet(items);
    });
  }, []); // intentional: run once on mount

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<{
    asset: AssetItem;
    anchorRect: DOMRect;
  } | null>(null);
  const [stripDialog, setStripDialog] = useState<StripDialog | null>(null);
  const [recentOpen, setRecentOpen] = useState(true);
  const [roomOrderOpen, setRoomOrderOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    asset: AssetItem;
    position: { x: number; y: number };
  } | null>(null);
  const stripFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFolder = useRef("assets");

  const filtered = histAssets.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const scenes = histAssets.filter((a) => a.type === "scene");

  const recentAssets = recentIds
    .map((id) => histAssets.find((a) => a.id === id))
    .filter((a): a is AssetItem => a !== undefined);

  const trackRecent = (id: string): void => {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(
      0,
      MAX_RECENT,
    );
    setRecentIds(next);
  };

  const clearLeaveTimer = useCallback((): void => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback((): void => {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => {
      setHoveredAsset(null);
      leaveTimer.current = null;
    }, 150);
  }, [clearLeaveTimer]);

  const handleAssetPointerEnter = useCallback(
    (asset: AssetItem, e: React.PointerEvent<HTMLButtonElement>): void => {
      clearLeaveTimer();
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredAsset({ asset, anchorRect: rect });
    },
    [clearLeaveTimer],
  );

  const openStripDialog = (file: File): void => {
    const match = STRIP_RE.exec(file.name);
    const n = match !== null ? parseInt(match[1] ?? "0", 10) : 0;
    stripFileRef.current = file;
    setStripDialog({
      fileName: file.name,
      detectedN: n,
      frameCount: String(n),
      objectUrl: URL.createObjectURL(file),
      size: file.size,
    });
  };

  const handleDrop = useCallback(
    (files: FileList): void => {
      const folder =
        dropImportFolder === "root" ? "assets/" : lastFolder.current + "/";
      const toImport: File[] = [];
      for (const file of Array.from(files)) {
        const match = STRIP_RE.exec(file.name);
        if (match !== null && file.type.startsWith("image/")) {
          openStripDialog(file);
          return;
        }
        toImport.push(file);
      }
      if (toImport.length > 0) {
        const store = getAssetStore();
        const writeAll = toImport.map((file) =>
          store.write(file.name, file).catch((): AssetItem => ({
            id: `ast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            type: guessAssetType(file),
            path: `${folder}${file.name}`,
            size: file.size,
          })),
        );
        void Promise.all(writeAll).then((newItems) => {
          histSet((prev) => [...prev, ...newItems]);
        });
      }
    },
    [histSet, dropImportFolder],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const toImport: File[] = [];
    for (const file of files) {
      const match = STRIP_RE.exec(file.name);
      if (match !== null && file.type.startsWith("image/")) {
        openStripDialog(file);
        e.target.value = "";
        return;
      }
      toImport.push(file);
    }
    if (toImport.length > 0) {
      const store = getAssetStore();
      const writeAll = toImport.map((file) =>
        store.write(file.name, file).catch((): AssetItem => ({
          id: `ast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: guessAssetType(file),
          path: `assets/${file.name}`,
          size: file.size,
        })),
      );
      void Promise.all(writeAll).then((newItems) => {
        histSet((prev) => [...prev, ...newItems]);
      });
    }
    e.target.value = "";
  };

  const confirmStripImport = (): void => {
    if (stripDialog === null) return;
    const n = parseInt(stripDialog.frameCount, 10);
    if (isNaN(n) || n < 1) return;
    histSet((prev) => [
      ...prev,
      {
        id: `ast-${Date.now()}`,
        name: stripDialog.fileName,
        type: "image",
        path: `assets/${stripDialog.fileName}`,
        size: stripDialog.size,
      },
    ]);
    URL.revokeObjectURL(stripDialog.objectUrl);
    stripFileRef.current = null;
    setStripDialog(null);
  };

  const cancelStripImport = (): void => {
    if (stripDialog !== null) URL.revokeObjectURL(stripDialog.objectUrl);
    setStripDialog(null);
  };

  // Per-asset-type "open in" dispatch. image -> Image Editor (a real,
  // dedicated editor); script/json -> the Code tab, loaded with that
  // file's content; scene -> the Scene panel (there's no per-scene-file
  // loader yet — this just brings the Scene tab into view, the closest
  // real thing this IDE has for a "scene" asset today). audio and font
  // have no dedicated editor anywhere in this IDE, so they intentionally
  // fall through to "just select it" rather than fabricating a target.
  const openAssetInEditor = (asset: AssetItem): void => {
    switch (asset.type) {
      case "image":
        openImageEditor(asset.id);
        return;
      case "script":
      case "json":
        openFile(asset.path);
        requestOpenPanel("code");
        return;
      case "scene":
        requestOpenPanel("scene");
        return;
      case "audio":
      case "font":
      default:
        // No dedicated editor exists for this asset type yet — leave the
        // asset selected (already handled by the click above) rather than
        // silently doing nothing or opening the wrong panel.
        return;
    }
  };

  const buildContextMenuItems = (asset: AssetItem): ContextMenuEntry[] => {
    const items: ContextMenuEntry[] = [];
    if (
      asset.type === "image" ||
      asset.type === "script" ||
      asset.type === "json" ||
      asset.type === "scene"
    ) {
      items.push({
        label:
          asset.type === "image"
            ? "Open in Image Editor"
            : asset.type === "scene"
              ? "Open in Scene panel"
              : "Open in Code Editor",
        onClick: () => {
          openAssetInEditor(asset);
          setContextMenu(null);
        },
      });
    }
    items.push({ separator: true });
    if ("__TAURI_INTERNALS__" in window) {
      items.push({
        label: "Reveal in Files",
        onClick: () => {
          void import("@tauri-apps/api/core").then(({ invoke }) => {
            void invoke("reveal_in_files", { path: asset.path }).catch(
              () => {},
            );
          });
          setContextMenu(null);
        },
      });
    } else {
      items.push({
        label: "Export",
        onClick: () => {
          window.open(asset.path, "_blank");
          setContextMenu(null);
        },
      });
    }
    items.push({ separator: true });
    items.push({
      label: "Delete",
      danger: true,
      onClick: () => {
        void getAssetStore()
          .delete(asset.path)
          .catch(() => {});
        histSet((prev) => prev.filter((a) => a.id !== asset.id));
        setContextMenu(null);
      },
    });
    return items;
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: 28,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
        }}
      >
        <Search
          size={11}
          style={{ color: "var(--es-text-muted)", flexShrink: 0 }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter assets…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: "var(--es-text)", fontFamily: "inherit" }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,.json,.ts,.js"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <Button
          variant="ghost"
          size="sm"
          title="Undo"
          onClick={undo}
          disabled={!canUndo}
        >
          <RotateCcw size={11} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="Redo"
          onClick={redo}
          disabled={!canRedo}
        >
          <RotateCw size={11} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="Import asset"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={11} />
          Import
        </Button>
        {"showDirectoryPicker" in window &&
          !("__TAURI_INTERNALS__" in window) && (
            <Button
              variant="ghost"
              size="sm"
              title="Open asset folder"
              onClick={() => {
                type WindowWithDirPicker = Window & {
                  showDirectoryPicker(opts?: {
                    mode?: "read" | "readwrite";
                  }): Promise<FileSystemDirectoryHandle>;
                };
                void (window as unknown as WindowWithDirPicker)
                  .showDirectoryPicker({ mode: "readwrite" })
                  .then((handle) => {
                    browserAssetStore.setRoot(handle);
                    return browserAssetStore.list();
                  })
                  .then((items) => {
                    if (items.length > 0) histSet(items);
                  });
              }}
            >
              <FolderOpen size={11} />
              Open folder
            </Button>
          )}
        <Button
          variant="ghost"
          size="sm"
          title="Set scene load order"
          onClick={() => setRoomOrderOpen(true)}
        >
          <List size={11} />
          Room Order
        </Button>
      </div>

      {/* Recent assets strip */}
      {recentAssets.length > 0 && (
        <div
          style={{ flexShrink: 0, borderBottom: "1px solid var(--es-border)" }}
        >
          <button
            onClick={() => setRecentOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              width: "100%",
              padding: "4px 10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--es-text-muted)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              userSelect: "none",
            }}
          >
            {recentOpen ? (
              <ChevronDown size={10} />
            ) : (
              <ChevronRight size={10} />
            )}
            Recent
          </button>

          {recentOpen && (
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: "0 10px 6px",
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {recentAssets.map((asset) => (
                <button
                  key={asset.id}
                  title={asset.name}
                  onClick={() => {
                    setSelectedId((id) => (id === asset.id ? null : asset.id));
                    trackRecent(asset.id);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: "4px 6px",
                    borderRadius: 4,
                    background:
                      selectedId === asset.id
                        ? "var(--es-selection-bg, rgba(124,106,247,0.15))"
                        : "var(--es-surface-2)",
                    border: `1px solid ${
                      selectedId === asset.id
                        ? "var(--es-accent)"
                        : "var(--es-border)"
                    }`,
                    cursor: "pointer",
                    flexShrink: 0,
                    minWidth: 48,
                    maxWidth: 64,
                  }}
                >
                  <AssetIconSmall type={asset.type} />
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--es-text-muted)",
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {asset.name.length > 8
                      ? asset.name.substring(0, 7) + "…"
                      : asset.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset grid */}
      <div
        className="flex-1 overflow-y-auto p-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: 6,
          alignContent: "start",
          border: isDragOver
            ? "2px dashed var(--es-accent)"
            : "2px solid transparent",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          setBgMenu({ x: e.clientX, y: e.clientY });
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleDrop(e.dataTransfer.files);
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--es-text-muted)",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            {histAssets.length === 0
              ? "No assets yet — drag files here or click Upload."
              : "No assets match your search."}
          </div>
        )}
        {filtered.map((asset) => (
          <button
            key={asset.id}
            onClick={() => {
              setSelectedId((id) => (id === asset.id ? null : asset.id));
              trackRecent(asset.id);
            }}
            onDoubleClick={() => openAssetInEditor(asset)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                asset,
                position: { x: e.clientX, y: e.clientY },
              });
            }}
            onPointerEnter={(e) => handleAssetPointerEnter(asset, e)}
            onPointerLeave={scheduleHide}
            className="flex flex-col items-center gap-1 p-2 rounded text-center transition-colors"
            style={{
              background:
                selectedId === asset.id
                  ? "var(--es-selection-bg, rgba(124,106,247,0.15))"
                  : "var(--es-surface-2)",
              border: `1px solid ${
                selectedId === asset.id
                  ? "var(--es-accent)"
                  : "var(--es-border)"
              }`,
            }}
          >
            <AssetIcon type={asset.type} />
            <span
              className="text-[10px] w-full truncate"
              style={{
                color: "var(--es-text-muted)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {asset.name.length > 10
                ? asset.name.substring(0, 9) + "…"
                : asset.name}
            </span>
            {asset.size !== undefined && (
              <span
                className="text-[9px]"
                style={{ color: "var(--es-text-muted)", opacity: 0.6 }}
              >
                {formatSize(asset.size)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Drop destination setting */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          borderTop: "1px solid var(--es-border)",
          fontSize: 11,
          color: "var(--es-text-muted)",
          background: "var(--es-surface-2)",
        }}
      >
        <span>Drop destination:</span>
        <select
          value={dropImportFolder}
          onChange={(e) =>
            setDropImportFolder(e.target.value as "root" | "last")
          }
          style={{
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 3,
            color: "var(--es-text)",
            fontSize: 11,
            padding: "1px 4px",
            cursor: "pointer",
          }}
        >
          <option value="root">Project root</option>
          <option value="last">Last folder</option>
        </select>
      </div>

      {/* Asset preview popover */}
      {hoveredAsset !== null && (
        <AssetPreviewPopover
          asset={hoveredAsset.asset}
          anchorRect={hoveredAsset.anchorRect}
          openFiles={openFiles}
          onPointerEnter={clearLeaveTimer}
          onPointerLeave={scheduleHide}
        />
      )}

      {bgMenu !== null && (
        <ContextMenu
          items={[
            {
              label: "Import assets…",
              onClick: () => {
                fileInputRef.current?.click();
                setBgMenu(null);
              },
            },
          ]}
          position={bgMenu}
          onClose={() => setBgMenu(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu !== null && (
        <ContextMenu
          items={buildContextMenuItems(contextMenu.asset)}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Sprite sheet strip import dialog */}
      {stripDialog !== null && (
        <SpriteSheetStripDialog
          dialog={stripDialog}
          onFrameCountChange={(value) =>
            setStripDialog((d) =>
              d === null ? null : { ...d, frameCount: value },
            )
          }
          onConfirm={confirmStripImport}
          onCancel={cancelStripImport}
        />
      )}

      {/* Room Order dialog */}
      {roomOrderOpen && (
        <RoomOrderDialog
          scenes={scenes}
          savedOrder={roomOrder}
          onApply={setRoomOrder}
          onClose={() => setRoomOrderOpen(false)}
        />
      )}
    </div>
  );
}
