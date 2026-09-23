import React from "react";
import { Scene, UISystem, WidgetTree } from "@emptysock/engine/ecs";
import type { IUIRenderer } from "@emptysock/types";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { ViewControls } from "./shared/ViewControls";
import {
  drawGrid,
  drawRulers,
  drawGuides,
  computeAlignmentGuides,
  snapPoint,
  getRulerMetrics,
  type GuideLineData,
} from "../../lib/editorGrid";
import type {
  WidgetAnchor,
  PlacedWidget,
  WidgetType,
} from "./ui-placement/layout";
import {
  WIDGET_LABEL,
  WIDGET_TYPES,
  defaultOpts,
  widgetBounds,
  widgetAnchor,
  layoutToEntities,
  layoutToSnippet,
  widgetToSnippet,
} from "./ui-placement/layout";
import {
  ANCHORS,
  ANCHOR_GRID_POS,
  CANVAS_W,
  CANVAS_H,
  QUIPS,
  nextId,
} from "./ui-placement/constants";
import { PropertyEditor } from "./ui-placement/PropertyEditor";

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
  // Real ECS Scene/WidgetTree/UISystem the preview renders through — never a
  // hand-drawn mockup of what a widget "looks like". `WidgetTree.init()`
  // loads yoga's WASM module asynchronously (see WidgetTree.ts's doc
  // comment), so the preview can't draw anything real until `ready` flips.
  const sceneRef = React.useRef<Scene>(new Scene());
  const treeRef = React.useRef<WidgetTree>(new WidgetTree());
  const uiSystemRef = React.useRef<UISystem | null>(null);
  const previewEntitiesRef = React.useRef<ReturnType<typeof layoutToEntities>>(
    [],
  );
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void treeRef.current.init().then(() => {
      if (cancelled) return;
      uiSystemRef.current = new UISystem(treeRef.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

    // Real preview: rebuild the actual widget-tree entities from the saved
    // layout and render them through the actual ecs UISystem.render() path.
    ctx.save();
    ctx.translate(R, R);
    const uiSystem = uiSystemRef.current;
    if (ready && uiSystem !== null) {
      const scene = sceneRef.current;
      const tree = treeRef.current;
      for (const entity of previewEntitiesRef.current) {
        tree.destroyWidget(scene, entity);
      }
      previewEntitiesRef.current = layoutToEntities(
        scene,
        tree,
        widgets,
        CANVAS_W,
        CANVAS_H,
      );
      tree.layout(scene, CANVAS_W, CANVAS_H);
      uiSystem.render(scene, ctx as unknown as IUIRenderer);
    }

    if (selectedId !== null) {
      const sel = widgets.find((w) => w.id === selectedId);
      if (sel !== undefined) {
        const b = widgetBounds(sel);
        ctx.strokeStyle = "rgba(200,180,255,1)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();

    let activeGuides: GuideLineData[] = [];
    if (
      ghostPos !== null &&
      editorShowGuides &&
      widgets.length > 0 &&
      dragType !== null
    ) {
      const sz = defaultOpts(dragType, selectedAnchor, 0, 0) as {
        width?: number;
        height?: number;
      };
      const w = sz.width ?? 100;
      const h = sz.height ?? 40;
      const ghostLeft = R + ghostPos.x;
      const ghostRight = ghostLeft + w;
      const ghostTop = R + ghostPos.y;
      const ghostBot = ghostTop + h;
      const ghostCx = (ghostLeft + ghostRight) / 2;
      const ghostCy = (ghostTop + ghostBot) / 2;

      const refX: number[] = [];
      const refY: number[] = [];
      for (const c of widgets) {
        const b = widgetBounds(c);
        refX.push(R + b.x, R + b.x + b.w / 2, R + b.x + b.w);
        refY.push(R + b.y, R + b.y + b.h / 2, R + b.y + b.h);
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
      const sz = defaultOpts(dragType, selectedAnchor, 0, 0) as {
        width?: number;
        height?: number;
      };
      const w = sz.width ?? 100;
      const h = sz.height ?? 40;
      ctx.fillStyle = "rgba(100,180,255,0.25)";
      ctx.strokeStyle = "rgba(100,180,255,0.9)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(R + ghostPos.x, R + ghostPos.y, w, h);
      ctx.strokeRect(R + ghostPos.x + 0.5, R + ghostPos.y + 0.5, w, h);
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
    selectedAnchor,
    R,
    ready,
  ]);

  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  React.useEffect(() => {
    const tree = treeRef.current;
    return () => tree.destroy();
  }, []);

  const resolveWorldPos = React.useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.PointerEvent<HTMLCanvasElement>,
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (canvas === null) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      // PointerEvent (mouse, touch, and pen alike) and MouseEvent both carry
      // clientX/clientY directly — no separate touches-array branch needed
      // the way a raw TouchEvent would require.
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const raw = { x: Math.round(px - R), y: Math.round(py - R) };
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
    const newWidget: PlacedWidget = {
      id: nextId(),
      type,
      opts: defaultOpts(type, selectedAnchor, pos.x, pos.y),
    } as PlacedWidget;
    setWidgets((prev) => [...prev, newWidget]);
    setSelectedId(newWidget.id);
    addLog("info", `Placed ${type} at (${pos.x}, ${pos.y})`);
  };

  const hitTestWidgets = (x: number, y: number): PlacedWidget | null => {
    const reversed = [...widgets].reverse();
    for (const w of reversed) {
      const b = widgetBounds(w);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return w;
    }
    return null;
  };

  /**
   * Ghost-preview tracking for mouse, touch, and pen alike — Pointer Events
   * fire uniformly for all three, replacing what used to be a separate
   * mouse-move handler and touch-move handler each calling the same
   * `resolveWorldPos`.
   */
  const handlePointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    if (dragType === null) return;
    setGhostPos(resolveWorldPos(e));
  };
  const handlePointerLeave = (): void => setGhostPos(null);

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

  /**
   * Touch/pen place immediately on press (no separate "up" step, matching
   * how the classic `onTouchStart` behaved) — mouse instead waits for
   * `onClick` (`handleCanvasClick`, fired on press+release) so a mouse drag
   * that leaves and re-enters the canvas doesn't place a widget partway
   * through. `pointerType === "mouse"` is excluded here for exactly that
   * reason; `onClick` still fires for mouse and is unaffected.
   */
  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    if (e.pointerType === "mouse") return;
    const pos = resolveWorldPos(e);
    if (pos === null) {
      setGhostPos(null);
      return;
    }
    setGhostPos(pos);
    if (dragType !== null) placeWidget(pos, dragType);
  };

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
  const handleDragLeave = (): void => setGhostPos(null);

  const insertSnippet = (w: PlacedWidget): void => {
    const snippet = widgetToSnippet(w);
    const insertion = `\n// ${WIDGET_LABEL[w.type]}\n${snippet}\n`;
    setEditorCode(editorCode.trim() + insertion);
    addLog("info", `Inserted ${WIDGET_LABEL[w.type]} snippet into editor`);
    setCopied(w.id);
    setTimeout(() => setCopied(null), 1200);
  };

  const copySnippet = (w: PlacedWidget): void => {
    navigator.clipboard.writeText(widgetToSnippet(w)).catch(() => {
      /* ignore */
    });
    setCopied(w.id + "-copy");
    setTimeout(() => setCopied(null), 1200);
  };

  const insertAllSnippets = (): void => {
    if (widgets.length === 0) return;
    const insertion = `\n${layoutToSnippet(widgets)}\n`;
    setEditorCode(editorCode.trim() + insertion);
    addLog("info", `Inserted ${widgets.length} widget snippet(s) into editor`);
  };

  const selectedWidget = widgets.find((w) => w.id === selectedId) ?? null;

  const updateSelectedOpts = (opts: Record<string, unknown>): void => {
    if (selectedId === null) return;
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === selectedId
          ? ({ ...w, opts: { ...w.opts, ...opts } } as PlacedWidget)
          : w,
      ),
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
        <div style={{ flex: 1 }} />
        <button
          onClick={insertAllSnippets}
          disabled={widgets.length === 0}
          title="Insert code for every placed widget"
          style={disabledBtnStyle(widgets.length > 0)}
        >
          Insert all
        </button>
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
            {WIDGET_TYPES.map((type) => (
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
                title="Drag onto canvas, or click to select then click canvas"
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
            position: "relative",
          }}
        >
          <ViewControls />
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
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onClick={handleCanvasClick}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerLeave}
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
            width: 190,
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
            style={{
              borderTop: "1px solid var(--es-border)",
              flexShrink: 0,
              maxHeight: "55%",
              overflowY: "auto",
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

                <PropertyEditor
                  widget={selectedWidget}
                  onChange={updateSelectedOpts}
                />

                <label
                  style={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                    anchor
                  </span>
                  <select
                    value={widgetAnchor(selectedWidget)}
                    onChange={(e) =>
                      updateSelectedOpts({
                        anchor: e.target.value as WidgetAnchor,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "2px 4px",
                      background: "var(--es-surface)",
                      color: "var(--es-text)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      fontSize: 11,
                    }}
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
                    onClick={() => insertSnippet(selectedWidget)}
                    title="Insert snippet into editor"
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      background:
                        copied === selectedWidget.id
                          ? "var(--es-green)"
                          : "var(--es-surface)",
                      color: "var(--es-text)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {copied === selectedWidget.id ? "✓" : "Insert"}
                  </button>
                  <button
                    onClick={() => copySnippet(selectedWidget)}
                    title="Copy snippet"
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      background:
                        copied === selectedWidget.id + "-copy"
                          ? "var(--es-green)"
                          : "var(--es-surface)",
                      color: "var(--es-text)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {copied === selectedWidget.id + "-copy" ? "✓" : "Copy"}
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
