import React from "react";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { KonvaEventObject } from "konva/lib/Node";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";

type Tool = "pointer" | "pencil" | "eraser" | "fill";

interface DrawnLine {
  points: number[];
  color: string;
  width: number;
  eraser: boolean;
}

interface AdjustValues {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface ImageEditorProps {
  assetId: string;
}

const TOOLBAR_H = 36;
const ADJUST_W = 160;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  const len = h.length;
  if (len === 3) {
    const c0 = h[0] ?? "0";
    const c1 = h[1] ?? "0";
    const c2 = h[2] ?? "0";
    return [
      parseInt(c0 + c0, 16),
      parseInt(c1 + c1, 16),
      parseInt(c2 + c2, 16),
      255,
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ];
}

function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance = 30,
): void {
  const idx = (x: number, y: number): number => (y * width + x) * 4;
  const si = idx(startX, startY);
  const tr = data[si];
  const tg = data[si + 1];
  const tb = data[si + 2];
  const ta = data[si + 3];
  if (
    tr === fillColor[0] &&
    tg === fillColor[1] &&
    tb === fillColor[2] &&
    ta === fillColor[3]
  )
    return;
  const matches = (i: number): boolean => {
    const dr = (data[i] ?? 0) - (tr ?? 0);
    const dg = (data[i + 1] ?? 0) - (tg ?? 0);
    const db = (data[i + 2] ?? 0) - (tb ?? 0);
    const da = (data[i + 3] ?? 0) - (ta ?? 0);
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
  };
  const stack: Array<[number, number]> = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  visited[startY * width + startX] = 1;
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) break;
    const [x, y] = top;
    const i = idx(x, y);
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];
    const neighbors: Array<[number, number]> = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni] === 1) continue;
      visited[ni] = 1;
      if (matches(idx(nx, ny))) {
        stack.push([nx, ny]);
      }
    }
  }
}

export function ImageEditor({ assetId }: ImageEditorProps): React.ReactElement {
  const assets = useIDEStore((s) => s.assets);
  const addAsset = useIDEStore((s) => s.addAsset);
  const asset = assets.find((a) => a.id === assetId);

  const [stageW, setStageW] = React.useState(600);
  const [stageH, setStageH] = React.useState(400);
  const [htmlImg, setHtmlImg] = React.useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = React.useState(false);
  const [tool, setTool] = React.useState<Tool>("pencil");
  const [color, setColor] = React.useState("#7c6af7");
  const [brushSize, setBrushSize] = React.useState(8);
  const [lines, setLines] = React.useState<DrawnLine[]>([]);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [stageX, setStageX] = React.useState(0);
  const [stageY, setStageY] = React.useState(0);
  const [stageScale, setStageScale] = React.useState(1);
  const [isPanning, setIsPanning] = React.useState(false);
  const [adj, setAdj] = React.useState<AdjustValues>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
  });
  const [saveMsg, setSaveMsg] = React.useState("");

  const stageRef = React.useRef<KonvaStage | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const panStartRef = React.useRef<{
    x: number;
    y: number;
    sx: number;
    sy: number;
  } | null>(null);
  const isUndoRedoRef = React.useRef(false);
  const hasInitHistory = React.useRef(false);

  const {
    state: historyState,
    set: historySet,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<string>("");

  // Resize observer
  React.useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      setStageW(entry.contentRect.width);
      setStageH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load image
  React.useEffect(() => {
    if (asset === undefined) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = (): void => {
      setHtmlImg(img);
      setImgError(false);
    };
    img.onerror = (): void => {
      setImgError(true);
    };
    img.src = asset.path;
  }, [asset]);

  // Init history on first image load
  React.useEffect(() => {
    if (htmlImg === null || hasInitHistory.current) return;
    hasInitHistory.current = true;
    const offscreen = document.createElement("canvas");
    offscreen.width = htmlImg.naturalWidth;
    offscreen.height = htmlImg.naturalHeight;
    const ctx = offscreen.getContext("2d");
    if (ctx === null) return;
    ctx.drawImage(htmlImg, 0, 0);
    const dataUrl = offscreen.toDataURL("image/png");
    historySet(dataUrl);
  }, [htmlImg, historySet]);

  // Apply undo/redo state changes
  React.useEffect(() => {
    if (!isUndoRedoRef.current) return;
    isUndoRedoRef.current = false;
    if (historyState === "") return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = (): void => {
      setHtmlImg(img);
      setLines([]);
    };
    img.src = historyState;
  }, [historyState]);

  // Keyboard undo/redo
  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          isUndoRedoRef.current = true;
          undo();
        } else if (e.key === "z" && e.shiftKey) {
          e.preventDefault();
          isUndoRedoRef.current = true;
          redo();
        } else if (e.key === "y") {
          e.preventDefault();
          isUndoRedoRef.current = true;
          redo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const commitStroke = React.useCallback((): void => {
    const stage = stageRef.current;
    if (stage === null) return;
    const dataUrl = stage.toDataURL();
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = (): void => {
      setHtmlImg(img);
      setLines([]);
      historySet(dataUrl);
    };
    img.src = dataUrl;
  }, [historySet]);

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>): void => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos === undefined || pos === null) return;
    const imgX = (pos.x - stageX) / stageScale;
    const imgY = (pos.y - stageY) / stageScale;

    if (tool === "pointer") {
      setIsPanning(true);
      panStartRef.current = { x: pos.x, y: pos.y, sx: stageX, sy: stageY };
      return;
    }

    if (tool === "fill") {
      const stage = stageRef.current;
      if (stage === null) return;
      const dataUrl = stage.toDataURL();
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = (): void => {
        const offscreen = document.createElement("canvas");
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        const ctx = offscreen.getContext("2d");
        if (ctx === null) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(
          0,
          0,
          offscreen.width,
          offscreen.height,
        );
        const fx = Math.floor(clamp(imgX, 0, offscreen.width - 1));
        const fy = Math.floor(clamp(imgY, 0, offscreen.height - 1));
        floodFill(
          imageData.data,
          offscreen.width,
          offscreen.height,
          fx,
          fy,
          hexToRgba(color),
        );
        ctx.putImageData(imageData, 0, 0);
        const resultUrl = offscreen.toDataURL("image/png");
        const filled = new window.Image();
        filled.crossOrigin = "anonymous";
        filled.onload = (): void => {
          setHtmlImg(filled);
          historySet(resultUrl);
        };
        filled.src = resultUrl;
      };
      img.src = dataUrl;
      return;
    }

    setIsDrawing(true);
    setLines((prev) => [
      ...prev,
      {
        points: [imgX, imgY],
        color: tool === "eraser" ? "#000000" : color,
        width: brushSize,
        eraser: tool === "eraser",
      },
    ]);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>): void => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos === undefined || pos === null) return;
    const imgX = (pos.x - stageX) / stageScale;
    const imgY = (pos.y - stageY) / stageScale;

    if (tool === "pointer" && isPanning && panStartRef.current !== null) {
      const dx = pos.x - panStartRef.current.x;
      const dy = pos.y - panStartRef.current.y;
      setStageX(panStartRef.current.sx + dx);
      setStageY(panStartRef.current.sy + dy);
      return;
    }

    if (!isDrawing) return;
    setLines((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last === undefined) return prev;
      next[next.length - 1] = {
        ...last,
        points: [...last.points, imgX, imgY],
      };
      return next;
    });
  };

  const handleMouseUp = (): void => {
    if (tool === "pointer") {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    commitStroke();
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>): void => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (stage === null) return;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (pointer === null) return;
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = clamp(oldScale * (1 + direction * 0.1), 0.1, 10);
    const mousePointTo = {
      x: (pointer.x - stageX) / oldScale,
      y: (pointer.y - stageY) / oldScale,
    };
    setStageScale(newScale);
    setStageX(pointer.x - mousePointTo.x * newScale);
    setStageY(pointer.y - mousePointTo.y * newScale);
  };

  const applyAdjustments = (): void => {
    if (htmlImg === null) return;
    const offscreen = document.createElement("canvas");
    offscreen.width = htmlImg.naturalWidth;
    offscreen.height = htmlImg.naturalHeight;
    const ctx = offscreen.getContext("2d");
    if (ctx === null) return;
    ctx.drawImage(htmlImg, 0, 0);
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const d = imageData.data;
    const bright = adj.brightness * 2.55;
    const cont = adj.contrast;
    const contFactor = (259 * (cont + 255)) / (255 * (259 - cont));
    const sat = 1 + adj.saturation / 100;
    for (let i = 0; i < d.length; i += 4) {
      let r = (d[i] ?? 0) + bright;
      let g = (d[i + 1] ?? 0) + bright;
      let b = (d[i + 2] ?? 0) + bright;
      r = contFactor * (r - 128) + 128;
      g = contFactor * (g - 128) + 128;
      b = contFactor * (b - 128) + 128;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + sat * (r - gray);
      g = gray + sat * (g - gray);
      b = gray + sat * (b - gray);
      d[i] = clamp(Math.round(r), 0, 255);
      d[i + 1] = clamp(Math.round(g), 0, 255);
      d[i + 2] = clamp(Math.round(b), 0, 255);
    }
    ctx.putImageData(imageData, 0, 0);
    const resultUrl = offscreen.toDataURL("image/png");
    const newImg = new window.Image();
    newImg.crossOrigin = "anonymous";
    newImg.onload = (): void => {
      setHtmlImg(newImg);
      historySet(resultUrl);
    };
    newImg.src = resultUrl;
  };

  const handleSave = (): void => {
    const stage = stageRef.current;
    if (stage === null || asset === undefined) return;
    const dataUrl = stage.toDataURL({ mimeType: "image/png" });
    addAsset({ ...asset, path: dataUrl });
    setSaveMsg("Saved.");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const handleExport = (): void => {
    const stage = stageRef.current;
    if (stage === null) return;
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/core").then(({ invoke }) => {
        if (asset !== undefined) {
          void invoke("reveal_in_files", { path: asset.path }).catch(() => {});
        }
      });
    } else {
      window.open(stage.toDataURL({ mimeType: "image/png" }), "_blank");
    }
  };

  const tools: Array<{ id: Tool; label: string }> = [
    { id: "pointer", label: "Pan" },
    { id: "pencil", label: "Draw" },
    { id: "eraser", label: "Erase" },
    { id: "fill", label: "Fill" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: TOOLBAR_H,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 10px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
          overflowX: "auto",
        }}
      >
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            style={{
              padding: "2px 10px",
              borderRadius: 4,
              border: `1px solid ${
                tool === t.id ? "var(--es-accent)" : "var(--es-border)"
              }`,
              background:
                tool === t.id ? "rgba(124,106,247,0.18)" : "var(--es-surface)",
              color: tool === t.id ? "var(--es-accent)" : "var(--es-text)",
              fontSize: 11,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--es-border)",
            flexShrink: 0,
          }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Brush colour"
          style={{
            width: 24,
            height: 24,
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            background: "none",
          }}
        />
        <input
          type="range"
          min={1}
          max={64}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          title="Brush size"
          style={{ width: 72, flexShrink: 0 }}
        />
        <span
          style={{ fontSize: 10, color: "var(--es-text-muted)", flexShrink: 0 }}
        >
          {brushSize}px
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            isUndoRedoRef.current = true;
            undo();
          }}
          disabled={!canUndo}
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--es-border)",
            background: "var(--es-surface)",
            color: canUndo ? "var(--es-text)" : "var(--es-text-muted)",
            fontSize: 11,
            cursor: canUndo ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          Undo
        </button>
        <button
          onClick={() => {
            isUndoRedoRef.current = true;
            redo();
          }}
          disabled={!canRedo}
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--es-border)",
            background: "var(--es-surface)",
            color: canRedo ? "var(--es-text)" : "var(--es-text-muted)",
            fontSize: 11,
            cursor: canRedo ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          Redo
        </button>
        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--es-border)",
            flexShrink: 0,
          }}
        />
        <button
          onClick={handleSave}
          style={{
            padding: "2px 10px",
            borderRadius: 4,
            border: "1px solid var(--es-border)",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            fontSize: 11,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Save
        </button>
        <button
          onClick={handleExport}
          style={{
            padding: "2px 10px",
            borderRadius: 4,
            border: "1px solid var(--es-border)",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            fontSize: 11,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {"__TAURI_INTERNALS__" in window ? "Reveal" : "Export"}
        </button>
        {saveMsg !== "" && (
          <span
            style={{
              fontSize: 11,
              color: "var(--es-text-muted)",
              flexShrink: 0,
            }}
          >
            {saveMsg}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: "hidden",
            touchAction: "none",
            background:
              "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 16px 16px",
            cursor:
              tool === "pointer"
                ? isPanning
                  ? "grabbing"
                  : "grab"
                : tool === "eraser"
                  ? "cell"
                  : "crosshair",
          }}
        >
          {imgError ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--es-text-muted)",
                fontSize: 13,
              }}
            >
              Image could not be loaded.
            </div>
          ) : (
            <Stage
              ref={stageRef}
              width={stageW}
              height={stageH}
              x={stageX}
              y={stageY}
              scaleX={stageScale}
              scaleY={stageScale}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
            >
              <Layer>
                {htmlImg !== null && <KonvaImage image={htmlImg} x={0} y={0} />}
                {lines.map((line, i) => (
                  <Line
                    key={i}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.width}
                    tension={0}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      line.eraser ? "destination-out" : "source-over"
                    }
                  />
                ))}
              </Layer>
            </Stage>
          )}
        </div>

        {/* Adjustments sidebar */}
        <div
          style={{
            width: ADJUST_W,
            flexShrink: 0,
            borderLeft: "1px solid var(--es-border)",
            background: "var(--es-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "8px 10px 4px",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--es-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid var(--es-border)",
            }}
          >
            Adjustments
          </div>
          {[
            ["brightness", "Brightness", -100, 100] as const,
            ["contrast", "Contrast", -100, 100] as const,
            ["saturation", "Saturation", -100, 100] as const,
          ].map(([key, label, lo, hi]) => (
            <div
              key={key}
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--es-border)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--es-text)",
                }}
              >
                <span>{label}</span>
                <span style={{ color: "var(--es-text-muted)" }}>
                  {adj[key] > 0 ? "+" : ""}
                  {adj[key]}
                </span>
              </div>
              <input
                type="range"
                min={lo}
                max={hi}
                value={adj[key]}
                onChange={(e) =>
                  setAdj((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                style={{ width: "100%" }}
              />
            </div>
          ))}
          <div style={{ padding: "8px 10px" }}>
            <button
              onClick={applyAdjustments}
              style={{
                width: "100%",
                padding: "4px 0",
                borderRadius: 4,
                border: "1px solid var(--es-border)",
                background: "var(--es-surface-2)",
                color: "var(--es-text)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
          <div style={{ padding: "0 10px 8px" }}>
            <button
              onClick={() =>
                setAdj({ brightness: 0, contrast: 0, saturation: 0 })
              }
              style={{
                width: "100%",
                padding: "4px 0",
                borderRadius: 4,
                border: "1px solid var(--es-border)",
                background: "transparent",
                color: "var(--es-text-muted)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
