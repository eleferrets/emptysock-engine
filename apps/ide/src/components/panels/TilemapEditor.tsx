import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { drawRulers, getRulerMetrics } from "../../lib/editorGrid";

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

function AutoTileRulesModal(props: { onClose: () => void }): React.ReactElement {
  const ruleSets = useIDEStore((s) => s.autoTileRuleSets);
  const setRuleSets = useIDEStore((s) => s.setAutoTileRuleSets);
  const [baseTile, setBaseTile] = React.useState("0");
  const [mask, setMask] = React.useState("");
  const [variant, setVariant] = React.useState("");

  const addRule = (): void => {
    const base = baseTile.trim();
    const maskNum = parseInt(mask, 10);
    const variantNum = parseInt(variant, 10);
    if (!base || isNaN(maskNum) || isNaN(variantNum)) return;
    const existing = (ruleSets[base] as Array<{ mask: number; tileIndex: number }> | undefined) ?? [];
    const updated = { ...ruleSets, [base]: [...existing, { mask: maskNum, tileIndex: variantNum }] };
    setRuleSets(updated);
    setMask("");
    setVariant("");
  };

  const removeRule = (base: string, idx: number): void => {
    const rules = (ruleSets[base] as Array<{ mask: number; tileIndex: number }> | undefined) ?? [];
    const next = rules.filter((_, i) => i !== idx);
    if (next.length === 0) {
      const { [base]: _removed, ...rest } = ruleSets;
      setRuleSets(rest);
    } else {
      setRuleSets({ ...ruleSets, [base]: next });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--es-surface)", border: "1px solid var(--es-border)", borderRadius: 8, padding: 20, width: 480, maxHeight: "80vh", overflow: "auto", color: "var(--es-text)", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong>Auto-Tile Rules</strong>
          <button onClick={props.onClose} style={{ background: "none", border: "none", color: "var(--es-text)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <p style={{ opacity: 0.6, marginBottom: 12 }}>
          Each rule maps a neighbour bitmask (8-bit: NW|N|NE|W|E|SW|S|SE) to a tile variant index.
          When painting, the engine picks the matching variant automatically.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Base tile #" value={baseTile} onChange={(e) => setBaseTile(e.target.value)} style={{ width: 80, padding: "4px 6px", background: "var(--es-bg)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          <input placeholder="Mask (0–255)" value={mask} onChange={(e) => setMask(e.target.value)} style={{ width: 100, padding: "4px 6px", background: "var(--es-bg)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          <input placeholder="Variant tile #" value={variant} onChange={(e) => setVariant(e.target.value)} style={{ width: 100, padding: "4px 6px", background: "var(--es-bg)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          <button onClick={addRule} style={{ padding: "4px 12px", background: "var(--es-accent)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Add</button>
        </div>
        {Object.entries(ruleSets).map(([base, rules]) => (
          <div key={base} style={{ marginBottom: 8 }}>
            <strong>Base tile {base}</strong>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
              <thead><tr style={{ opacity: 0.6 }}><td>Mask</td><td>Variant tile</td><td></td></tr></thead>
              <tbody>
                {(rules as Array<{ mask: number; tileIndex: number }>).map((r, i) => (
                  <tr key={i}>
                    <td>{r.mask} (0b{r.mask.toString(2).padStart(8, "0")})</td>
                    <td>{r.tileIndex}</td>
                    <td><button onClick={() => removeRule(base, i)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {Object.keys(ruleSets).length === 0 && <p style={{ opacity: 0.4 }}>No rules defined yet.</p>}
      </div>
    </div>
  );
}

export function TilemapEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [activeTile, setActiveTile] = React.useState(0);
  const [tool, setTool] = React.useState<Tool>("paint");
  const [isPainting, setIsPainting] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [showAutoTileRules, setShowAutoTileRules] = React.useState(false);

  const layers = useIDEStore((s) => s.tilemapLayers);
  const activeLayer = useIDEStore((s) => s.tilemapActiveLayer);
  const setLayers = useIDEStore((s) => s.setTilemapLayers);
  const setActiveLayer = useIDEStore((s) => s.setTilemapActiveLayer);

  const tileSize = useIDEStore((s) => s.editorGridSize);
  const setTileSize = useIDEStore((s) => s.setEditorGridSize);
  const showRuler = useIDEStore((s) => s.editorShowRuler);
  const setShowRuler = useIDEStore((s) => s.setEditorShowRuler);

  const { rulerSize } = getRulerMetrics();
  const rulerOffset = showRuler ? rulerSize : 0;

  const getCell = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): { col: number; row: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { col: 0, row: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - rulerOffset;
    const y = (e.clientY - rect.top) / zoom - rulerOffset;
    return {
      col: Math.max(0, Math.floor(x / tileSize)),
      row: Math.max(0, Math.floor(y / tileSize)),
    };
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
    setLayers(
      layers.map((layer) => {
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

    const ro = rulerOffset; // ruler offset in world (unscaled) px

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    const cols = Math.ceil((canvas.width / zoom - ro) / tileSize) + 1;
    const rows = Math.ceil((canvas.height / zoom - ro) / tileSize) + 1;
    for (let c = 0; c <= cols; c++) {
      const x = ro + c * tileSize;
      ctx.beginPath();
      ctx.moveTo(x, ro);
      ctx.lineTo(x, canvas.height / zoom);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = ro + r * tileSize;
      ctx.beginPath();
      ctx.moveTo(ro, y);
      ctx.lineTo(canvas.width / zoom, y);
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
          ro + c * tileSize + 1,
          ro + r * tileSize + 1,
          tileSize - 2,
          tileSize - 2,
        );
      }
    }
    ctx.restore();

    // Rulers drawn last (on top), in canvas pixel space
    drawRulers(ctx, canvas.width, canvas.height, {
      gridSize: tileSize,
      showGrid: true,
      showRuler,
      snapToGrid: true,
      showGuides: false,
      zoom,
    });
  }, [layers, tileSize, zoom, showRuler, rulerOffset]);

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
            Grid Size (px)
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              min={4}
              max={128}
              value={tileSize}
              onChange={(e) => setTileSize(Number(e.target.value))}
              style={{ width: 56, padding: "3px 6px", background: "var(--es-bg)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }}
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
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showRuler}
              onChange={(e) => setShowRuler(e.target.checked)}
            />
            <span>Show Ruler</span>
          </label>
        </div>
        <button
          onClick={() => setShowAutoTileRules(true)}
          style={{ padding: "4px 8px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4, cursor: "pointer", textAlign: "left", width: "100%" }}
        >
          Auto-Tile Rules…
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
            onClick={() =>
              setLayers([
                ...layers,
                {
                  id: `layer-${Date.now()}`,
                  name: `Layer ${layers.length}`,
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
          onTouchStart={(e: React.TouchEvent<HTMLCanvasElement>) => {
            const t0 = e.touches[0];
            if (!t0) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const col = Math.max(0, Math.floor(((t0.clientX - rect.left) / zoom - rulerOffset) / tileSize));
            const row = Math.max(0, Math.floor(((t0.clientY - rect.top) / zoom - rulerOffset) / tileSize));
            setIsPainting(true);
            applyTool(col, row);
          }}
          onTouchMove={(e: React.TouchEvent<HTMLCanvasElement>) => {
            if (!isPainting) return;
            const t0 = e.touches[0];
            if (!t0) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const col = Math.max(0, Math.floor(((t0.clientX - rect.left) / zoom - rulerOffset) / tileSize));
            const row = Math.max(0, Math.floor(((t0.clientY - rect.top) / zoom - rulerOffset) / tileSize));
            applyTool(col, row);
          }}
        />
      </div>
      {showAutoTileRules && <AutoTileRulesModal onClose={() => setShowAutoTileRules(false)} />}
    </div>
  );
}
