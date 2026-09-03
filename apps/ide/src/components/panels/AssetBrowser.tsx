import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Image,
  Music,
  FileCode,
  FileJson,
  Search,
  Upload,
  X,
  Grid,
  PackageOpen,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { AssetItem } from "../../store/ideStore";
import { Button } from "../ui/Button";

// ---------------------------------------------------------------------------
// GMS2 YYP types (minimal — only what we parse from the project file)
// ---------------------------------------------------------------------------

interface YYPResourceId {
  name: string;
  path: string;
}

interface YYPResource {
  id: YYPResourceId;
}

interface YYProject {
  resources: YYPResource[];
}

// FileSystemDirectoryHandle.values() is an async iterator defined in
// DOM.AsyncIterable which is not in the base lib. Declare it inline.
type DirHandleIterable = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

async function importGMS2FromHandle(
  dirHandle: FileSystemDirectoryHandle,
): Promise<void> {
  const { openFile, addAsset, addLog } = useIDEStore.getState();

  // Find the first .yyp file in the directory.
  let yypHandle: FileSystemFileHandle | null = null;
  const iterable = dirHandle as DirHandleIterable;
  for await (const entry of iterable.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".yyp")) {
      yypHandle = entry as FileSystemFileHandle;
      break;
    }
  }

  if (yypHandle === null) {
    addLog(
      "warn",
      "GMS2 import: no .yyp file found in the selected directory",
      "GMS2",
    );
    return;
  }

  const file = await yypHandle.getFile();
  const raw = await file.text();

  let project: YYProject;
  try {
    project = JSON.parse(raw) as YYProject;
  } catch {
    addLog("error", "GMS2 import: failed to parse .yyp file as JSON", "GMS2");
    return;
  }

  if (!Array.isArray(project.resources)) {
    addLog("error", "GMS2 import: .yyp file has no resources array", "GMS2");
    return;
  }

  let scriptCount = 0;
  let spriteCount = 0;
  let objectCount = 0;

  for (const res of project.resources) {
    const name = res.id.name;
    const resPath = res.id.path;
    if (typeof name !== "string" || name.length === 0) continue;

    if (resPath.startsWith("scripts/")) {
      const stub = `// GMS2 import: ${name}\n// TODO: migrate from GML to TypeScript\n`;
      openFile(`gms2/${name}.ts`, stub);
      scriptCount += 1;
    } else if (resPath.startsWith("objects/")) {
      const stub = `// GMS2 import: ${name}\n// TODO: migrate from GML to TypeScript\n`;
      openFile(`gms2/${name}.ts`, stub);
      objectCount += 1;
    } else if (resPath.startsWith("sprites/")) {
      addAsset({
        id: `gms2-spr-${Date.now()}-${name}`,
        name,
        type: "image",
        path: `gms2/sprites/${name}`,
      });
      spriteCount += 1;
    }
  }

  addLog(
    "info",
    `GMS2 import complete: ${scriptCount} scripts, ${spriteCount} sprites, ${objectCount} objects`,
    "GMS2",
  );
}

function AssetIcon({ type }: { type: AssetItem["type"] }): React.ReactElement {
  const props = { size: 20, strokeWidth: 1.5 };
  switch (type) {
    case "image":
      return <Image {...props} style={{ color: "var(--es-green)" }} />;
    case "audio":
      return <Music {...props} style={{ color: "var(--es-accent)" }} />;
    case "script":
      return <FileCode {...props} style={{ color: "var(--es-blue)" }} />;
    case "json":
      return <FileJson {...props} style={{ color: "var(--es-yellow)" }} />;
    default:
      return <FileCode {...props} style={{ color: "var(--es-text-muted)" }} />;
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const STRIP_RE = /_strip(\d+)/i;
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"];

interface StripDialog {
  fileName: string;
  detectedN: number;
  frameCount: string;
  objectUrl: string;
  size: number;
}

function guessAssetType(file: File): AssetItem["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.name.endsWith(".json")) return "json";
  if (file.name.endsWith(".ts") || file.name.endsWith(".js")) return "script";
  return "json";
}

export function AssetBrowser(): React.ReactElement {
  const assets = useIDEStore((s) => s.assets);
  const addAsset = useIDEStore((s) => s.addAsset);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    path: string;
    x: number;
    y: number;
  } | null>(null);
  const [stripDialog, setStripDialog] = useState<StripDialog | null>(null);
  const stripFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const toImport: File[] = [];
    for (const file of files) {
      const match = STRIP_RE.exec(file.name);
      if (match !== null && file.type.startsWith("image/")) {
        const n = parseInt(match[1] ?? "0", 10);
        stripFileRef.current = file;
        setStripDialog({
          fileName: file.name,
          detectedN: n,
          frameCount: String(n),
          objectUrl: URL.createObjectURL(file),
          size: file.size,
        });
        e.target.value = "";
        return;
      }
      toImport.push(file);
    }
    for (const file of toImport) {
      addAsset({
        id: `ast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: guessAssetType(file),
        path: `assets/${file.name}`,
        size: file.size,
      });
    }
    e.target.value = "";
  };

  const confirmStripImport = (): void => {
    if (stripDialog === null) return;
    const n = parseInt(stripDialog.frameCount, 10);
    if (isNaN(n) || n < 1) return;
    addAsset({
      id: `ast-${Date.now()}`,
      name: stripDialog.fileName,
      type: "image",
      path: `assets/${stripDialog.fileName}`,
      size: stripDialog.size,
    });
    URL.revokeObjectURL(stripDialog.objectUrl);
    stripFileRef.current = null;
    setStripDialog(null);
  };

  const cancelStripImport = (): void => {
    if (stripDialog !== null) URL.revokeObjectURL(stripDialog.objectUrl);
    setStripDialog(null);
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
          placeholder="Search assets…"
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
          title="Import asset"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={11} />
          Import
        </Button>
        {"showDirectoryPicker" in window ? (
          <Button
            variant="ghost"
            size="sm"
            title="Import GMS2 Project"
            onClick={() => {
              type WindowWithDirPicker = Window & {
                showDirectoryPicker(opts?: {
                  mode?: "read" | "readwrite";
                }): Promise<FileSystemDirectoryHandle>;
              };
              void (window as unknown as WindowWithDirPicker)
                .showDirectoryPicker({ mode: "read" })
                .then((handle) => importGMS2FromHandle(handle));
            }}
          >
            <PackageOpen size={11} />
            Import GMS2 Project
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled
            title="Requires a Chromium-based browser"
          >
            <PackageOpen size={11} />
            Import GMS2 Project
          </Button>
        )}
      </div>

      {/* Asset grid */}
      <div
        className="flex-1 overflow-y-auto p-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: 6,
          alignContent: "start",
        }}
      >
        {filtered.map((asset) => (
          <button
            key={asset.id}
            onClick={() =>
              setSelectedId((id) => (id === asset.id ? null : asset.id))
            }
            onMouseEnter={(e) => {
              if (
                IMAGE_EXTS.some((ext) => asset.path.toLowerCase().endsWith(ext))
              ) {
                setHover({ path: asset.path, x: e.clientX, y: e.clientY });
              }
            }}
            onMouseLeave={() => setHover(null)}
            className="flex flex-col items-center gap-1 p-2 rounded text-center transition-colors"
            style={{
              background:
                selectedId === asset.id
                  ? "rgba(124,106,247,0.15)"
                  : "var(--es-surface-2)",
              border: `1px solid ${selectedId === asset.id ? "var(--es-accent)" : "var(--es-border)"}`,
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

      {/* Image hover preview tooltip */}
      {hover !== null &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              left: hover.x + 16,
              top: Math.min(hover.y, window.innerHeight - 220),
              zIndex: 9999,
              background: "rgba(20,20,20,0.92)",
              borderRadius: 8,
              padding: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
          >
            <img
              src={hover.path}
              alt=""
              style={{
                maxWidth: 200,
                maxHeight: 200,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>,
          document.body,
        )}

      {/* Sprite sheet strip import dialog */}
      {stripDialog !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelStripImport();
          }}
        >
          <div
            style={{
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 10,
              width: 400,
              maxWidth: "calc(100vw - 32px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--es-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Grid size={14} style={{ color: "var(--es-accent)" }} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--es-text)",
                  }}
                >
                  Import Sprite Sheet
                </span>
              </div>
              <button
                onClick={cancelStripImport}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--es-text-muted)",
                  display: "flex",
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--es-text-muted)",
                  fontFamily: "JetBrains Mono, monospace",
                  wordBreak: "break-all",
                }}
              >
                {stripDialog.fileName}
                <span style={{ marginLeft: 8, opacity: 0.6 }}>
                  {formatSize(stripDialog.size)}
                </span>
              </div>

              {/* Preview */}
              <div
                style={{
                  borderRadius: 6,
                  overflow: "hidden",
                  border: "1px solid var(--es-border)",
                  background: "#0e0e10",
                  maxHeight: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={stripDialog.objectUrl}
                  alt="strip preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 120,
                    objectFit: "contain",
                    imageRendering: "pixelated",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--es-text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Frame count
                </label>
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={stripDialog.frameCount}
                  onChange={(e) =>
                    setStripDialog((d) =>
                      d === null ? null : { ...d, frameCount: e.target.value },
                    )
                  }
                  style={{
                    flex: 1,
                    background: "var(--es-bg)",
                    border: "1px solid var(--es-border)",
                    borderRadius: 5,
                    color: "var(--es-text)",
                    fontSize: 12,
                    padding: "4px 8px",
                    outline: "none",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                />
                {stripDialog.detectedN > 0 && (
                  <span style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
                    detected: {stripDialog.detectedN}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "var(--es-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                Frames are read left-to-right from a single horizontal strip.
                Set the frame count manually if the filename detection was
                incorrect.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "10px 16px",
                borderTop: "1px solid var(--es-border)",
              }}
            >
              <Button variant="ghost" size="sm" onClick={cancelStripImport}>
                Cancel
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={confirmStripImport}
                disabled={
                  isNaN(parseInt(stripDialog.frameCount, 10)) ||
                  parseInt(stripDialog.frameCount, 10) < 1
                }
              >
                <Grid size={11} />
                Import Strip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
