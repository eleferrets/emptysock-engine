import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { useTilemapStore } from "../../store/tilemapStore";
import { drawRulers, getRulerMetrics } from "../../lib/editorGrid";
import { useHistory } from "../../hooks/useHistory";
import { AutoTileRulesModal } from "../AutoTileRulesModal";
import { ViewControls } from "./shared/ViewControls";

type Tool = "paint" | "erase" | "fill";

const PALETTE_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f87171",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#e879f9",
  "#38bdf8",
  "#94a3b8",
  "#1e293b",
  "#0f172a",
  "#ffffff",
  "#f1f5f9",
  "#7c3aed",
  "#dc2626",
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#be185d",
];

type TilemapLayer = { id: string; name: string; data: Record<string, number> };

export function TilemapEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeTile, setActiveTile] = React.useState(0);
  const [tool, setTool] = React.useState<Tool>("paint");
  const [isPainting, setIsPainting] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [showAutoTileRules, setShowAutoTileRules] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ w: 800, h: 600 });

  // Store refs for layers
  const storeLayers = useTilemapStore((s) => s.tilemapLayers);
  const storeSetLayers = useTilemapStore((s) => s.setTilemapLayers);
  const activeLayer = useTilemapStore((s) => s.tilemapActiveLayer);
  const setActiveLayer = useTilemapStore((s) => s.setTilemapActiveLayer);

  const tileSize = useIDEStore((s) => s.editorGridSize);
  const setTileSize = useIDEStore((s) => s.setEditorGridSize);
  const showRuler = useIDEStore((s) => s.editorShowRuler);
  const showGrid = useIDEStore((s) => s.editorShowGrid);
  const snapToGrid = useIDEStore((s) => s.editorSnapToGrid);

  // History tracks committed layer states (one entry per stroke/fill/layer-op).
  // liveLayers is the fast-update state used during painting; it bypasses history
  // on every pointer move and is committed to history only on pointerup.
  const {
    state: histLayers,
    set: commitToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<TilemapLayer[]>(storeLayers);

  const [liveLayers, setLiveLayers] =
    React.useState<TilemapLayer[]>(storeLayers);
  const liveLayersRef = React.useRef<TilemapLayer[]>(liveLayers);

  // When history changes (undo/redo), sync live layers and store
  const prevHistRef = React.useRef(histLayers);
  React.useEffect(() => {
    if (prevHistRef.current !== histLayers) {
      prevHistRef.current = histLayers;
      liveLayersRef.current = histLayers;
      setLiveLayers(histLayers);
      storeSetLayers(histLayers);
    }
  }, [histLayers, storeSetLayers]);

  // Internal setLayers: updates live state + ref (used during stroke)
  const setLayers = React.useCallback(
    (next: TilemapLayer[]) => {
      liveLayersRef.current = next;
      setLiveLayers(next);
      storeSetLayers(next);
    },
    [storeSetLayers],
  );

  // Commit current live layers to history (one entry per stroke)
  const commitStroke = React.useCallback(() => {
    commitToHistory(liveLayersRef.current);
  }, [commitToHistory]);

  // Immediate commit: for fill, layer add/remove (not strokes)
  const setLayersAndCommit = React.useCallback(
    (next: TilemapLayer[]) => {
      liveLayersRef.current = next;
      setLiveLayers(next);
      storeSetLayers(next);
      commitToHistory(next);
    },
    [storeSetLayers, commitToHistory],
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const layers = liveLayers;

  const { rulerSize } = getRulerMetrics();
  const rulerOffset = showRuler ? rulerSize : 0;

  const floodFill = (
    data: Record<string, number>,
    col: number,
    row: number,
    newTile: number,
  ): Record<string, number> => {
    const key = `${col},${row}`;
    const targetTile = data[key] ?? -1;
    if (targetTile === newTile) return data;
    const filled = { ...data };
    const queue = [[col, row]];
    while (queue.length > 0) {
      const item = queue.pop();
      if (item === undefined) break;
      const c = item[0];
      const r = item[1];
      if (c === undefined || r === undefined) continue;
      const k = `${c},${r}`;
      if ((filled[k] ?? -1) !== targetTile) continue;
      filled[k] = newTile;
      queue.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]);
      if (queue.length > 10000) break;
    }
    return filled;
  };

  const applyTool = (col: number, row: number): void => {
    const isFill = tool === "fill";
    const next = liveLayersRef.current.map((layer) => {
      if (layer.id !== activeLayer) return layer;
      const key = `${col},${row}`;
      let newData = { ...layer.data };
      if (tool === "paint") newData[key] = activeTile;
      else if (tool === "erase") {
        delete newData[key];
      } else if (isFill) {
        newData = floodFill(newData, col, row, activeTile);
        return { ...layer, data: newData };
      }
      return { ...layer, data: newData };
    });
    if (isFill) {
      setLayersAndCommit(next);
    } else {
      setLayers(next);
    }
  };

  // ResizeObserver
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      setCanvasSize({ w: width, h: height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const lw = canvasSize.w;
    const lh = canvasSize.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    ctx.save();
    ctx.scale(zoom, zoom);

    const ro = rulerOffset;

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    const cols = Math.ceil((lw / zoom - ro) / tileSize) + 1;
    const rows = Math.ceil((lh / zoom - ro) / tileSize) + 1;
    for (let c = 0; c <= cols; c++) {
      const x = ro + c * tileSize;
      ctx.beginPath();
      ctx.moveTo(x, ro);
      ctx.lineTo(x, lh / zoom);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = ro + r * tileSize;
      ctx.beginPath();
      ctx.moveTo(ro, y);
      ctx.lineTo(lw / zoom, y);
      ctx.stroke();
    }

    for (const layer of layers) {
      for (const [key, tileIdx] of Object.entries(layer.data)) {
        const parts = key.split(",");
        const c = Number(parts[0] ?? "0");
        const r = Number(parts[1] ?? "0");
        ctx.fillStyle =
          PALETTE_COLORS[tileIdx % PALETTE_COLORS.length] ?? "transparent";
        ctx.fillRect(
          ro + c * tileSize + 1,
          ro + r * tileSize + 1,
          tileSize - 2,
          tileSize - 2,
        );
      }
    }
    ctx.restore();

    drawRulers(ctx, lw, lh, {
      gridSize: tileSize,
      showGrid,
      showRuler,
      snapToGrid,
      showGuides: false,
      zoom,
    });
  }, [
    layers,
    tileSize,
    zoom,
    showGrid,
    showRuler,
    snapToGrid,
    rulerOffset,
    canvasSize,
  ]);

  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    if (e.deltaMode === 2) delta *= 600;

    if (e.ctrlKey || e.metaKey) {
      setZoom((z) => Math.max(0.25, Math.min(4, z * (delta > 0 ? 0.9 : 1.1))));
    }
  };

  const tools: { id: Tool; label: string }[] = [
    { id: "paint", label: "Paint" },
    { id: "erase", label: "Erase" },
    { id: "fill", label: "Fill" },
  ];

  const undoBtnStyle: React.CSSProperties = {
    padding: "3px 8px",
    background: "var(--es-surface)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    cursor: canUndo ? "pointer" : "default",
    opacity: canUndo ? 1 : 0.4,
  };
  const redoBtnStyle: React.CSSProperties = {
    ...undoBtnStyle,
    cursor: canRedo ? "pointer" : "default",
    opacity: canRedo ? 1 : 0.4,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
      }}
    >
      {/* Left panel */}
      <div
        style={{
          width: 180,
          borderRight: "1px solid var(--es-border)",
          display: "flex",
          flexDirection: "column",
          padding: 8,
          gap: 12,
          overflow: "auto",
        }}
      >
        {/* Undo/redo */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={undo}
            disabled={!canUndo}
            style={undoBtnStyle}
            title="Undo (Ctrl+Z)"
          >
            &#x21A9;
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            style={redoBtnStyle}
            title="Redo (Ctrl+Shift+Z)"
          >
            &#x21AA;
          </button>
        </div>
        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Tool
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                style={{
                  padding: "4px 8px",
                  background:
                    tool === t.id ? "var(--es-accent)" : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Grid Size (px)
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              min={4}
              max={128}
              value={tileSize}
              onChange={(e) => setTileSize(Number(e.target.value))}
              style={{
                width: 56,
                padding: "3px 6px",
                background: "var(--es-bg)",
                color: "var(--es-text)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
              }}
            />
            <span style={{ opacity: 0.5 }}>px</span>
          </div>
          <input
            type="range"
            min={4}
            max={128}
            value={tileSize}
            onChange={(e) => setTileSize(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4 }}
          />
        </div>
        <button
          onClick={() => setShowAutoTileRules(true)}
          style={{
            padding: "4px 8px",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
          }}
        >
          Auto-Tile Rules&#x2026;
        </button>
        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Zoom: {(zoom * 100).toFixed(0)}%
          </div>
          <input
            type="range"
            min={25}
            max={400}
            value={zoom * 100}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Palette
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 2,
            }}
          >
            {PALETTE_COLORS.map((color, i) => (
              <div
                key={i}
                onClick={() => setActiveTile(i)}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: color,
                  borderRadius: 2,
                  cursor: "pointer",
                  border:
                    activeTile === i
                      ? "2px solid var(--es-accent)"
                      : "2px solid transparent",
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Layers
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {layers.map((l) => (
              <div
                key={l.id}
                onClick={() => setActiveLayer(l.id)}
                style={{
                  padding: "3px 8px",
                  background:
                    activeLayer === l.id
                      ? "var(--es-accent)"
                      : "var(--es-surface)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {l.name}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const next = [
                ...layers,
                {
                  id: `layer-${Date.now()}`,
                  name: `Layer ${layers.length}`,
                  data: {},
                },
              ];
              setLayersAndCommit(next);
            }}
            style={{
              marginTop: 4,
              width: "100%",
              padding: "3px 0",
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
              cursor: "pointer",
            }}
          >
            + Add Layer
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative" }}
      >
        <ViewControls />
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            cursor: tool === "erase" ? "cell" : "crosshair",
            touchAction: "none",
          }}
          onPointerDown={(e: React.PointerEvent<HTMLCanvasElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const col = Math.max(
              0,
              Math.floor(
                ((e.clientX - rect.left) / zoom - rulerOffset) / tileSize,
              ),
            );
            const row = Math.max(
              0,
              Math.floor(
                ((e.clientY - rect.top) / zoom - rulerOffset) / tileSize,
              ),
            );
            setIsPainting(true);
            applyTool(col, row);
          }}
          onPointerMove={(e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!isPainting) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const col = Math.max(
              0,
              Math.floor(
                ((e.clientX - rect.left) / zoom - rulerOffset) / tileSize,
              ),
            );
            const row = Math.max(
              0,
              Math.floor(
                ((e.clientY - rect.top) / zoom - rulerOffset) / tileSize,
              ),
            );
            applyTool(col, row);
          }}
          onPointerUp={() => {
            if (isPainting && tool !== "fill") {
              commitStroke();
            }
            setIsPainting(false);
          }}
          onPointerCancel={() => {
            if (isPainting && tool !== "fill") {
              commitStroke();
            }
            setIsPainting(false);
          }}
          onWheel={handleWheel}
        />
      </div>
      {showAutoTileRules && (
        <AutoTileRulesModal onClose={() => setShowAutoTileRules(false)} />
      )}
    </div>
  );
}
