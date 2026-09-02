import React from "react";
import {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "@emptysock/engine";
import { useIDEStore } from "../../store/ideStore";

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
  pos: number; // canvas coordinate (pre-transform)
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
const GUIDE_THRESHOLD = 6; // pixels in canvas space

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

function loadGraph(): { nodes: VNNode[]; edges: VNEdge[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { nodes: VNNode[]; edges: VNEdge[] };
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
  const [nodes, setNodes] = React.useState<VNNode[]>(saved.nodes);
  const [edges, setEdges] = React.useState<VNEdge[]>(saved.edges);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState<{
    id: string;
    ox: number;
    oy: number;
  } | null>(null);
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

  // Persist on change and sync nodes to ideStore for VN Preview
  React.useEffect(() => {
    saveGraph(nodes, edges);
    setVNNodes(nodes);
  }, [nodes, edges, setVNNodes]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selected &&
        editNode === null
      ) {
        e.preventDefault();
        setNodes((prev) => prev.filter((n) => n.id !== selected));
        setEdges((prev) =>
          prev.filter((ed) => ed.from !== selected && ed.to !== selected),
        );
        setSelected(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, editNode]);

  // Wheel zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setView((v) => {
        const newScale = clampScale(v.scale * delta);
        const ratio = newScale / v.scale;
        return {
          scale: newScale,
          x: mx - ratio * (mx - v.x),
          y: my - ratio * (my - v.y),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const nodeById = (id: string): VNNode | undefined =>
    nodes.find((n) => n.id === id);

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

  // Compute alignment guides for the dragging node against all other nodes
  const computeGuides = (
    dragNode: VNNode,
    allNodes: VNNode[],
  ): GuideLine[] => {
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

      // Vertical guides (x positions)
      for (const dx of [dLeft, dRight, dCenterX]) {
        for (const ox of [oLeft, oRight, oCenterX]) {
          if (Math.abs(dx - ox) < GUIDE_THRESHOLD) {
            result.push({ axis: "v", pos: ox });
          }
        }
      }
      // Horizontal guides (y positions)
      for (const dy of [dTop, dBottom, dMiddleY]) {
        for (const oy of [oTop, oBottom, oMiddleY]) {
          if (Math.abs(dy - oy) < GUIDE_THRESHOLD) {
            result.push({ axis: "h", pos: oy });
          }
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return result.filter((g) => {
      const key = `${g.axis}:${g.pos}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (
      e.target === svgRef.current ||
      (e.target as SVGElement).tagName === "svg"
    ) {
      setSelected(null);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        originX: view.x,
        originY: view.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (dragging) {
      const coords = svgCoordsFromClient(e.clientX, e.clientY);
      let nx = coords.x - dragging.ox;
      let ny = coords.y - dragging.oy;
      if (editorSnapToGrid) {
        nx = snapValue(nx, editorGridSize);
        ny = snapValue(ny, editorGridSize);
      }
      setNodes((prev) => {
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

  const handleMouseUp = (): void => {
    setDragging(null);
    setPanning(null);
    setGuides([]);
  };

  // Touch support: one-finger pan, two-finger pinch
  const lastTouchRef = React.useRef<{
    x: number;
    y: number;
    dist: number;
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>): void => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 1 && t0) {
      lastTouchRef.current = { x: t0.clientX, y: t0.clientY, dist: 0 };
    } else if (e.touches.length === 2 && t0 && t1) {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      lastTouchRef.current = { x: 0, y: 0, dist: Math.sqrt(dx * dx + dy * dy) };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>): void => {
    e.preventDefault();
    if (!lastTouchRef.current) return;
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 1 && !dragging && t0) {
      const dx = t0.clientX - lastTouchRef.current.x;
      const dy = t0.clientY - lastTouchRef.current.y;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      lastTouchRef.current = { x: t0.clientX, y: t0.clientY, dist: 0 };
    } else if (e.touches.length === 2 && t0 && t1) {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / (lastTouchRef.current.dist || dist);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = midX - rect.left;
        const my = midY - rect.top;
        setView((v) => {
          const newScale = clampScale(v.scale * ratio);
          const r = newScale / v.scale;
          return {
            scale: newScale,
            x: mx - r * (mx - v.x),
            y: my - r * (my - v.y),
          };
        });
      }
      lastTouchRef.current = { x: 0, y: 0, dist };
    }
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
    setNodes((prev) => [...prev, newNode]);
  };

  const deleteSelected = (): void => {
    if (!selected) return;
    setNodes((prev) => prev.filter((n) => n.id !== selected));
    setEdges((prev) =>
      prev.filter((e) => e.from !== selected && e.to !== selected),
    );
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
          if (Array.isArray(data.nodes)) setNodes(data.nodes);
          if (Array.isArray(data.edges)) setEdges(data.edges);
        } catch {
          /* invalid */
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportJSON = (): void => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
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
          if (typeof tree.startNode !== "string" || typeof tree.nodes !== "object") return;
          const graph = dialogueTreeToStoryGraph(
            tree as Parameters<typeof dialogueTreeToStoryGraph>[0],
          );
          setNodes(graph.nodes as VNNode[]);
          setEdges(graph.edges as VNEdge[]);
        } catch {
          /* invalid file */
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const exportVNScript = (): void => {
    const startNodeId = nodes[0]?.id ?? "";
    const tree = storyGraphToDialogueTree({ nodes: nodes as Parameters<typeof storyGraphToDialogueTree>[0]["nodes"], edges, startNodeId });
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "story.vnscript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetView = (): void => setView({ x: 0, y: 0, scale: 1 });

  // SVG size for guide lines — large enough to span the viewport
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
        <button
          onClick={resetView}
          style={btnStyle}
        >
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
        <button
          onClick={importJSON}
          style={btnStyle}
        >
          Import
        </button>
        <button
          onClick={exportJSON}
          style={btnStyle}
        >
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => {
            setDragging(null);
            lastTouchRef.current = null;
            setGuides([]);
          }}
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

          {/* Background grid — shown only when editorShowGrid is true */}
          {editorShowGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
            {/* Edges */}
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edgePath(edge)}
                fill="none"
                stroke="var(--es-accent)"
                strokeWidth={1.5 / view.scale}
                markerEnd="url(#arrow)"
              />
            ))}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selected === node.id;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  style={{
                    cursor: dragging?.id === node.id ? "grabbing" : "grab",
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelected(node.id);
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
                  {/* Input port */}
                  <circle
                    cx={0}
                    cy={NODE_H / 2}
                    r={5}
                    fill="#334155"
                    stroke="var(--es-accent)"
                    strokeWidth={1.5 / view.scale}
                  />
                  {/* Output ports */}
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

            {/* Alignment guide lines — rendered inside the transform group so they
                use canvas coordinates and scale with the view */}
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

        {/* Hint overlay */}
        {nodes.length === 0 && (
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
                        const opts = n.options.filter((_, j) => j !== i);
                        return { ...n, options: opts };
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
                  setNodes((prev) =>
                    prev.map((n) => (n.id === editNode.id ? editNode : n)),
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
