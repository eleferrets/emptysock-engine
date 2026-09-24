import React from "react";
import { Stage, Layer, Line, Circle, Group, Text } from "react-konva";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Vector2d } from "konva/lib/types";
import { useIDEStore } from "../../store/ideStore";
import {
  useNavMeshStore,
  type EditorNavPolygon,
  type EditorNavMeshData,
  type NavMeshVec2,
} from "../../store/navMeshStore";
import { useHistory } from "../../hooks/useHistory";
import { drawRulers, getRulerMetrics, snapPoint } from "../../lib/editorGrid";
import { ViewControls } from "./shared/ViewControls";
import { NavMeshSidebar, type NavMeshTool } from "./navmesh/NavMeshSidebar";
import {
  polygonCentroid,
  pointInPolygon,
  toggleNeighbourLink,
  removePolygon,
  isNavMeshData,
  flattenPoints,
} from "../../lib/navMeshGeometry";

// Pure geometry/data helpers live in `../../lib/navMeshGeometry.ts` now
// (kept out of this file to hold its size down — see CLAUDE.md's file-size
// convention). Re-exported here so existing importers/tests keep working
// against this module's own path.
export {
  polygonCentroid,
  pointInPolygon,
  toggleNeighbourLink,
  removePolygon,
  isNavMeshData,
};

// ── Constants ────────────────────────────────────────────────────────────────

type Tool = NavMeshTool;

const VERTEX_RADIUS = 6;

// Deadpan, under-60-chars, no exclamation marks — matches the tone of the
// UI Placement panel's own QUIPS array.
const QUIPS = [
  "No polygons yet — draw one and pretend it's walkable.",
  "Empty mesh. Even ghosts need somewhere to walk.",
  "Zero polygons. Pathfinding has nothing to find.",
  "Blank floor plan. Draw the walkable bits.",
  "Nothing placed. The A* search agrees with you.",
];

export function NavMeshEditor(): React.ReactElement {
  const gridCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<KonvaStage | null>(null);
  const [tool, setTool] = React.useState<Tool>("select");
  const [canvasSize, setCanvasSize] = React.useState({ w: 800, h: 600 });
  const quipRef = React.useRef(QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const storePolygons = useNavMeshStore((s) => s.navMeshPolygons);
  const storeSetPolygons = useNavMeshStore((s) => s.setNavMeshPolygons);
  const allocateId = useNavMeshStore((s) => s.allocateNavMeshId);

  const tileSize = useIDEStore((s) => s.editorGridSize);
  const showRuler = useIDEStore((s) => s.editorShowRuler);
  const showGrid = useIDEStore((s) => s.editorShowGrid);
  const snapToGridOn = useIDEStore((s) => s.editorSnapToGrid);
  const addLog = useIDEStore((s) => s.addLog);

  const {
    state: histPolygons,
    set: commitToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<EditorNavPolygon[]>(storePolygons);

  const [livePolygons, setLivePolygons] =
    React.useState<EditorNavPolygon[]>(storePolygons);
  const liveRef = React.useRef<EditorNavPolygon[]>(livePolygons);

  const prevHistRef = React.useRef(histPolygons);
  React.useEffect(() => {
    if (prevHistRef.current !== histPolygons) {
      prevHistRef.current = histPolygons;
      liveRef.current = histPolygons;
      setLivePolygons(histPolygons);
      storeSetPolygons(histPolygons);
    }
  }, [histPolygons, storeSetPolygons]);

  const setPolygons = React.useCallback(
    (next: EditorNavPolygon[]) => {
      liveRef.current = next;
      setLivePolygons(next);
      storeSetPolygons(next);
    },
    [storeSetPolygons],
  );

  const setPolygonsAndCommit = React.useCallback(
    (next: EditorNavPolygon[]) => {
      liveRef.current = next;
      setLivePolygons(next);
      storeSetPolygons(next);
      commitToHistory(next);
    },
    [storeSetPolygons, commitToHistory],
  );

  const polygons = livePolygons;

  // Selection state — panel-local, nothing else in the IDE reads it.
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [connectFirstId, setConnectFirstId] = React.useState<number | null>(
    null,
  );
  const [draftVertices, setDraftVertices] = React.useState<NavMeshVec2[]>([]);

  // Snapshot of a polygon's vertices taken at the start of a whole-polygon
  // (Group) drag — the Group's own x/y prop always resets to 0 on every
  // render, so the current pointer delta IS the Group's live x()/y(); we
  // translate this snapshot by that delta rather than accumulating onto
  // already-moved vertices, which would double-apply the motion.
  const groupDragSnapshotRef = React.useRef<{
    polyId: number;
    vertices: NavMeshVec2[];
  } | null>(null);

  // Keyboard shortcuts: undo/redo, Enter to finish a polygon, Escape to
  // cancel the in-progress draft.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (tool === "draw" && e.key === "Enter") {
        finishDraftPolygon();
      } else if (tool === "draw" && e.key === "Escape") {
        setDraftVertices([]);
      } else if (
        tool === "select" &&
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId !== null
      ) {
        setPolygonsAndCommit(removePolygon(liveRef.current, selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, undo, redo, selectedId, draftVertices, setPolygonsAndCommit]);

  const { rulerSize } = getRulerMetrics();
  const rulerOffset = showRuler ? rulerSize : 0;
  const stageW = Math.max(0, canvasSize.w - rulerOffset);
  const stageH = Math.max(0, canvasSize.h - rulerOffset);

  function finishDraftPolygon(): void {
    if (draftVertices.length < 3) {
      setDraftVertices([]);
      return;
    }
    const id = allocateId();
    const newPolygon: EditorNavPolygon = {
      id,
      vertices: draftVertices,
      centroid: polygonCentroid(draftVertices),
      neighbours: [],
    };
    setPolygonsAndCommit([...liveRef.current, newPolygon]);
    setDraftVertices([]);
    addLog("info", `Placed nav polygon #${id} (${draftVertices.length} verts)`);
  }

  // ResizeObserver
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = gridCanvasRef.current;
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

  // Draw the grid + ruler chrome only — polygons/neighbours/draft are real
  // Konva nodes now, rendered by the <Stage> below this canvas.
  React.useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const lw = canvasSize.w;
    const lh = canvasSize.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    ctx.save();
    ctx.translate(rulerOffset, rulerOffset);

    // Background reference: no tilemap/level backdrop is wired up yet (see
    // docs/manual 7.22 note) — plain grid only for v1.
    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      const cols = Math.ceil((lw - rulerOffset) / tileSize) + 1;
      const rows = Math.ceil((lh - rulerOffset) / tileSize) + 1;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileSize, 0);
        ctx.lineTo(c * tileSize, lh);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * tileSize);
        ctx.lineTo(lw, r * tileSize);
        ctx.stroke();
      }
    }

    ctx.restore();

    drawRulers(ctx, lw, lh, {
      gridSize: tileSize,
      showGrid: false,
      showRuler,
      snapToGrid: snapToGridOn,
      showGuides: false,
      zoom: 1,
    });
  }, [tileSize, showGrid, showRuler, snapToGridOn, rulerOffset, canvasSize]);

  const dragBound = React.useCallback(
    (pos: Vector2d): Vector2d =>
      snapToGridOn ? snapPoint(pos.x, pos.y, tileSize) : pos,
    [snapToGridOn, tileSize],
  );

  function toStagePos(e: KonvaEventObject<PointerEvent>): NavMeshVec2 {
    const pos = e.target.getStage()?.getPointerPosition();
    const raw = pos ?? { x: 0, y: 0 };
    return snapToGridOn ? snapPoint(raw.x, raw.y, tileSize) : raw;
  }

  const handleStagePointerDown = (e: KonvaEventObject<PointerEvent>): void => {
    const pos = toStagePos(e);

    if (tool === "draw") {
      setDraftVertices((prev) => [...prev, pos]);
      return;
    }

    const stage = e.target.getStage();
    const clickedOnEmpty = stage !== null && e.target === stage;
    if (clickedOnEmpty && tool === "select") {
      setSelectedId(null);
    }
  };

  const handleStageDoubleClick = (): void => {
    if (tool === "draw") finishDraftPolygon();
  };

  /** Click handling shared by a polygon's body (Line) and its vertices. */
  function handlePolygonInteract(poly: EditorNavPolygon): void {
    if (tool === "connect") {
      if (connectFirstId === null) {
        setConnectFirstId(poly.id);
        return;
      }
      if (connectFirstId === poly.id) {
        setConnectFirstId(null);
        return;
      }
      setPolygonsAndCommit(
        toggleNeighbourLink(liveRef.current, connectFirstId, poly.id),
      );
      addLog(
        "info",
        `Toggled neighbour link between #${connectFirstId} and #${poly.id}`,
      );
      setConnectFirstId(null);
      return;
    }

    if (tool === "delete") {
      setPolygonsAndCommit(removePolygon(liveRef.current, poly.id));
      if (selectedId === poly.id) setSelectedId(null);
      addLog("info", `Deleted nav polygon #${poly.id}`);
      return;
    }

    if (tool === "select") {
      setSelectedId(poly.id);
    }
  }

  function handleVertexDragMove(
    e: KonvaEventObject<DragEvent>,
    polyId: number,
    vertexIndex: number,
  ): void {
    // A vertex's own 'dragmove' bubbles to its ancestor Group (see
    // handleGroupDragMove's matching guard) — ignore that bubbled copy here
    // too so a vertex drag never gets double-processed.
    if (e.target !== e.currentTarget) return;
    const node = e.target;
    const pos = { x: node.x(), y: node.y() };
    const next = liveRef.current.map((poly) => {
      if (poly.id !== polyId) return poly;
      const vertices = poly.vertices.map((v, i) =>
        i === vertexIndex ? pos : v,
      );
      return { ...poly, vertices, centroid: polygonCentroid(vertices) };
    });
    setPolygons(next);
  }

  function handleVertexDragEnd(
    e: KonvaEventObject<DragEvent>,
    polyId: number,
    vertexIndex: number,
  ): void {
    if (e.target !== e.currentTarget) return;
    handleVertexDragMove(e, polyId, vertexIndex);
    commitToHistory(liveRef.current);
  }

  function handleGroupDragStart(
    e: KonvaEventObject<DragEvent>,
    polyId: number,
  ): void {
    // Ignore a vertex's 'dragstart' bubbling up through this Group — only
    // react when the Group itself (the polygon body) is the actual target.
    if (e.target !== e.currentTarget) return;
    const poly = liveRef.current.find((p) => p.id === polyId);
    if (poly === undefined) return;
    groupDragSnapshotRef.current = {
      polyId,
      vertices: poly.vertices.map((v) => ({ ...v })),
    };
  }

  function handleGroupDragMove(
    e: KonvaEventObject<DragEvent>,
    polyId: number,
  ): void {
    if (e.target !== e.currentTarget) return;
    const snap = groupDragSnapshotRef.current;
    if (snap === null || snap.polyId !== polyId) return;
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    const next = liveRef.current.map((poly) => {
      if (poly.id !== polyId) return poly;
      const vertices = snap.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy }));
      return { ...poly, vertices, centroid: polygonCentroid(vertices) };
    });
    setPolygons(next);
  }

  function handleGroupDragEnd(
    e: KonvaEventObject<DragEvent>,
    polyId: number,
  ): void {
    if (e.target !== e.currentTarget) return;
    handleGroupDragMove(e, polyId);
    commitToHistory(liveRef.current);
    groupDragSnapshotRef.current = null;
    // The Group is a pure delta transform — reset it now (the next render's
    // explicit x={0} y={0} prop would do this anyway, but resetting
    // immediately avoids a one-frame flash of the un-reset delta).
    e.target.position({ x: 0, y: 0 });
  }

  // ── Load / export ──────────────────────────────────────────────────────

  const loadNavMesh = (): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        try {
          const data: unknown = JSON.parse(reader.result as string);
          if (!isNavMeshData(data)) {
            addLog("error", "Invalid NavMeshData JSON — no polygons array");
            return;
          }
          setPolygonsAndCommit(data.polygons);
          const maxId = data.polygons.reduce((m, p) => Math.max(m, p.id), 0);
          useNavMeshStore.setState({ navMeshNextId: maxId + 1 });
          addLog(
            "info",
            `Loaded ${data.polygons.length} nav polygon(s) from ${file.name}`,
          );
        } catch {
          addLog("error", "Failed to parse navmesh JSON");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportNavMesh = (): void => {
    const data: EditorNavMeshData = { polygons };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "navmesh.json";
    a.click();
    URL.revokeObjectURL(url);
    addLog("info", `Exported ${polygons.length} nav polygon(s)`);
  };

  const selectedPolygon = polygons.find((p) => p.id === selectedId) ?? null;

  // Neighbour links, drawn under the polygons.
  const neighbourLines: Array<{ key: string; points: number[] }> = [];
  {
    const seen = new Set<string>();
    for (const poly of polygons) {
      for (const nId of poly.neighbours) {
        const key = [poly.id, nId].sort((a, b) => a - b).join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        const other = polygons.find((p) => p.id === nId);
        if (other === undefined) continue;
        neighbourLines.push({
          key,
          points: [
            poly.centroid.x,
            poly.centroid.y,
            other.centroid.x,
            other.centroid.y,
          ],
        });
      }
    }
  }

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
      <NavMeshSidebar
        tool={tool}
        onSelectTool={(t) => {
          setTool(t);
          setDraftVertices([]);
          setConnectFirstId(null);
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        draftVertexCount={draftVertices.length}
        onFinishDraft={finishDraftPolygon}
        selectedPolygon={selectedPolygon}
        onDeleteSelected={() => {
          if (selectedPolygon === null) return;
          setPolygonsAndCommit(
            removePolygon(liveRef.current, selectedPolygon.id),
          );
          setSelectedId(null);
        }}
        polygonCount={polygons.length}
        onLoad={loadNavMesh}
        onExport={exportNavMesh}
      />

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative" }}
      >
        <ViewControls />
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 5,
            color: "var(--es-text-muted)",
            fontSize: 10,
            pointerEvents: "none",
          }}
        >
          {polygons.length === 0 && draftVertices.length === 0
            ? quipRef.current
            : `${polygons.length} polygon${polygons.length !== 1 ? "s" : ""}${
                tool === "connect" && connectFirstId !== null
                  ? ` · linking from #${connectFirstId}`
                  : ""
              }`}
        </div>
        <canvas
          ref={gridCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
        <div
          data-testid="navmesh-stage-container"
          style={{
            position: "absolute",
            top: rulerOffset,
            left: rulerOffset,
            right: 0,
            bottom: 0,
            touchAction: "none",
            cursor:
              tool === "delete"
                ? "not-allowed"
                : tool === "draw"
                  ? "crosshair"
                  : "default",
          }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            onPointerDown={handleStagePointerDown}
            onDblClick={handleStageDoubleClick}
          >
            <Layer>
              {neighbourLines.map((line) => (
                <Line
                  key={line.key}
                  points={line.points}
                  stroke="rgba(120,200,255,0.55)"
                  strokeWidth={1.5}
                  listening={false}
                />
              ))}

              {polygons.map((poly) => {
                if (poly.vertices.length < 2) return null;
                const isSelected =
                  poly.id === selectedId || poly.id === connectFirstId;
                return (
                  <Group
                    key={poly.id}
                    id={`navmesh-poly-${poly.id}`}
                    x={0}
                    y={0}
                    draggable={tool === "select"}
                    dragBoundFunc={dragBound}
                    onDragStart={(e) => handleGroupDragStart(e, poly.id)}
                    onDragMove={(e) => handleGroupDragMove(e, poly.id)}
                    onDragEnd={(e) => handleGroupDragEnd(e, poly.id)}
                  >
                    <Line
                      points={flattenPoints(poly.vertices)}
                      closed
                      fill={
                        isSelected
                          ? "rgba(124,106,247,0.35)"
                          : "rgba(80,220,150,0.18)"
                      }
                      stroke={
                        isSelected
                          ? "rgba(124,106,247,0.95)"
                          : "rgba(80,220,150,0.8)"
                      }
                      strokeWidth={isSelected ? 2 : 1.5}
                      onPointerDown={() => handlePolygonInteract(poly)}
                    />
                    <Circle
                      x={poly.centroid.x}
                      y={poly.centroid.y}
                      radius={2.5}
                      fill="rgba(255,255,255,0.7)"
                      listening={false}
                    />
                    <Text
                      x={poly.centroid.x + 5}
                      y={poly.centroid.y - 12}
                      text={`#${poly.id}`}
                      fontSize={9}
                      fontFamily="monospace"
                      fill="rgba(255,255,255,0.85)"
                      listening={false}
                    />
                    {poly.vertices.map((v, i) => (
                      <Circle
                        key={i}
                        id={`navmesh-vertex-${poly.id}-${i}`}
                        x={v.x}
                        y={v.y}
                        radius={VERTEX_RADIUS - 2}
                        fill={
                          isSelected
                            ? "rgba(124,106,247,1)"
                            : "rgba(80,220,150,0.9)"
                        }
                        draggable={tool === "select"}
                        dragBoundFunc={dragBound}
                        onPointerDown={() => handlePolygonInteract(poly)}
                        onDragMove={(e) => handleVertexDragMove(e, poly.id, i)}
                        onDragEnd={(e) => handleVertexDragEnd(e, poly.id, i)}
                      />
                    ))}
                  </Group>
                );
              })}

              {draftVertices.length > 0 && (
                <>
                  <Line
                    points={flattenPoints(draftVertices)}
                    stroke="rgba(255,210,100,0.9)"
                    fill="rgba(255,210,100,0.15)"
                    strokeWidth={1.5}
                    dash={[4, 3]}
                    listening={false}
                  />
                  {draftVertices.map((v, i) => (
                    <Circle
                      key={i}
                      x={v.x}
                      y={v.y}
                      radius={VERTEX_RADIUS - 2}
                      fill="rgba(255,210,100,1)"
                      listening={false}
                    />
                  ))}
                </>
              )}
            </Layer>
          </Stage>
        </div>
        {polygons.length === 0 && draftVertices.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              color: "var(--es-text-muted)",
              fontSize: 13,
              textAlign: "center",
              padding: 24,
            }}
          >
            No navmesh polygons yet — switch to the Draw tool and click to start
            drawing.
          </div>
        )}
      </div>
    </div>
  );
}
