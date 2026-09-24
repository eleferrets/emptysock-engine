import React from "react";
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

// ── Constants ────────────────────────────────────────────────────────────────

type Tool = "select" | "draw" | "connect" | "delete";

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

export function polygonCentroid(vertices: NavMeshVec2[]): NavMeshVec2 {
  if (vertices.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const v of vertices) {
    sx += v.x;
    sy += v.y;
  }
  return { x: sx / vertices.length, y: sy / vertices.length };
}

export function pointInPolygon(p: NavMeshVec2, verts: NavMeshVec2[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const vi = verts[i];
    const vj = verts[j];
    if (vi === undefined || vj === undefined) continue;
    if (
      vi.y > p.y !== vj.y > p.y &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function dist(a: NavMeshVec2, b: NavMeshVec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Toggle a bidirectional neighbour link between two polygons in place. */
export function toggleNeighbourLink(
  polygons: EditorNavPolygon[],
  idA: number,
  idB: number,
): EditorNavPolygon[] {
  const a = polygons.find((p) => p.id === idA);
  const linked = a !== undefined && a.neighbours.includes(idB);
  return polygons.map((p) => {
    if (p.id === idA) {
      return {
        ...p,
        neighbours: linked
          ? p.neighbours.filter((n) => n !== idB)
          : [...p.neighbours, idB],
      };
    }
    if (p.id === idB) {
      return {
        ...p,
        neighbours: linked
          ? p.neighbours.filter((n) => n !== idA)
          : [...p.neighbours, idA],
      };
    }
    return p;
  });
}

/** Remove a polygon and strip its id from every other polygon's neighbours. */
export function removePolygon(
  polygons: EditorNavPolygon[],
  id: number,
): EditorNavPolygon[] {
  return polygons
    .filter((p) => p.id !== id)
    .map((p) => ({
      ...p,
      neighbours: p.neighbours.filter((n) => n !== id),
    }));
}

export function isNavMeshData(value: unknown): value is EditorNavMeshData {
  if (typeof value !== "object" || value === null) return false;
  const polys = (value as { polygons?: unknown }).polygons;
  if (!Array.isArray(polys)) return false;
  return polys.every((p) => {
    if (typeof p !== "object" || p === null) return false;
    const poly = p as Record<string, unknown>;
    return (
      typeof poly["id"] === "number" &&
      Array.isArray(poly["vertices"]) &&
      Array.isArray(poly["neighbours"])
    );
  });
}

export function NavMeshEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
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
  const [dragState, setDragState] = React.useState<
    | { kind: "vertex"; polyId: number; vertexIndex: number }
    | { kind: "polygon"; polyId: number; lastPos: NavMeshVec2 }
    | null
  >(null);

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

  // Draw
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

    // Neighbour links, drawn under the polygons.
    ctx.strokeStyle = "rgba(120,200,255,0.55)";
    ctx.lineWidth = 1.5;
    const seen = new Set<string>();
    for (const poly of polygons) {
      for (const nId of poly.neighbours) {
        const key = [poly.id, nId].sort((a, b) => a - b).join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        const other = polygons.find((p) => p.id === nId);
        if (other === undefined) continue;
        ctx.beginPath();
        ctx.moveTo(poly.centroid.x, poly.centroid.y);
        ctx.lineTo(other.centroid.x, other.centroid.y);
        ctx.stroke();
      }
    }

    // Polygons
    for (const poly of polygons) {
      if (poly.vertices.length < 2) continue;
      const isSelected = poly.id === selectedId || poly.id === connectFirstId;
      ctx.beginPath();
      const first = poly.vertices[0];
      if (first === undefined) continue;
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < poly.vertices.length; i++) {
        const v = poly.vertices[i];
        if (v === undefined) continue;
        ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fillStyle = isSelected
        ? "rgba(124,106,247,0.35)"
        : "rgba(80,220,150,0.18)";
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? "rgba(124,106,247,0.95)"
        : "rgba(80,220,150,0.8)";
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();

      // Centroid marker
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(poly.centroid.x, poly.centroid.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Vertex handles (only interactable in select mode, but always shown)
      for (const v of poly.vertices) {
        ctx.fillStyle = isSelected
          ? "rgba(124,106,247,1)"
          : "rgba(80,220,150,0.9)";
        ctx.beginPath();
        ctx.arc(v.x, v.y, VERTEX_RADIUS - 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Polygon id label
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "9px monospace";
      ctx.fillText(`#${poly.id}`, poly.centroid.x + 5, poly.centroid.y - 5);
    }

    // In-progress draft polygon (draw tool)
    if (draftVertices.length > 0) {
      ctx.strokeStyle = "rgba(255,210,100,0.9)";
      ctx.fillStyle = "rgba(255,210,100,0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      const first = draftVertices[0];
      if (first !== undefined) {
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < draftVertices.length; i++) {
          const v = draftVertices[i];
          if (v === undefined) continue;
          ctx.lineTo(v.x, v.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const v of draftVertices) {
        ctx.fillStyle = "rgba(255,210,100,1)";
        ctx.beginPath();
        ctx.arc(v.x, v.y, VERTEX_RADIUS - 2, 0, Math.PI * 2);
        ctx.fill();
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
  }, [
    polygons,
    tileSize,
    showGrid,
    showRuler,
    snapToGridOn,
    rulerOffset,
    canvasSize,
    selectedId,
    connectFirstId,
    draftVertices,
  ]);

  function toWorldPos(e: React.PointerEvent<HTMLCanvasElement>): NavMeshVec2 {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const raw = {
      x: e.clientX - rect.left - rulerOffset,
      y: e.clientY - rect.top - rulerOffset,
    };
    return snapToGridOn ? snapPoint(raw.x, raw.y, tileSize) : raw;
  }

  function findPolygonAt(pos: NavMeshVec2): EditorNavPolygon | null {
    for (let i = liveRef.current.length - 1; i >= 0; i--) {
      const poly = liveRef.current[i];
      if (poly !== undefined && pointInPolygon(pos, poly.vertices)) {
        return poly;
      }
    }
    return null;
  }

  function findVertexAt(
    pos: NavMeshVec2,
  ): { polyId: number; vertexIndex: number } | null {
    for (const poly of liveRef.current) {
      for (let i = 0; i < poly.vertices.length; i++) {
        const v = poly.vertices[i];
        if (v !== undefined && dist(pos, v) <= VERTEX_RADIUS) {
          return { polyId: poly.id, vertexIndex: i };
        }
      }
    }
    return null;
  }

  const handlePointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    const pos = toWorldPos(e);

    if (tool === "draw") {
      setDraftVertices((prev) => [...prev, pos]);
      return;
    }

    if (tool === "connect") {
      const hit = findPolygonAt(pos);
      if (hit === null) return;
      if (connectFirstId === null) {
        setConnectFirstId(hit.id);
        return;
      }
      if (connectFirstId === hit.id) {
        setConnectFirstId(null);
        return;
      }
      setPolygonsAndCommit(
        toggleNeighbourLink(liveRef.current, connectFirstId, hit.id),
      );
      addLog(
        "info",
        `Toggled neighbour link between #${connectFirstId} and #${hit.id}`,
      );
      setConnectFirstId(null);
      return;
    }

    if (tool === "delete") {
      const hit = findPolygonAt(pos);
      if (hit === null) return;
      setPolygonsAndCommit(removePolygon(liveRef.current, hit.id));
      if (selectedId === hit.id) setSelectedId(null);
      addLog("info", `Deleted nav polygon #${hit.id}`);
      return;
    }

    // select tool
    e.currentTarget.setPointerCapture(e.pointerId);
    const vertexHit = findVertexAt(pos);
    if (vertexHit !== null) {
      setSelectedId(vertexHit.polyId);
      setDragState({ kind: "vertex", ...vertexHit });
      return;
    }
    const polyHit = findPolygonAt(pos);
    if (polyHit !== null) {
      setSelectedId(polyHit.id);
      setDragState({ kind: "polygon", polyId: polyHit.id, lastPos: pos });
      return;
    }
    setSelectedId(null);
  };

  const handlePointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    if (dragState === null) return;
    const pos = toWorldPos(e);

    if (dragState.kind === "vertex") {
      const next = liveRef.current.map((poly) => {
        if (poly.id !== dragState.polyId) return poly;
        const vertices = poly.vertices.map((v, i) =>
          i === dragState.vertexIndex ? pos : v,
        );
        return { ...poly, vertices, centroid: polygonCentroid(vertices) };
      });
      setPolygons(next);
      return;
    }

    // translate the whole polygon
    const dx = pos.x - dragState.lastPos.x;
    const dy = pos.y - dragState.lastPos.y;
    if (dx === 0 && dy === 0) return;
    const next = liveRef.current.map((poly) => {
      if (poly.id !== dragState.polyId) return poly;
      const vertices = poly.vertices.map((v) => ({
        x: v.x + dx,
        y: v.y + dy,
      }));
      return {
        ...poly,
        vertices,
        centroid: { x: poly.centroid.x + dx, y: poly.centroid.y + dy },
      };
    });
    setPolygons(next);
    setDragState({ ...dragState, lastPos: pos });
  };

  const handlePointerUp = (): void => {
    if (dragState !== null) {
      commitToHistory(liveRef.current);
      setDragState(null);
    }
  };

  const handleCanvasDoubleClick = (): void => {
    if (tool === "draw") finishDraftPolygon();
  };

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

  const tools: { id: Tool; label: string; hint: string }[] = [
    { id: "select", label: "Select", hint: "Drag vertices or whole polygons" },
    {
      id: "draw",
      label: "Draw",
      hint: "Click to place vertices, Enter to finish",
    },
    {
      id: "connect",
      label: "Connect",
      hint: "Click two polygons to toggle a link",
    },
    { id: "delete", label: "Delete", hint: "Click a polygon to remove it" },
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

  const selectedPolygon = polygons.find((p) => p.id === selectedId) ?? null;

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
          width: 190,
          borderRight: "1px solid var(--es-border)",
          display: "flex",
          flexDirection: "column",
          padding: 8,
          gap: 12,
          overflow: "auto",
        }}
      >
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
                onClick={() => {
                  setTool(t.id);
                  setDraftVertices([]);
                  setConnectFirstId(null);
                }}
                title={t.hint}
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
          {tool === "draw" && (
            <button
              onClick={finishDraftPolygon}
              disabled={draftVertices.length < 3}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "3px 0",
                background: "var(--es-surface)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                color: "var(--es-text)",
                cursor: draftVertices.length >= 3 ? "pointer" : "default",
                opacity: draftVertices.length >= 3 ? 1 : 0.4,
              }}
              title="Finish polygon (Enter)"
            >
              Finish polygon ({draftVertices.length})
            </button>
          )}
        </div>

        <div>
          <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
            Selected polygon
          </div>
          {selectedPolygon === null ? (
            <div style={{ color: "var(--es-text-muted)", fontSize: 11 }}>
              None selected.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div>id: {selectedPolygon.id}</div>
              <div>vertices: {selectedPolygon.vertices.length}</div>
              <div>
                neighbours:{" "}
                {selectedPolygon.neighbours.length > 0
                  ? selectedPolygon.neighbours.join(", ")
                  : "none"}
              </div>
              <button
                onClick={() => {
                  setPolygonsAndCommit(
                    removePolygon(liveRef.current, selectedPolygon.id),
                  );
                  setSelectedId(null);
                }}
                style={{
                  marginTop: 4,
                  padding: "3px 6px",
                  background: "var(--es-surface)",
                  color: "var(--es-red, #ef4444)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Delete polygon
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={loadNavMesh}
            style={{
              padding: "4px 8px",
              background: "var(--es-surface)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Load navmesh.json&#x2026;
          </button>
          <button
            onClick={exportNavMesh}
            disabled={polygons.length === 0}
            style={{
              padding: "4px 8px",
              background: "var(--es-surface)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              cursor: polygons.length > 0 ? "pointer" : "default",
              opacity: polygons.length > 0 ? 1 : 0.4,
              textAlign: "left",
            }}
          >
            Export navmesh.json
          </button>
        </div>
      </div>

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
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            cursor:
              tool === "delete"
                ? "not-allowed"
                : tool === "draw"
                  ? "crosshair"
                  : "default",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleCanvasDoubleClick}
        />
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
