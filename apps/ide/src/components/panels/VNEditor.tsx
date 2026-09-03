import React from "react";
import {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "@emptysock/engine";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";

type NodeType = "dialogue" | "choice";

interface VNNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  speaker?: string;
  text: string;
  options?: string[];
}

interface VNEdge {
  id: string;
  from: string;
  fromPort: number;
  to: string;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface GuideLine {
  axis: "h" | "v";
  pos: number;
}

interface GraphState {
  nodes: VNNode[];
  edges: VNEdge[];
}

const INITIAL_NODES: VNNode[] = [
  {
    id: "n1",
    type: "dialogue",
    x: 60,
    y: 80,
    speaker: "Hero",
    text: "Hello, traveller.",
  },
  {
    id: "n2",
    type: "choice",
    x: 320,
    y: 80,
    text: "Choose a response",
    options: ["Who are you?", "Goodbye."],
  },
  {
    id: "n3",
    type: "dialogue",
    x: 580,
    y: 40,
    speaker: "Hero",
    text: "I am the last guardian.",
  },
  {
    id: "n4",
    type: "dialogue",
    x: 580,
    y: 160,
    speaker: "Hero",
    text: "Safe travels.",
  },
];

const INITIAL_EDGES: VNEdge[] = [
  { id: "e1", from: "n1", fromPort: 0, to: "n2" },
  { id: "e2", from: "n2", fromPort: 0, to: "n3" },
  { id: "e3", from: "n2", fromPort: 1, to: "n4" },
];

const NODE_W = 220;
const NODE_H = 100;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const STORAGE_KEY = "es-story-graph";
const GUIDE_THRESHOLD = 6;

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

function loadGraph(): GraphState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GraphState;
  } catch {
    /* ignore */
  }
  return { nodes: INITIAL_NODES, edges: INITIAL_EDGES };
}

function saveGraph(nodes: VNNode[], edges: VNEdge[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  } catch {
    /* storage full */
  }
}

export function VNEditor(): React.ReactElement {
  const setVNNodes = useIDEStore((s) => s.setVNNodes);
  const editorGridSize = useIDEStore((s) => s.editorGridSize);
  const editorShowGrid = useIDEStore((s) => s.editorShowGrid);
  const editorSnapToGrid = useIDEStore((s) => s.editorSnapToGrid);
  const editorShowGuides = useIDEStore((s) => s.editorShowGuides);
  const setEditorGridSize = useIDEStore((s) => s.setEditorGridSize);
  const setEditorShowGrid = useIDEStore((s) => s.setEditorShowGrid);
  const setEditorSnapToGrid = useIDEStore((s) => s.setEditorSnapToGrid);
  const setEditorShowGuides = useIDEStore((s) => s.setEditorShowGuides);

  const saved = React.useMemo(loadGraph, []);

  // ── Undo/redo: {nodes, edges} as one atomic snapshot ────────────────────────
  const {
    state: graph,
    set: setGraph,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<GraphState>({ nodes: saved.nodes, edges: saved.edges });

  const nodes = graph.nodes;
  const edges = graph.edges;

  // Fast local state for drag (doesn't go through history on every move)
  const [localNodes, setLocalNodes] = React.useState<VNNode[]>(nodes);
  const [localEdges, setLocalEdges] = React.useState<VNEdge[]>(edges);

  // Keep local in sync with history (undo/redo)
  const prevGraphRef = React.useRef(graph);
  React.useEffect(() => {
    if (prevGraphRef.current !== graph) {
      prevGraphRef.current = graph;
      setLocalNodes(graph.nodes);
      setLocalEdges(graph.edges);
    }
  }, [graph]);

  // Committed graph mutations
  const commitNodes = React.useCallback(
    (next: VNNode[]) => {
      setLocalNodes(next);
      setGraph({ nodes: next, edges: localEdges });
    },
    [localEdges, setGraph],
  );

  const commitBoth = React.useCallback(
    (n: VNNode[], e: VNEdge[]) => {
      setLocalNodes(n);
      setLocalEdges(e);
      setGraph({ nodes: n, edges: e });
    },
    [setGraph],
  );

  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<{
    id: string;
    ox: number;
    oy: number;
  } | null>(null);
  const dragStartNodesRef = React.useRef<VNNode[] | null>(null);
  const [editNode, setEditNode] = React.useState<VNNode | null>(null);
  const [view, setView] = React.useState<ViewTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [panning, setPanning] = React.useState<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [guides, setGuides] = React.useState<GuideLine[]>([]);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Minimap
  const [showMinimap, setShowMinimap] = React.useState(true);
  const MINI_W = 200;
  const MINI_H = 120;

  const displayNodes = localNodes;
  const displayEdges = localEdges;

  // Persist on change and sync nodes to ideStore for VN Preview
  React.useEffect(() => {
    saveGraph(displayNodes, displayEdges);
    setVNNodes(displayNodes);
  }, [displayNodes, displayEdges, setVNNodes]);

  // Keyboard shortcuts (undo/redo + delete)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
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
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selected &&
        editNode === null
      ) {
        e.preventDefault();
        const nextNodes = localNodes.filter((n) => n.id !== selected);
        const nextEdges = localEdges.filter(
          (ed) => ed.from !== selected && ed.to !== selected,
        );
        commitBoth(nextNodes, nextEdges);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, editNode, localNodes, localEdges, commitBoth, undo, redo]);

  // Wheel zoom / pan
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      if (e.deltaMode === 2) delta *= 600;

      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = delta > 0 ? 0.9 : 1.1;
        setView((v) => {
          const newScale = clampScale(v.scale * factor);
          const ratio = newScale / v.scale;
          return {
            scale: newScale,
            x: mx - ratio * (mx - v.x),
            y: my - ratio * (my - v.y),
          };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - delta }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const nodeById = (id: string): VNNode | undefined =>
    displayNodes.find((n) => n.id === id);

  const portPos = (
    node: VNNode,
    port: number,
    side: "in" | "out",
  ): { x: number; y: number } => {
    const portCount =
      side === "out" ? Math.max(1, node.options?.length ?? 1) : 1;
    const spacing = NODE_H / (portCount + 1);
    return {
      x: side === "in" ? node.x : node.x + NODE_W,
      y: node.y + spacing * (port + 1),
    };
  };

  const edgePath = (edge: VNEdge): string => {
    const from = nodeById(edge.from);
    const to = nodeById(edge.to);
    if (!from || !to) return "";
    const p1 = portPos(from, edge.fromPort, "out");
    const p2 = portPos(to, 0, "in");
    const cx = (p1.x + p2.x) / 2;
    return `M${p1.x},${p1.y} C${cx},${p1.y} ${cx},${p2.y} ${p2.x},${p2.y}`;
  };

  const svgCoordsFromClient = (
    cx: number,
    cy: number,
  ): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (cx - rect.left - view.x) / view.scale,
      y: (cy - rect.top - view.y) / view.scale,
    };
  };

  const computeGuides = (dragNode: VNNode, allNodes: VNNode[]): GuideLine[] => {
    const result: GuideLine[] = [];
    const dLeft = dragNode.x;
    const dRight = dragNode.x + NODE_W;
    const dCenterX = dragNode.x + NODE_W / 2;
    const dTop = dragNode.y;
    const dBottom = dragNode.y + NODE_H;
    const dMiddleY = dragNode.y + NODE_H / 2;
    for (const other of allNodes) {
      if (other.id === dragNode.id) continue;
      const oLeft = other.x;
      const oRight = other.x + NODE_W;
      const oCenterX = other.x + NODE_W / 2;
      const oTop = other.y;
      const oBottom = other.y + NODE_H;
      const oMiddleY = other.y + NODE_H / 2;
      for (const dx of [dLeft, dRight, dCenterX]) {
        for (const ox of [oLeft, oRight, oCenterX]) {
          if (Math.abs(dx - ox) < GUIDE_THRESHOLD)
            result.push({ axis: "v", pos: ox });
        }
      }
      for (const dy of [dTop, dBottom, dMiddleY]) {
        for (const oy of [oTop, oBottom, oMiddleY]) {
          if (Math.abs(dy - oy) < GUIDE_THRESHOLD)
            result.push({ axis: "h", pos: oy });
        }
      }
    }
    const seen = new Set<string>();
    return result.filter((g) => {
      const key = `${g.axis}:${g.pos}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handlePointerDownSVG = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (
      e.target === svgRef.current ||
      (e.target as SVGElement).tagName === "svg"
    ) {
      setSelected(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        originX: view.x,
        originY: view.y,
      });
    }
  };

  const handlePointerMoveSVG = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (dragging) {
      const coords = svgCoordsFromClient(e.clientX, e.clientY);
      let nx = coords.x - dragging.ox;
      let ny = coords.y - dragging.oy;
      if (editorSnapToGrid) {
        nx = snapValue(nx, editorGridSize);
        ny = snapValue(ny, editorGridSize);
      }
      setLocalNodes((prev) => {
        const next = prev.map((n) =>
          n.id === dragging.id ? { ...n, x: nx, y: ny } : n,
        );
        if (editorShowGuides) {
          const dragNode = next.find((n) => n.id === dragging.id);
          if (dragNode) setGuides(computeGuides(dragNode, next));
        }
        return next;
      });
    } else if (panning) {
      setView((v) => ({
        ...v,
        x: panning.originX + e.clientX - panning.startX,
        y: panning.originY + e.clientY - panning.startY,
      }));
    }
  };

  const handlePointerUpSVG = (): void => {
    if (dragging) {
      // Commit the drag to history
      setGraph({ nodes: localNodes, edges: localEdges });
    }
    setDragging(null);
    dragStartNodesRef.current = null;
    setPanning(null);
    setGuides([]);
  };

  const addNode = (type: NodeType): void => {
    const id = `n${Date.now()}`;
    const cx = (containerRef.current?.clientWidth ?? 600) / 2;
    const cy = (containerRef.current?.clientHeight ?? 400) / 2;
    let x = (cx - view.x) / view.scale - NODE_W / 2;
    let y = (cy - view.y) / view.scale - NODE_H / 2;
    if (editorSnapToGrid) {
      x = snapValue(x, editorGridSize);
      y = snapValue(y, editorGridSize);
    }
    const newNode: VNNode =
      type === "dialogue"
        ? { id, type, x, y, text: "New dialogue...", speaker: "Speaker" }
        : {
            id,
            type,
            x,
            y,
            text: "Choose...",
            options: ["Option A", "Option B"],
          };
    commitNodes([...localNodes, newNode]);
  };

  const deleteSelected = (): void => {
    if (!selected) return;
    const nextNodes = localNodes.filter((n) => n.id !== selected);
    const nextEdges = localEdges.filter(
      (e) => e.from !== selected && e.to !== selected,
    );
    commitBoth(nextNodes, nextEdges);
    setSelected(null);
  };

  const importJSON = (): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        try {
          const data = JSON.parse(reader.result as string) as {
            nodes?: VNNode[];
            edges?: VNEdge[];
          };
          const nextNodes = Array.isArray(data.nodes) ? data.nodes : localNodes;
          const nextEdges = Array.isArray(data.edges) ? data.edges : localEdges;
          commitBoth(nextNodes, nextEdges);
        } catch {
          /* invalid */
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportJSON = (): void => {
    const blob = new Blob(
      [JSON.stringify({ nodes: localNodes, edges: localEdges }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "story.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importVNScript = (): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.vnscript";
    input.onchange = (): void => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        try {
          const tree = JSON.parse(reader.result as string) as {
            nodes?: unknown;
            startNode?: string;
          };
          if (
            typeof tree.startNode !== "string" ||
            typeof tree.nodes !== "object"
          )
            return;
          const g = dialogueTreeToStoryGraph(
            tree as Parameters<typeof dialogueTreeToStoryGraph>[0],
          );
          commitBoth(g.nodes as VNNode[], g.edges as VNEdge[]);
        } catch {
          /* invalid file */
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportVNScript = (): void => {
    const startNodeId = localNodes[0]?.id ?? "";
    const tree = storyGraphToDialogueTree({
      nodes: localNodes as Parameters<
        typeof storyGraphToDialogueTree
      >[0]["nodes"],
      edges: localEdges,
      startNodeId,
    });
    const blob = new Blob([JSON.stringify(tree, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "story.vnscript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetView = (): void => setView({ x: 0, y: 0, scale: 1 });

  // ── Minimap ─────────────────────────────────────────────────────────────────
  const minimapTransform = React.useMemo(() => {
    if (displayNodes.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of displayNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    }
    const pad = 10;
    const W = maxX - minX + pad * 2;
    const H = maxY - minY + pad * 2;
    const scale = Math.min(MINI_W / W, MINI_H / H) * 0.9;
    const offsetX = (MINI_W - W * scale) / 2 - (minX - pad) * scale;
    const offsetY = (MINI_H - H * scale) / 2 - (minY - pad) * scale;
    return { scale, offsetX, offsetY, minX, minY };
  }, [displayNodes]);

  const minimapViewport = React.useMemo(() => {
    if (!minimapTransform) return null;
    const cw = containerRef.current?.clientWidth ?? 600;
    const ch = containerRef.current?.clientHeight ?? 400;
    const { scale, offsetX, offsetY } = minimapTransform;
    const vx = (-view.x / view.scale) * scale + offsetX;
    const vy = (-view.y / view.scale) * scale + offsetY;
    const vw = (cw / view.scale) * scale;
    const vh = (ch / view.scale) * scale;
    return { x: vx, y: vy, w: vw, h: vh };
  }, [minimapTransform, view]);

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!minimapTransform) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { scale, offsetX, offsetY } = minimapTransform;
    const nodeX = (mx - offsetX) / scale;
    const nodeY = (my - offsetY) / scale;
    const cw = containerRef.current?.clientWidth ?? 600;
    const ch = containerRef.current?.clientHeight ?? 400;
    setView((v) => ({
      ...v,
      x: cw / 2 - nodeX * v.scale,
      y: ch / 2 - nodeY * v.scale,
    }));
  };

  const GUIDE_EXTENT = 9999;

  const btnStyle: React.CSSProperties = {
    padding: "3px 8px",
    background: "var(--es-surface)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    cursor: "pointer",
    fontSize: 11,
  };
  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    background: active ? "var(--es-accent)" : "var(--es-surface)",
    color: active ? "#fff" : "var(--es-text)",
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
      }}
    >
      {/* Primary Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 10px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Undo/redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            ...btnStyle,
            opacity: canUndo ? 1 : 0.4,
            cursor: canUndo ? "pointer" : "default",
          }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            ...btnStyle,
            opacity: canRedo ? 1 : 0.4,
            cursor: canRedo ? "pointer" : "default",
          }}
        >
          ↪
        </button>
        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--es-border)",
            margin: "0 2px",
          }}
        />
        <button
          onClick={() => addNode("dialogue")}
          style={{
            padding: "3px 10px",
            background: "var(--es-accent)",
            border: "none",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Dialogue
        </button>
        <button
          onClick={() => addNode("choice")}
          style={{
            padding: "3px 10px",
            background: "#7c3aed",
            border: "none",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Choice
        </button>
        <button
          onClick={deleteSelected}
          disabled={!selected}
          style={{
            padding: "3px 10px",
            background: selected ? "#dc2626" : "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: selected ? "pointer" : "default",
            opacity: selected ? 1 : 0.4,
          }}
        >
          Delete
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={resetView} style={btnStyle}>
          Reset view
        </button>
        <span
          style={{
            fontSize: 10,
            color: "var(--es-text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(view.scale * 100)}%
        </span>
        <button onClick={importJSON} style={btnStyle}>
          Import
        </button>
        <button onClick={exportJSON} style={btnStyle}>
          Export
        </button>
        <button
          onClick={importVNScript}
          title="Import a .vnscript.json (DialogueTree) and convert to Story Graph"
          style={btnStyle}
        >
          Import .vnscript
        </button>
        <button
          onClick={exportVNScript}
          title="Export Story Graph as .vnscript.json for use with VNSystem"
          style={btnStyle}
        >
          Export .vnscript
        </button>
      </div>

      {/* Grid / Snap Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "4px 10px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setEditorShowGrid(!editorShowGrid)}
          style={toggleBtnStyle(editorShowGrid)}
          title="Toggle grid visibility"
        >
          Grid
        </button>
        <button
          onClick={() => setEditorSnapToGrid(!editorSnapToGrid)}
          style={toggleBtnStyle(editorSnapToGrid)}
          title="Toggle snap to grid"
        >
          Snap
        </button>
        <button
          onClick={() => setEditorShowGuides(!editorShowGuides)}
          style={toggleBtnStyle(editorShowGuides)}
          title="Toggle alignment guides"
        >
          Guides
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--es-text-muted)",
          }}
        >
          Grid size
          <input
            type="number"
            min={4}
            max={256}
            step={4}
            value={editorGridSize}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setEditorGridSize(v);
            }}
            style={{
              width: 52,
              padding: "2px 4px",
              background: "var(--es-bg)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
              fontSize: 11,
            }}
          />
        </label>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          cursor: panning ? "grabbing" : "default",
          touchAction: "none",
        }}
      >
        <svg
          ref={svgRef}
          style={{ width: "100%", height: "100%", userSelect: "none" }}
          onPointerDown={handlePointerDownSVG}
          onPointerMove={handlePointerMoveSVG}
          onPointerUp={handlePointerUpSVG}
          onPointerCancel={handlePointerUpSVG}
          onClick={() => {
            if (!dragging) setSelected(null);
          }}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="var(--es-accent)" />
            </marker>
            <pattern
              id="grid"
              width={editorGridSize * view.scale}
              height={editorGridSize * view.scale}
              x={view.x % (editorGridSize * view.scale)}
              y={view.y % (editorGridSize * view.scale)}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${editorGridSize * view.scale} 0 L 0 0 0 ${editorGridSize * view.scale}`}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={0.5}
              />
            </pattern>
          </defs>

          {editorShowGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
            {displayEdges.map((edge) => (
              <path
                key={edge.id}
                d={edgePath(edge)}
                fill="none"
                stroke="var(--es-accent)"
                strokeWidth={1.5 / view.scale}
                markerEnd="url(#arrow)"
              />
            ))}

            {displayNodes.map((node) => {
              const isSelected = selected === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  style={{
                    cursor: dragging?.id === node.id ? "grabbing" : "grab",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSelected(node.id);
                    dragStartNodesRef.current = localNodes;
                    const coords = svgCoordsFromClient(e.clientX, e.clientY);
                    setDragging({
                      id: node.id,
                      ox: coords.x - node.x,
                      oy: coords.y - node.y,
                    });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditNode({ ...node });
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={node.type === "dialogue" ? "#1e1b4b" : "#1a1a2e"}
                    stroke={
                      isSelected ? "var(--es-accent)" : "rgba(255,255,255,0.15)"
                    }
                    strokeWidth={isSelected ? 2 / view.scale : 1 / view.scale}
                  />
                  <text
                    x={8}
                    y={18}
                    fill={node.type === "dialogue" ? "#a78bfa" : "#f87171"}
                    fontSize={10}
                    fontWeight={600}
                  >
                    {node.type === "dialogue"
                      ? `🗨 ${node.speaker ?? ""}`
                      : "🔀 Choice"}
                  </text>
                  <foreignObject
                    x={6}
                    y={24}
                    width={NODE_W - 12}
                    height={NODE_H - 30}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#e2e8f0",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {node.text}
                    </div>
                  </foreignObject>
                  <circle
                    cx={0}
                    cy={NODE_H / 2}
                    r={5}
                    fill="#334155"
                    stroke="var(--es-accent)"
                    strokeWidth={1.5 / view.scale}
                  />
                  {(node.options ?? [null]).map((opt, i) => {
                    const portCount = node.options?.length ?? 1;
                    const spacing = NODE_H / (portCount + 1);
                    const py = spacing * (i + 1);
                    return (
                      <g key={i}>
                        <circle
                          cx={NODE_W}
                          cy={py}
                          r={5}
                          fill="#334155"
                          stroke="#a78bfa"
                          strokeWidth={1.5 / view.scale}
                        />
                        {opt !== null && (
                          <text
                            x={NODE_W - 8}
                            y={py + 4}
                            textAnchor="end"
                            fill="#94a3b8"
                            fontSize={9}
                          >
                            {opt}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {editorShowGuides &&
              guides.map((g, i) =>
                g.axis === "v" ? (
                  <line
                    key={i}
                    x1={g.pos}
                    y1={-GUIDE_EXTENT}
                    x2={g.pos}
                    y2={GUIDE_EXTENT}
                    stroke="#f59e0b"
                    strokeWidth={1 / view.scale}
                    strokeDasharray={`${4 / view.scale},${4 / view.scale}`}
                    pointerEvents="none"
                  />
                ) : (
                  <line
                    key={i}
                    x1={-GUIDE_EXTENT}
                    y1={g.pos}
                    x2={GUIDE_EXTENT}
                    y2={g.pos}
                    stroke="#f59e0b"
                    strokeWidth={1 / view.scale}
                    strokeDasharray={`${4 / view.scale},${4 / view.scale}`}
                    pointerEvents="none"
                  />
                ),
              )}
          </g>
        </svg>

        {displayNodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              color: "var(--es-text-muted)",
              fontSize: 13,
              gap: 6,
            }}
          >
            <div>Story Graph is empty</div>
            <div style={{ fontSize: 11 }}>
              Click + Dialogue or + Choice to add nodes
            </div>
          </div>
        )}

        {/* Minimap */}
        <div style={{ position: "absolute", bottom: 8, right: 8, zIndex: 10 }}>
          <button
            onClick={() => setShowMinimap((v) => !v)}
            title={showMinimap ? "Hide minimap" : "Show minimap"}
            style={{
              display: "block",
              marginBottom: 4,
              marginLeft: "auto",
              padding: "2px 6px",
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 4,
              color: "#fff",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ⊞
          </button>
          {showMinimap && (
            <svg
              width={MINI_W}
              height={MINI_H}
              onClick={handleMinimapClick}
              style={{
                display: "block",
                background: "rgba(0,0,0,0.75)",
                borderRadius: 8,
                padding: 4,
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "crosshair",
              }}
            >
              {minimapTransform &&
                displayNodes.map((node) => {
                  const { scale, offsetX, offsetY } = minimapTransform;
                  const mx = node.x * scale + offsetX;
                  const my = node.y * scale + offsetY;
                  const mw = NODE_W * scale;
                  const mh = NODE_H * scale;
                  const isSelected = selected === node.id;
                  return (
                    <rect
                      key={node.id}
                      x={mx}
                      y={my}
                      width={mw}
                      height={mh}
                      rx={2}
                      fill={
                        isSelected
                          ? "var(--es-accent)"
                          : node.type === "dialogue"
                            ? "#3730a3"
                            : "#1a1a2e"
                      }
                      stroke={isSelected ? "#fff" : "rgba(255,255,255,0.3)"}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                    />
                  );
                })}
              {minimapTransform && minimapViewport && (
                <rect
                  x={minimapViewport.x}
                  y={minimapViewport.y}
                  width={minimapViewport.w}
                  height={minimapViewport.h}
                  fill="rgba(255,255,255,0.08)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={1}
                />
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editNode !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 8,
              padding: 16,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 600 }}>Edit Node</div>
            {editNode.type === "dialogue" && (
              <input
                value={editNode.speaker ?? ""}
                onChange={(e) =>
                  setEditNode((n) =>
                    n ? { ...n, speaker: e.target.value } : n,
                  )
                }
                placeholder="Speaker"
                style={{
                  padding: "4px 8px",
                  background: "var(--es-bg)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-text)",
                }}
              />
            )}
            <textarea
              value={editNode.text}
              rows={4}
              onChange={(e) =>
                setEditNode((n) => (n ? { ...n, text: e.target.value } : n))
              }
              style={{
                padding: "4px 8px",
                background: "var(--es-bg)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                color: "var(--es-text)",
                resize: "vertical",
              }}
            />
            {editNode.type === "choice" &&
              editNode.options?.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 4 }}>
                  <input
                    value={opt}
                    onChange={(e) =>
                      setEditNode((n) => {
                        if (!n?.options) return n;
                        const opts = [...n.options];
                        opts[i] = e.target.value;
                        return { ...n, options: opts };
                      })
                    }
                    placeholder={`Option ${i + 1}`}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      background: "var(--es-bg)",
                      border: "1px solid var(--es-border)",
                      borderRadius: 4,
                      color: "var(--es-text)",
                    }}
                  />
                  <button
                    onClick={() =>
                      setEditNode((n) => {
                        if (!n?.options) return n;
                        return {
                          ...n,
                          options: n.options.filter((_, j) => j !== i),
                        };
                      })
                    }
                    style={{
                      padding: "2px 6px",
                      background: "none",
                      border: "1px solid var(--es-border)",
                      borderRadius: 4,
                      color: "var(--es-red)",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            {editNode.type === "choice" && (
              <button
                onClick={() =>
                  setEditNode((n) =>
                    n
                      ? {
                          ...n,
                          options: [
                            ...(n.options ?? []),
                            `Option ${(n.options?.length ?? 0) + 1}`,
                          ],
                        }
                      : n,
                  )
                }
                style={{
                  padding: "3px 8px",
                  background: "var(--es-surface)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-text)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                + Add option
              </button>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  commitNodes(
                    localNodes.map((n) =>
                      n.id === editNode.id ? editNode : n,
                    ),
                  );
                  setEditNode(null);
                }}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  background: "var(--es-accent)",
                  border: "none",
                  borderRadius: 4,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditNode(null)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  background: "var(--es-surface)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-text)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
