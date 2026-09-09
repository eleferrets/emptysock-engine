import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import {
  drawGrid,
  drawRulers,
  drawGuides,
  computeAlignmentGuides,
  snapPoint,
  getRulerMetrics,
  type GuideLineData,
} from "../../lib/editorGrid";

type WidgetType =
  | "panel"
  | "button"
  | "label"
  | "progress-bar"
  | "slider"
  | "checkbox"
  | "image";

type WidgetAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

const WIDGET_SIZE: Record<WidgetType, { w: number; h: number }> = {
  panel: { w: 200, h: 120 },
  button: { w: 120, h: 36 },
  label: { w: 80, h: 20 },
  "progress-bar": { w: 200, h: 20 },
  slider: { w: 160, h: 24 },
  checkbox: { w: 140, h: 22 },
  image: { w: 64, h: 64 },
};

const WIDGET_LABEL: Record<WidgetType, string> = {
  panel: "PanelWidget",
  button: "ButtonWidget",
  label: "LabelWidget",
  "progress-bar": "ProgressBarWidget",
  slider: "SliderWidget",
  checkbox: "CheckboxWidget",
  image: "ImageWidget",
};

const WIDGET_SNIPPET: Record<
  WidgetType,
  (anchor: WidgetAnchor, x: number, y: number) => string
> = {
  panel: (a, x, y) =>
    `const panel = new PanelWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 200, height: 120 });\nthis.uiSystem.add(panel);`,
  button: (a, x, y) =>
    `const btn = new ButtonWidget({ label: 'Button', anchor: '${a}', x: ${x}, y: ${y}, width: 120, height: 36 });\nbtn.on('click', () => { /* TODO */ });\nthis.uiSystem.add(btn);`,
  label: (a, x, y) =>
    `const lbl = new LabelWidget({ text: 'Label', anchor: '${a}', x: ${x}, y: ${y}, fontSize: 16 });\nthis.uiSystem.add(lbl);`,
  "progress-bar": (a, x, y) =>
    `const bar = new ProgressBarWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 200, height: 20, value: 0.75, min: 0, max: 1, fillColor: '#4ade80' });\nthis.uiSystem.add(bar);`,
  slider: (a, x, y) =>
    `const slider = new SliderWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 160, value: 0.5, min: 0, max: 1, onChange: (v) => { /* TODO */ } });\nthis.uiSystem.add(slider);`,
  checkbox: (a, x, y) =>
    `const chk = new CheckboxWidget({ label: 'Option', anchor: '${a}', x: ${x}, y: ${y}, checked: false, onChange: (v) => { /* TODO */ } });\nthis.uiSystem.add(chk);`,
  image: (a, x, y) =>
    `const img = new ImageWidget({ src: 'assets/image.png', anchor: '${a}', x: ${x}, y: ${y}, width: 64, height: 64 });\nthis.uiSystem.add(img);`,
};

const ANCHORS: WidgetAnchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

const ANCHOR_GRID_POS: Record<WidgetAnchor, { col: number; row: number }> = {
  "top-left": { col: 0, row: 0 },
  top: { col: 1, row: 0 },
  "top-right": { col: 2, row: 0 },
  left: { col: 0, row: 1 },
  center: { col: 1, row: 1 },
  right: { col: 2, row: 1 },
  "bottom-left": { col: 0, row: 2 },
  bottom: { col: 1, row: 2 },
  "bottom-right": { col: 2, row: 2 },
};

/** Preview canvas logical size */
const CANVAS_W = 480;
const CANVAS_H = 270;

let _nextId = 1;
function nextId(): string {
  return `w${_nextId++}`;
}

interface PlacedWidget {
  id: string;
  type: WidgetType;
  anchor: WidgetAnchor;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

function getClientPos(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
): { clientX: number; clientY: number } {
  if ("touches" in e) {
    const t = e.type === "touchend" ? e.changedTouches[0] : e.touches[0];
    return { clientX: t?.clientX ?? 0, clientY: t?.clientY ?? 0 };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

function canvasEventToWorld(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  rulerSize: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const { clientX, clientY } = getClientPos(e);
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  return { x: Math.round(px - rulerSize), y: Math.round(py - rulerSize) };
}

const QUIPS = [
  "No widgets yet — drag one from the palette.",
  "Blank canvas. Your UI awaits.",
  "Empty. Drag something in.",
  "Nothing placed. That's a choice.",
  "The palette is right there.",
  "No widgets yet — drag one from the palette.",
];

export function UIPlacementPanel(): React.ReactElement {
  const setEditorCode = useIDEStore((s) => s.setEditorCode);
  const editorCode = useIDEStore((s) => s.editorCode);
  const addLog = useIDEStore((s) => s.addLog);

  const editorGridSize = useIDEStore((s) => s.editorGridSize);
  const editorShowGrid = useIDEStore((s) => s.editorShowGrid);
  const editorShowRuler = useIDEStore((s) => s.editorShowRuler);
  const editorSnapToGrid = useIDEStore((s) => s.editorSnapToGrid);
  const editorShowGuides = useIDEStore((s) => s.editorShowGuides);

  const setEditorGridSize = useIDEStore((s) => s.setEditorGridSize);
  const setEditorShowGrid = useIDEStore((s) => s.setEditorShowGrid);
  const setEditorShowRuler = useIDEStore((s) => s.setEditorShowRuler);
  const setEditorSnapToGrid = useIDEStore((s) => s.setEditorSnapToGrid);

  const quipRef = React.useRef(QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const [selectedAnchor, setSelectedAnchor] =
    React.useState<WidgetAnchor>("center");
  const [dragType, setDragType] = React.useState<WidgetType | null>(null);
  const [ghostPos, setGhostPos] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const {
    state: widgets,
    set: setWidgets,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<PlacedWidget[]>([]);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId !== null) {
          setWidgets((prev) => prev.filter((w) => w.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedId, setWidgets]);

  const { rulerSize } = getRulerMetrics();
  const R = editorShowRuler ? rulerSize : 0;

  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, cw, ch);
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

    ctx.save();
    ctx.beginPath();
    ctx.rect(R, R, cw - R, ch - R);
    ctx.clip();

    drawGrid(ctx, cw, ch, { ...gridOpts, showRuler: false });

    for (const w of widgets) {
      const isSelected = w.id === selectedId;
      ctx.fillStyle = isSelected
        ? "rgba(124,106,247,0.4)"
        : "rgba(96,100,255,0.25)";
      ctx.strokeStyle = isSelected
        ? "rgba(200,180,255,1)"
        : "rgba(96,100,255,0.8)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(R + w.x, R + w.y, w.w, w.h);
      ctx.strokeRect(R + w.x + 0.5, R + w.y + 0.5, w.w, w.h);
      ctx.fillStyle = isSelected
        ? "rgba(220,210,255,1)"
        : "rgba(180,180,255,0.9)";
      ctx.font = "9px monospace";
      ctx.fillText(w.label || WIDGET_LABEL[w.type], R + w.x + 4, R + w.y + 12);
    }

    let activeGuides: GuideLineData[] = [];
    if (
      ghostPos !== null &&
      editorShowGuides &&
      widgets.length > 0 &&
      dragType !== null
    ) {
      const sz = WIDGET_SIZE[dragType];
      const ghostLeft = R + ghostPos.x;
      const ghostRight = ghostLeft + sz.w;
      const ghostTop = R + ghostPos.y;
      const ghostBot = ghostTop + sz.h;
      const ghostCx = (ghostLeft + ghostRight) / 2;
      const ghostCy = (ghostTop + ghostBot) / 2;

      const refX: number[] = [];
      const refY: number[] = [];
      for (const c of widgets) {
        refX.push(R + c.x, R + c.x + c.w / 2, R + c.x + c.w);
        refY.push(R + c.y, R + c.y + c.h / 2, R + c.y + c.h);
      }

      const alignGuides = computeAlignmentGuides(
        {
          left: ghostLeft,
          right: ghostRight,
          top: ghostTop,
          bottom: ghostBot,
          cx: ghostCx,
          cy: ghostCy,
        },
        { x: refX, y: refY },
      );

      activeGuides = alignGuides.map((g) => ({
        axis: g.axis,
        position: g.axis === "x" ? g.canvasPx - R : g.canvasPx - R,
      }));

      drawGuides(ctx, cw, ch, activeGuides, { ...gridOpts, showGuides: true });
    }

    if (ghostPos !== null && dragType !== null) {
      const sz = WIDGET_SIZE[dragType];
      ctx.fillStyle = "rgba(100,180,255,0.25)";
      ctx.strokeStyle = "rgba(100,180,255,0.9)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(R + ghostPos.x, R + ghostPos.y, sz.w, sz.h);
      ctx.strokeRect(R + ghostPos.x + 0.5, R + ghostPos.y + 0.5, sz.w, sz.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(180,220,255,0.85)";
      ctx.font = "9px monospace";
      ctx.fillText(dragType, R + ghostPos.x + 4, R + ghostPos.y + 12);
    }

    ctx.restore();
    drawRulers(ctx, cw, ch, gridOpts);
  }, [
    editorGridSize,
    editorShowGrid,
    editorShowRuler,
    editorSnapToGrid,
    editorShowGuides,
    ghostPos,
    widgets,
    dragType,
    selectedId,
    R,
  ]);

  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const resolveWorldPos = React.useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (canvas === null) return null;
      const raw = canvasEventToWorld(e, canvas, R);
      if (raw.x < 0 || raw.y < 0 || raw.x > CANVAS_W || raw.y > CANVAS_H)
        return null;
      return editorSnapToGrid ? snapPoint(raw.x, raw.y, editorGridSize) : raw;
    },
    [R, editorSnapToGrid, editorGridSize],
  );

  const placeWidget = (
    pos: { x: number; y: number },
    type: WidgetType,
  ): void => {
    const sz = WIDGET_SIZE[type];
    const newWidget: PlacedWidget = {
      id: nextId(),
      type,
      anchor: selectedAnchor,
      x: pos.x,
      y: pos.y,
      w: sz.w,
      h: sz.h,
      label: WIDGET_LABEL[type],
    };
    setWidgets((prev) => [...prev, newWidget]);
    setSelectedId(newWidget.id);
    addLog("info", `Placed ${type} at (${pos.x}, ${pos.y})`);
  };

  const hitTestWidgets = (x: number, y: number): PlacedWidget | null => {
    const reversed = [...widgets].reverse();
    for (const w of reversed) {
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
        return w;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (dragType === null) return;
    const pos = resolveWorldPos(e);
    setGhostPos(pos);
  };

  const handleMouseLeave = (): void => {
    setGhostPos(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const pos = resolveWorldPos(e);
    if (pos === null) return;
    if (dragType !== null) {
      placeWidget(pos, dragType);
    } else {
      const hit = hitTestWidgets(pos.x, pos.y);
      setSelectedId(hit?.id ?? null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>): void => {
    const pos = resolveWorldPos(e);
    if (pos === null) {
      setGhostPos(null);
      return;
    }
    setGhostPos(pos);
    if (dragType !== null) placeWidget(pos, dragType);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>): void => {
    setGhostPos(resolveWorldPos(e));
  };

  const handleTouchEnd = (): void => {
    setGhostPos(null);
  };

  // Drag-and-drop from palette onto canvas
  const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const raw = { x: Math.round(px - R), y: Math.round(py - R) };
    if (raw.x >= 0 && raw.y >= 0 && raw.x <= CANVAS_W && raw.y <= CANVAS_H) {
      setGhostPos(
        editorSnapToGrid ? snapPoint(raw.x, raw.y, editorGridSize) : raw,
      );
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    const typeData = e.dataTransfer.getData("widget-type");
    if (typeData === "") return;
    const type = typeData as WidgetType;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const raw = { x: Math.round(px - R), y: Math.round(py - R) };
    if (raw.x < 0 || raw.y < 0 || raw.x > CANVAS_W || raw.y > CANVAS_H) {
      setGhostPos(null);
      return;
    }
    const pos = editorSnapToGrid
      ? snapPoint(raw.x, raw.y, editorGridSize)
      : raw;
    setDragType(type);
    placeWidget(pos, type);
    setGhostPos(null);
  };

  const handleDragLeave = (): void => {
    setGhostPos(null);
  };

  const insertSnippet = (type: WidgetType, x: number, y: number): void => {
    const snippet = WIDGET_SNIPPET[type](selectedAnchor, x, y);
    const insertion = `\n// ${WIDGET_LABEL[type]}\n${snippet}\n`;
    setEditorCode(editorCode.trim() + insertion);
    addLog("info", `Inserted ${WIDGET_LABEL[type]} snippet into editor`);
    setCopied(type);
    setTimeout(() => setCopied(null), 1200);
  };

  const copySnippet = (type: WidgetType, x: number, y: number): void => {
    const code = WIDGET_SNIPPET[type](selectedAnchor, x, y);
    navigator.clipboard.writeText(code).catch(() => {
      /* ignore */
    });
    setCopied(type + "-copy");
    setTimeout(() => setCopied(null), 1200);
  };

  const selectedWidget = widgets.find((w) => w.id === selectedId) ?? null;

  const updateSelected = (patch: Partial<PlacedWidget>): void => {
    if (selectedId === null) return;
    setWidgets((prev) =>
      prev.map((w) => (w.id === selectedId ? { ...w, ...patch } : w)),
    );
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    padding: "2px 8px",
    background: active ? "var(--es-accent)" : "var(--es-surface)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 3,
    cursor: "pointer",
    opacity: 1,
  });

  const disabledBtnStyle = (enabled: boolean): React.CSSProperties => ({
    ...btnStyle(),
    opacity: enabled ? 1 : 0.4,
    cursor: enabled ? "pointer" : "default",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "2px 4px",
    background: "var(--es-surface)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 3,
    fontSize: 11,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--es-border)",
          fontWeight: 600,
          color: "var(--es-text-muted)",
          flexShrink: 0,
        }}
      >
        UI Widget Editor
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          borderBottom: "1px solid var(--es-border)",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Grid
          <input
            type="number"
            value={editorGridSize}
            min={4}
            max={128}
            onChange={(e) => setEditorGridSize(Number(e.target.value))}
            style={{
              width: 44,
              padding: "1px 4px",
              background: "var(--es-surface)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 3,
            }}
          />
        </label>
        {(["Grid", "Ruler", "Snap"] as const).map((label) => {
          const checked =
            label === "Grid"
              ? editorShowGrid
              : label === "Ruler"
                ? editorShowRuler
                : editorSnapToGrid;
          const setter =
            label === "Grid"
              ? setEditorShowGrid
              : label === "Ruler"
                ? setEditorShowRuler
                : setEditorSnapToGrid;
          return (
            <label
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setter(e.target.checked)}
              />
              {label}
            </label>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={disabledBtnStyle(canUndo)}
        >
          ↩
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={disabledBtnStyle(canRedo)}
        >
          ↪
        </button>
        <button
          onClick={() => {
            setWidgets([]);
            setSelectedId(null);
          }}
          title="Clear all widgets"
          style={btnStyle()}
        >
          Clear
        </button>
      </div>

      {/* Body: palette | canvas | tree+props */}
      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
      >
        {/* Left: palette */}
        <div
          style={{
            width: 110,
            flexShrink: 0,
            borderRight: "1px solid var(--es-border)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "6px 8px",
              color: "var(--es-text-muted)",
              fontSize: 10,
              fontWeight: 600,
              borderBottom: "1px solid var(--es-border)",
            }}
          >
            PALETTE
          </div>
          <div
            style={{
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {(Object.keys(WIDGET_LABEL) as WidgetType[]).map((type) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("widget-type", type);
                  setDragType(type);
                }}
                onDragEnd={() => setDragType(null)}
                onClick={() =>
                  setDragType((prev) => (prev === type ? null : type))
                }
                title={`Drag onto canvas, or click to select then click canvas`}
                style={{
                  padding: "5px 6px",
                  background:
                    dragType === type
                      ? "var(--es-accent)"
                      : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "grab",
                  fontSize: 11,
                  userSelect: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ opacity: 0.5 }}>⠿</span>
                {WIDGET_LABEL[type].replace("Widget", "")}
              </div>
            ))}
          </div>
          {dragType !== null && (
            <div
              style={{
                padding: "6px 8px",
                color: "var(--es-accent)",
                fontSize: 10,
              }}
            >
              Active: {dragType}
            </div>
          )}
        </div>

        {/* Center: canvas + anchor picker */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "5px 8px",
              borderBottom: "1px solid var(--es-border)",
              color: "var(--es-text-muted)",
              fontSize: 10,
            }}
          >
            {dragType !== null
              ? `Drop or click canvas to place ${dragType}`
              : widgets.length === 0
                ? quipRef.current
                : `${widgets.length} widget${widgets.length !== 1 ? "s" : ""}${selectedId !== null ? " · 1 selected" : ""}`}
          </div>
          <div style={{ padding: 8 }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W + (editorShowRuler ? rulerSize : 0)}
              height={CANVAS_H + (editorShowRuler ? rulerSize : 0)}
              style={{
                display: "block",
                width: "100%",
                cursor: dragType !== null ? "crosshair" : "default",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                imageRendering: "pixelated",
                touchAction: "none",
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleCanvasClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
            />
          </div>

          {/* Anchor picker */}
          <div style={{ padding: "0 8px 8px" }}>
            <div
              style={{
                marginBottom: 5,
                color: "var(--es-text-muted)",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              ANCHOR
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 26px)",
                gap: 2,
                marginBottom: 4,
              }}
            >
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
                      width: 26,
                      height: 26,
                      background:
                        selectedAnchor === a
                          ? "var(--es-accent)"
                          : "var(--es-surface)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 7,
                    }}
                  >
                    {a
                      .split("-")
                      .map((seg) => seg[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                );
              })}
            </div>
            <div style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
              {selectedAnchor}
            </div>
          </div>
        </div>

        {/* Right: widget tree + property panel */}
        <div
          style={{
            width: 160,
            flexShrink: 0,
            borderLeft: "1px solid var(--es-border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Widget tree */}
          <div
            style={{
              padding: "6px 8px",
              color: "var(--es-text-muted)",
              fontSize: 10,
              fontWeight: 600,
              borderBottom: "1px solid var(--es-border)",
            }}
          >
            WIDGET TREE
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 60 }}>
            {widgets.length === 0 ? (
              <div
                style={{
                  padding: "8px",
                  color: "var(--es-text-muted)",
                  fontSize: 10,
                }}
              >
                No widgets yet — drag one from the palette.
              </div>
            ) : (
              <div style={{ padding: "4px 0" }}>
                {widgets.map((w) => (
                  <div
                    key={w.id}
                    onClick={() =>
                      setSelectedId((prev) => (prev === w.id ? null : w.id))
                    }
                    style={{
                      padding: "4px 10px",
                      cursor: "pointer",
                      background:
                        selectedId === w.id
                          ? "var(--es-selection-bg, rgba(124,106,247,0.15))"
                          : "transparent",
                      borderLeft:
                        selectedId === w.id
                          ? "2px solid var(--es-accent)"
                          : "2px solid transparent",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <span style={{ opacity: 0.5, fontSize: 9 }}>▣</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {WIDGET_LABEL[w.type]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Property panel */}
          <div
            style={{ borderTop: "1px solid var(--es-border)", flexShrink: 0 }}
          >
            <div
              style={{
                padding: "6px 8px",
                color: "var(--es-text-muted)",
                fontSize: 10,
                fontWeight: 600,
                borderBottom: "1px solid var(--es-border)",
              }}
            >
              PROPERTIES
            </div>
            {selectedWidget === null ? (
              <div
                style={{
                  padding: 8,
                  color: "var(--es-text-muted)",
                  fontSize: 10,
                }}
              >
                Select a widget to edit.
              </div>
            ) : (
              <div
                style={{
                  padding: "6px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                  {WIDGET_LABEL[selectedWidget.type]}
                </div>
                {(["x", "y", "w", "h"] as const).map((field) => (
                  <label
                    key={field}
                    style={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <span
                      style={{ color: "var(--es-text-muted)", fontSize: 10 }}
                    >
                      {field}
                    </span>
                    <input
                      type="number"
                      value={selectedWidget[field]}
                      onChange={(e) =>
                        updateSelected({ [field]: Number(e.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                ))}
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                    anchor
                  </span>
                  <select
                    value={selectedWidget.anchor}
                    onChange={(e) =>
                      updateSelected({ anchor: e.target.value as WidgetAnchor })
                    }
                    style={inputStyle}
                  >
                    {ANCHORS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button
                    onClick={() =>
                      insertSnippet(
                        selectedWidget.type,
                        selectedWidget.x,
                        selectedWidget.y,
                      )
                    }
                    title="Insert snippet into editor"
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      background:
                        copied === selectedWidget.type
                          ? "var(--es-green)"
                          : "var(--es-surface)",
                      color: "var(--es-text)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {copied === selectedWidget.type ? "✓" : "Insert"}
                  </button>
                  <button
                    onClick={() =>
                      copySnippet(
                        selectedWidget.type,
                        selectedWidget.x,
                        selectedWidget.y,
                      )
                    }
                    title="Copy snippet"
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      background:
                        copied === selectedWidget.type + "-copy"
                          ? "var(--es-green)"
                          : "var(--es-surface)",
                      color: "var(--es-text)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {copied === selectedWidget.type + "-copy" ? "✓" : "Copy"}
                  </button>
                  <button
                    onClick={() => {
                      setWidgets((prev) =>
                        prev.filter((w) => w.id !== selectedId),
                      );
                      setSelectedId(null);
                    }}
                    title="Delete widget (Del)"
                    style={{
                      padding: "4px 6px",
                      background: "var(--es-surface)",
                      color: "var(--es-red)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
