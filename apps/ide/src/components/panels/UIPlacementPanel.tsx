import React from "react";
import { useIDEStore } from "../../store/ideStore";
import {
  drawGrid,
  drawRulers,
  drawGuides,
  computeAlignmentGuides,
  snapPoint,
  getRulerMetrics,
  type GuideLineData,
} from "../../lib/editorGrid";

type UIComponentType = "panel" | "button" | "text" | "progress-bar" | "slider" | "toggle";
type UIAnchor =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

/** Default size of each component type on the canvas preview */
const COMPONENT_SIZE: Record<UIComponentType, { w: number; h: number }> = {
  "panel":        { w: 200, h: 120 },
  "button":       { w: 120, h: 36 },
  "text":         { w: 80,  h: 20 },
  "progress-bar": { w: 200, h: 20 },
  "slider":       { w: 160, h: 24 },
  "toggle":       { w: 40,  h: 24 },
};

const COMPONENT_TEMPLATES: Array<{
  type: UIComponentType;
  label: string;
  defaultCode: (anchor: UIAnchor, x: number, y: number) => string;
}> = [
  {
    type: "panel",
    label: "Panel",
    defaultCode: (a, x, y) =>
      `const panel = UISystem.create('panel', {\n  x: ${x}, y: ${y}, width: 200, height: 120,\n  anchor: '${a}',\n  style: { backgroundColor: 0x1a1a2e, opacity: 0.9 },\n});`,
  },
  {
    type: "button",
    label: "Button",
    defaultCode: (a, x, y) =>
      `const btn = UISystem.create('button', {\n  x: ${x}, y: ${y}, width: 120, height: 36,\n  text: 'Button',\n  anchor: '${a}',\n  style: { backgroundColor: 0x3c2d6e },\n});\nbtn.setHoverStyle({ backgroundColor: 0x5c4da0 });\nbtn.onClick(() => { /* TODO */ });`,
  },
  {
    type: "text",
    label: "Text",
    defaultCode: (a, x, y) =>
      `const label = UISystem.create('text', {\n  x: ${x}, y: ${y},\n  text: 'Label',\n  anchor: '${a}',\n  style: { color: 0xffffff, fontSize: 16 },\n});`,
  },
  {
    type: "progress-bar",
    label: "Progress Bar",
    defaultCode: (a, x, y) =>
      `const bar = UISystem.create('progress-bar', {\n  x: ${x}, y: ${y}, width: 200, height: 20,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x4ade80 },\n});\nbar.value = 0.75; // 0..1`,
  },
  {
    type: "slider",
    label: "Slider",
    defaultCode: (a, x, y) =>
      `const slider = UISystem.create('slider', {\n  x: ${x}, y: ${y}, width: 160, height: 24,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x60a5fa },\n});\nslider.value = 0.5;`,
  },
  {
    type: "toggle",
    label: "Toggle",
    defaultCode: (a, x, y) =>
      `const toggle = UISystem.create('toggle', {\n  x: ${x}, y: ${y}, width: 40, height: 24,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x4ade80 },\n});\ntoggle.checked = false;`,
  },
];

const ANCHORS: UIAnchor[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

const ANCHOR_GRID_POS: Record<UIAnchor, { col: number; row: number }> = {
  "top-left":      { col: 0, row: 0 }, "top-center":    { col: 1, row: 0 }, "top-right":     { col: 2, row: 0 },
  "middle-left":   { col: 0, row: 1 }, "middle-center": { col: 1, row: 1 }, "middle-right":  { col: 2, row: 1 },
  "bottom-left":   { col: 0, row: 2 }, "bottom-center": { col: 1, row: 2 }, "bottom-right":  { col: 2, row: 2 },
};

/** Preview canvas logical size (world units = screen pixels at zoom 1) */
const CANVAS_W = 480;
const CANVAS_H = 270;

interface PlacedComponent {
  type: UIComponentType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Convert a canvas-element mouse event to world coords, accounting for rulers */
function canvasEventToWorld(
  e: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  rulerSize: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  return { x: Math.round(px - rulerSize), y: Math.round(py - rulerSize) };
}

export function UIPlacementPanel(): React.ReactElement {
  const setEditorCode = useIDEStore((s) => s.setEditorCode);
  const editorCode = useIDEStore((s) => s.editorCode);
  const addLog = useIDEStore((s) => s.addLog);

  const editorGridSize   = useIDEStore((s) => s.editorGridSize);
  const editorShowGrid   = useIDEStore((s) => s.editorShowGrid);
  const editorShowRuler  = useIDEStore((s) => s.editorShowRuler);
  const editorSnapToGrid = useIDEStore((s) => s.editorSnapToGrid);
  const editorShowGuides = useIDEStore((s) => s.editorShowGuides);

  const setEditorGridSize   = useIDEStore((s) => s.setEditorGridSize);
  const setEditorShowGrid   = useIDEStore((s) => s.setEditorShowGrid);
  const setEditorShowRuler  = useIDEStore((s) => s.setEditorShowRuler);
  const setEditorSnapToGrid = useIDEStore((s) => s.setEditorSnapToGrid);

  const [selectedAnchor, setSelectedAnchor] = React.useState<UIAnchor>("bottom-center");
  const [selectedType, setSelectedType] = React.useState<UIComponentType>("button");
  const [offsetX, setOffsetX] = React.useState(0);
  const [offsetY, setOffsetY] = React.useState(-20);
  const [copied, setCopied] = React.useState<string | null>(null);

  // Canvas preview state
  const [ghostPos, setGhostPos] = React.useState<{ x: number; y: number } | null>(null);
  const [placedComponents, setPlacedComponents] = React.useState<PlacedComponent[]>([]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const { rulerSize } = getRulerMetrics();
  const R = editorShowRuler ? rulerSize : 0;

  // --- Drawing ---
  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Background — dark game viewport
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, cw, ch);

    // Viewport content area (inside ruler offset)
    ctx.fillStyle = "#12122a";
    ctx.fillRect(R, R, cw - R, ch - R);

    const gridOpts = {
      gridSize: editorGridSize,
      showGrid: editorShowGrid,
      showRuler: editorShowRuler,
      snapToGrid: editorSnapToGrid,
      showGuides: editorShowGuides,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
    };

    // Clip drawing to viewport area so grid lines don't overdraw rulers
    ctx.save();
    ctx.beginPath();
    ctx.rect(R, R, cw - R, ch - R);
    ctx.clip();

    // Grid (relative to viewport origin)
    drawGrid(ctx, cw, ch, { ...gridOpts, showRuler: false });

    // Placed components
    for (const comp of placedComponents) {
      ctx.fillStyle = "rgba(96,100,255,0.35)";
      ctx.strokeStyle = "rgba(96,100,255,0.8)";
      ctx.lineWidth = 1;
      ctx.fillRect(R + comp.x, R + comp.y, comp.w, comp.h);
      ctx.strokeRect(R + comp.x + 0.5, R + comp.y + 0.5, comp.w, comp.h);
      ctx.fillStyle = "rgba(180,180,255,0.9)";
      ctx.font = "9px monospace";
      ctx.fillText(comp.type, R + comp.x + 4, R + comp.y + 12);
    }

    // Alignment guides (when ghost is present)
    let activeGuides: GuideLineData[] = [];
    if (ghostPos !== null && editorShowGuides && placedComponents.length > 0) {
      const sz = COMPONENT_SIZE[selectedType];
      const ghostLeft  = R + ghostPos.x;
      const ghostRight = ghostLeft + sz.w;
      const ghostTop   = R + ghostPos.y;
      const ghostBot   = ghostTop + sz.h;
      const ghostCx    = (ghostLeft + ghostRight) / 2;
      const ghostCy    = (ghostTop + ghostBot) / 2;

      const refX: number[] = [];
      const refY: number[] = [];
      for (const c of placedComponents) {
        refX.push(R + c.x, R + c.x + c.w / 2, R + c.x + c.w);
        refY.push(R + c.y, R + c.y + c.h / 2, R + c.y + c.h);
      }

      const alignGuides = computeAlignmentGuides(
        { left: ghostLeft, right: ghostRight, top: ghostTop, bottom: ghostBot, cx: ghostCx, cy: ghostCy },
        { x: refX, y: refY },
      );

      // Convert AlignGuide (canvas px) to GuideLineData (world coords used by drawGuides)
      activeGuides = alignGuides.map((g) => ({
        axis: g.axis,
        position: g.axis === "x" ? g.canvasPx - R : g.canvasPx - R,
      }));

      drawGuides(ctx, cw, ch, activeGuides, { ...gridOpts, showGuides: true });
    }

    // Ghost preview
    if (ghostPos !== null) {
      const sz = COMPONENT_SIZE[selectedType];
      ctx.fillStyle = "rgba(100,180,255,0.25)";
      ctx.strokeStyle = "rgba(100,180,255,0.9)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(R + ghostPos.x, R + ghostPos.y, sz.w, sz.h);
      ctx.strokeRect(R + ghostPos.x + 0.5, R + ghostPos.y + 0.5, sz.w, sz.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(180,220,255,0.85)";
      ctx.font = "9px monospace";
      ctx.fillText(selectedType, R + ghostPos.x + 4, R + ghostPos.y + 12);
    }

    ctx.restore();

    // Rulers on top (not clipped)
    drawRulers(ctx, cw, ch, gridOpts);
  }, [
    editorGridSize, editorShowGrid, editorShowRuler, editorSnapToGrid, editorShowGuides,
    ghostPos, placedComponents, selectedType, R,
  ]);

  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // --- Mouse handlers ---
  const resolveWorldPos = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (canvas === null) return null;
      const raw = canvasEventToWorld(e, canvas, R);
      if (raw.x < 0 || raw.y < 0 || raw.x > CANVAS_W || raw.y > CANVAS_H) return null;
      if (editorSnapToGrid) {
        return snapPoint(raw.x, raw.y, editorGridSize);
      }
      return raw;
    },
    [R, editorSnapToGrid, editorGridSize],
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const pos = resolveWorldPos(e);
    setGhostPos(pos);
  };

  const handleMouseLeave = (): void => {
    setGhostPos(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const pos = resolveWorldPos(e);
    if (pos === null) return;
    const sz = COMPONENT_SIZE[selectedType];
    setPlacedComponents((prev) => [
      ...prev,
      { type: selectedType, x: pos.x, y: pos.y, w: sz.w, h: sz.h },
    ]);
    setOffsetX(pos.x);
    setOffsetY(pos.y);
    addLog("info", `Placed ${selectedType} at (${pos.x}, ${pos.y}) on UIPlacementPanel canvas`);
  };

  // --- Snippet helpers (unchanged from original) ---
  const insertSnippet = (tmpl: typeof COMPONENT_TEMPLATES[0]): void => {
    const code = tmpl.defaultCode(selectedAnchor, offsetX, offsetY);
    const existing = editorCode.trim();
    const insertion = `\n// UISystem component: ${tmpl.label}\n${code}\n`;
    setEditorCode(existing + insertion);
    addLog("info", `Inserted UISystem.create('${tmpl.type}') snippet into editor`);
    setCopied(tmpl.type);
    setTimeout(() => setCopied(null), 1200);
  };

  const copySnippet = (tmpl: typeof COMPONENT_TEMPLATES[0]): void => {
    const code = tmpl.defaultCode(selectedAnchor, offsetX, offsetY);
    navigator.clipboard.writeText(code).catch(() => { /* ignore */ });
    setCopied(tmpl.type + "-copy");
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--es-bg)", color: "var(--es-text)", fontSize: 12, overflow: "auto" }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--es-border)", fontWeight: 600, color: "var(--es-text-muted)" }}>
        UI Placement
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid var(--es-border)", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Grid size
          <input
            type="number"
            value={editorGridSize}
            min={4}
            max={128}
            onChange={(e) => setEditorGridSize(Number(e.target.value))}
            style={{ width: 48, padding: "2px 4px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 3 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={editorShowGrid} onChange={(e) => setEditorShowGrid(e.target.checked)} />
          Grid
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={editorShowRuler} onChange={(e) => setEditorShowRuler(e.target.checked)} />
          Ruler
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={editorSnapToGrid} onChange={(e) => setEditorSnapToGrid(e.target.checked)} />
          Snap
        </label>
        <button
          onClick={() => setPlacedComponents([])}
          title="Clear all placed components from canvas"
          style={{ padding: "2px 8px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 3, cursor: "pointer" }}
        >
          Clear
        </button>
      </div>

      {/* Component type selector */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--es-border)" }}>
        <div style={{ marginBottom: 4, color: "var(--es-text-muted)" }}>Place type</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {COMPONENT_TEMPLATES.map((t) => (
            <button
              key={t.type}
              onClick={() => setSelectedType(t.type)}
              style={{
                padding: "3px 8px",
                background: selectedType === t.type ? "var(--es-accent)" : "var(--es-surface)",
                color: "var(--es-text)",
                border: "1px solid var(--es-border)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas preview */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--es-border)" }}>
        <div style={{ marginBottom: 4, color: "var(--es-text-muted)" }}>
          Canvas preview — click to place&nbsp;
          <span style={{ color: "var(--es-text)" }}>{selectedType}</span>
          {editorSnapToGrid ? " (snap on)" : ""}
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_W + (editorShowRuler ? rulerSize : 0)}
          height={CANVAS_H + (editorShowRuler ? rulerSize : 0)}
          style={{ display: "block", width: "100%", cursor: "crosshair", border: "1px solid var(--es-border)", borderRadius: 4, imageRendering: "pixelated" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
        />
        <div style={{ marginTop: 4, color: "var(--es-text-muted)", fontSize: 10 }}>
          {ghostPos !== null
            ? `cursor: (${ghostPos.x}, ${ghostPos.y})`
            : `placed: ${placedComponents.length} component${placedComponents.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Anchor picker */}
      <div style={{ padding: "10px 10px 6px" }}>
        <div style={{ marginBottom: 6, color: "var(--es-text-muted)" }}>Anchor</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 28px)", gap: 3, marginBottom: 10 }}>
          {ANCHORS.map((a) => {
            const pos = ANCHOR_GRID_POS[a];
            return (
              <div
                key={a}
                title={a}
                onClick={() => setSelectedAnchor(a)}
                style={{
                  gridColumn: pos.col + 1,
                  gridRow: pos.row + 1,
                  width: 28,
                  height: 28,
                  background: selectedAnchor === a ? "var(--es-accent)" : "var(--es-surface)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                }}
              >
                {a.split("-").map((w) => w[0]?.toUpperCase() ?? "").join("")}
              </div>
            );
          })}
        </div>
        <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>Selected: <strong>{selectedAnchor}</strong></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <label style={{ flex: 1 }}>
            X offset
            <input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} style={{ width: "100%", marginTop: 2, padding: "3px 6px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Y offset
            <input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} style={{ width: "100%", marginTop: 2, padding: "3px 6px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          </label>
        </div>
      </div>

      {/* Component palette */}
      <div style={{ padding: "0 10px 10px" }}>
        <div style={{ marginBottom: 6, color: "var(--es-text-muted)" }}>Components</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {COMPONENT_TEMPLATES.map((tmpl) => (
            <div key={tmpl.type} style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => insertSnippet(tmpl)}
                title={`Insert ${tmpl.label} snippet into editor`}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: copied === tmpl.type ? "#16a34a" : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                {copied === tmpl.type ? "✓ Inserted" : `＋ ${tmpl.label}`}
              </button>
              <button
                onClick={() => copySnippet(tmpl)}
                title="Copy snippet to clipboard"
                style={{
                  padding: "6px 8px",
                  background: copied === tmpl.type + "-copy" ? "#16a34a" : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {copied === tmpl.type + "-copy" ? "✓" : "⧉"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 10px 10px", color: "var(--es-text-muted)", fontSize: 11 }}>
        Click <strong>＋</strong> to insert a snippet at the end of your code file, or <strong>⧉</strong> to copy to clipboard.
        Anchor and offset are reflected in the generated code. Click the canvas to set the x/y offset directly.
      </div>
    </div>
  );
}
