import React from "react";

type Tool = "paint" | "erase" | "fill";

interface TileLayer {
  id: string;
  name: string;
  data: Record<string, number>; // "col,row" -> tileIndex
}

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

export function TilemapEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [tileSize, setTileSize] = React.useState(32);
  const [activeTile, setActiveTile] = React.useState(0);
  const [tool, setTool] = React.useState<Tool>("paint");
  const [layers, setLayers] = React.useState<TileLayer[]>([
    { id: "layer-0", name: "Ground", data: {} },
    { id: "layer-1", name: "Objects", data: {} },
  ]);
  const [activeLayer, setActiveLayer] = React.useState("layer-0");
  const [isPainting, setIsPainting] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);

  const getCell = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { col: number; row: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { col: 0, row: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) };
  };

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
      if (queue.length > 10000) break; // safety
    }
    return filled;
  };

  const applyTool = (col: number, row: number): void => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== activeLayer) return layer;
        const key = `${col},${row}`;
        let newData = { ...layer.data };
        if (tool === "paint") newData[key] = activeTile;
        else if (tool === "erase") {
          delete newData[key];
        } else if (tool === "fill")
          newData = floodFill(newData, col, row, activeTile);
        return { ...layer, data: newData };
      }),
    );
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= canvas.width / tileSize; c++) {
      ctx.beginPath();
      ctx.moveTo(c * tileSize, 0);
      ctx.lineTo(c * tileSize, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= canvas.height / tileSize; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * tileSize);
      ctx.lineTo(canvas.width, r * tileSize);
      ctx.stroke();
    }

    // Tiles
    for (const layer of layers) {
      for (const [key, tileIdx] of Object.entries(layer.data)) {
        const parts = key.split(",");
        const c = Number(parts[0] ?? "0");
        const r = Number(parts[1] ?? "0");
        ctx.fillStyle =
          PALETTE_COLORS[tileIdx % PALETTE_COLORS.length] ?? "transparent";
        ctx.fillRect(
          c * tileSize + 1,
          r * tileSize + 1,
          tileSize - 2,
          tileSize - 2,
        );
      }
    }
    ctx.restore();
  }, [layers, tileSize, zoom]);

  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(4, z - e.deltaY * 0.001)));
  };

  const tools: { id: Tool; label: string }[] = [
    { id: "paint", label: "Paint" },
    { id: "erase", label: "Erase" },
    { id: "fill", label: "Fill" },
  ];

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
            Tile Size: {tileSize}px
          </div>
          <input
            type="range"
            min={8}
            max={64}
            value={tileSize}
            onChange={(e) => setTileSize(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
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
            onClick={() =>
              setLayers((prev) => [
                ...prev,
                {
                  id: `layer-${Date.now()}`,
                  name: `Layer ${prev.length}`,
                  data: {},
                },
              ])
            }
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
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={1600}
          height={1200}
          style={{
            display: "block",
            cursor: tool === "erase" ? "cell" : "crosshair",
          }}
          onMouseDown={(e) => {
            setIsPainting(true);
            applyTool(...(Object.values(getCell(e)) as [number, number]));
          }}
          onMouseMove={(e) => {
            if (isPainting)
              applyTool(...(Object.values(getCell(e)) as [number, number]));
          }}
          onMouseUp={() => setIsPainting(false)}
          onMouseLeave={() => setIsPainting(false)}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
