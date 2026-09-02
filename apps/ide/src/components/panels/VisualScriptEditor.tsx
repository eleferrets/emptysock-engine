import React, { useState, useRef, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface NodeData {
  id: string;
  type: "scene" | "entity" | "component";
  label: string;
  x: number;
  y: number;
  componentType?: string;
}

interface EdgeData {
  id: string;
  from: string; // node id
  to: string; // node id
}

interface PendingEdge {
  fromNodeId: string;
  fromSide: "output"; // only output→input connections
}

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 144;
const NODE_HEIGHT = 56;
const PORT_RADIUS = 7;

const NODE_COLORS: Record<
  NodeData["type"],
  { bg: string; border: string; icon: string }
> = {
  scene: { bg: "#4c3da8", border: "#7c6af7", icon: "🎬" },
  entity: { bg: "#1e3a8a", border: "#2563eb", icon: "📦" },
  component: { bg: "#14532d", border: "#16a34a", icon: "⚙️" },
};

const COMPONENT_TYPES = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "Animator",
  "CharacterController",
  "AudioSource",
];

let _nodeIdCounter = 100;
function nextId(): string {
  return `n${_nodeIdCounter++}`;
}

// ── Default graph ─────────────────────────────────────────────────────────────

function makeDefaultNodes(): NodeData[] {
  return [
    { id: "scene-1", type: "scene", label: "MyScene", x: 320, y: 40 },
    { id: "entity-1", type: "entity", label: "Player", x: 160, y: 160 },
    { id: "entity-2", type: "entity", label: "Enemy", x: 480, y: 160 },
    {
      id: "comp-transform",
      type: "component",
      label: "Transform",
      x: 60,
      y: 300,
      componentType: "Transform",
    },
    {
      id: "comp-sprite",
      type: "component",
      label: "Sprite",
      x: 220,
      y: 300,
      componentType: "Sprite",
    },
    {
      id: "comp-physics",
      type: "component",
      label: "PhysicsBody",
      x: 380,
      y: 300,
      componentType: "PhysicsBody",
    },
    {
      id: "comp-anim",
      type: "component",
      label: "Animator",
      x: 540,
      y: 300,
      componentType: "Animator",
    },
  ];
}

function makeDefaultEdges(): EdgeData[] {
  return [
    { id: "e1", from: "scene-1", to: "entity-1" },
    { id: "e2", from: "scene-1", to: "entity-2" },
    { id: "e3", from: "entity-1", to: "comp-transform" },
    { id: "e4", from: "entity-1", to: "comp-sprite" },
    { id: "e5", from: "entity-2", to: "comp-physics" },
    { id: "e6", from: "entity-2", to: "comp-anim" },
  ];
}

// ── Code generation ──────────────────────────────────────────────────────────

function generateCode(nodes: NodeData[], edges: EdgeData[]): string {
  const sceneNodes = nodes.filter((n) => n.type === "scene");
  const componentNodes = nodes.filter((n) => n.type === "component");

  // Build adjacency: scene→entities, entity→components
  const sceneToEntities: Record<string, NodeData[]> = {};
  const entityToComponents: Record<string, NodeData[]> = {};

  for (const e of edges) {
    const fromNode = nodes.find((n) => n.id === e.from);
    const toNode = nodes.find((n) => n.id === e.to);
    if (!fromNode || !toNode) continue;
    if (fromNode.type === "scene" && toNode.type === "entity") {
      if (sceneToEntities[fromNode.id] === undefined)
        sceneToEntities[fromNode.id] = [];
      (sceneToEntities[fromNode.id] as NodeData[]).push(toNode);
    }
    if (fromNode.type === "entity" && toNode.type === "component") {
      if (entityToComponents[fromNode.id] === undefined)
        entityToComponents[fromNode.id] = [];
      (entityToComponents[fromNode.id] as NodeData[]).push(toNode);
    }
  }

  const usedComponents = new Set(
    componentNodes.map((c) => c.componentType ?? c.label),
  );
  const imports = ["Scene", "Entity", ...Array.from(usedComponents)].join(", ");

  const lines: string[] = [
    "// Auto-generated from Visual Script graph",
    `import { ${imports} } from '@emptysock/engine';`,
    "",
  ];

  for (const scene of sceneNodes) {
    const entities = sceneToEntities[scene.id] ?? [];
    const className = scene.label.replace(/\s+/g, "") || "MyScene";
    lines.push(`class ${className} extends Scene {`);
    lines.push("  onLoad(): void {");
    for (const entity of entities) {
      const varName =
        entity.label
          .replace(/\s+/g, "")
          .replace(/^./, (c) => c.toLowerCase()) || "entity";
      lines.push(
        `    const ${varName} = this.createEntity(); // ${entity.label}`,
      );
      const comps = entityToComponents[entity.id] ?? [];
      for (const comp of comps) {
        const ct = comp.componentType ?? comp.label;
        lines.push(`    ${varName}.addComponent(new ${ct}());`);
      }
      lines.push("");
    }
    lines.push("  }");
    lines.push("");
    lines.push("  onDestroy(): void {}");
    lines.push("}");
    lines.push("");
    lines.push(`export default ${className};`);
  }

  if (sceneNodes.length === 0) {
    lines.push(
      "// No scene node found — add a Scene node and connect entities to it.",
    );
  }

  return lines.join("\n");
}

// ── Port geometry helpers ─────────────────────────────────────────────────────

function outputPortCenter(node: NodeData): { x: number; y: number } {
  return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
}

function inputPortCenter(node: NodeData): { x: number; y: number } {
  return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
}

function hitTestPort(
  node: NodeData,
  mx: number,
  my: number,
  side: "input" | "output",
): boolean {
  const c = side === "output" ? outputPortCenter(node) : inputPortCenter(node);
  return Math.hypot(mx - c.x, my - c.y) <= PORT_RADIUS + 4;
}

// ── SVG cubic bezier edge path ────────────────────────────────────────────────

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5 + 40;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ── Main component ────────────────────────────────────────────────────────────

const MIN_VS_SCALE = 0.25;
const MAX_VS_SCALE = 2.5;

export function VisualScriptEditor(): React.ReactElement {
  const [nodes, setNodes] = useState<NodeData[]>(makeDefaultNodes);
  const [edges, setEdges] = useState<EdgeData[]>(makeDefaultEdges);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [vsScale, setVsScale] = useState(1);
  const [vsPanX, setVsPanX] = useState(0);
  const [vsPanY, setVsPanY] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const lastClickTime = useRef<Record<string, number>>({});

  // Mirror state into refs so touch handlers read current values without stale closures
  const vsScaleRef = useRef(vsScale);
  const vsPanXRef = useRef(vsPanX);
  const vsPanYRef = useRef(vsPanY);
  vsScaleRef.current = vsScale;
  vsPanXRef.current = vsPanX;
  vsPanYRef.current = vsPanY;

  // Active pointer tracking for pan (single pointer) and pinch (two pointers)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Wheel zoom on the outer scroll container (ctrl/meta = zoom, bare scroll = ignored)
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setVsScale((s) =>
        Math.min(MAX_VS_SCALE, Math.max(MIN_VS_SCALE, s * delta)),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pointer-based pan (single finger / mouse) + pinch zoom (two fingers)
  const onOuterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    // Only handle pan/pinch on the outer container itself, not node drags
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: vsPanXRef.current,
        panY: vsPanYRef.current,
      };
      pinchStartRef.current = null;
    } else if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        pinchStartRef.current = { dist, scale: vsScaleRef.current };
      }
      panStartRef.current = null;
    }
  }, []);

  const onOuterPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setVsPanX(panStartRef.current.panX + dx);
      setVsPanY(panStartRef.current.panY + dy);
    } else if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1 && pinchStartRef.current.dist > 0) {
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const ratio = dist / pinchStartRef.current.dist;
        setVsScale(Math.min(MAX_VS_SCALE, Math.max(MIN_VS_SCALE, pinchStartRef.current.scale * ratio)));
      }
    }
  }, []);

  const onOuterPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) pinchStartRef.current = null;
    if (activePointersRef.current.size === 0) panStartRef.current = null;
  }, []);

  // ── Canvas coordinate from mouse event ────────────────────────────────────

  const toCanvas = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / vsScale,
        y: (e.clientY - rect.top) / vsScale,
      };
    },
    [vsScale],
  );

  // ── Mouse move on canvas: update mouse pos for pending edge preview ────────

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (pendingEdge || dragging.current) {
        const pos = toCanvas(e);
        setMousePos(pos);
        if (dragging.current) {
          const { nodeId, offsetX, offsetY } = dragging.current;
          setNodes((ns) =>
            ns.map((n) =>
              n.id === nodeId
                ? { ...n, x: pos.x - offsetX, y: pos.y - offsetY }
                : n,
            ),
          );
        }
      }
    },
    [pendingEdge, toCanvas],
  );

  const onCanvasMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  // ── Click blank canvas: cancel pending edge ───────────────────────────────

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setPendingEdge(null);
    setEditingNodeId(null);
  }, []);

  // ── Node mouse down: start drag or port click ──────────────────────────────

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, node: NodeData) => {
      e.stopPropagation();
      const pos = toCanvas(e);

      // Check output port hit
      if (hitTestPort(node, pos.x, pos.y, "output")) {
        setMousePos(pos);
        setPendingEdge({ fromNodeId: node.id, fromSide: "output" });
        return;
      }

      // Check input port hit
      if (hitTestPort(node, pos.x, pos.y, "input")) {
        if (pendingEdge) {
          // Complete edge: pending→this node input
          if (pendingEdge.fromNodeId !== node.id) {
            const edgeId = `e-${pendingEdge.fromNodeId}-${node.id}`;
            const alreadyExists = edges.some(
              (ed) => ed.from === pendingEdge.fromNodeId && ed.to === node.id,
            );
            if (!alreadyExists) {
              setEdges((eds) => [
                ...eds,
                { id: edgeId, from: pendingEdge.fromNodeId, to: node.id },
              ]);
            }
          }
          setPendingEdge(null);
          return;
        }
        return;
      }

      // Double-click to rename
      const now = Date.now();
      const last = lastClickTime.current[node.id] ?? 0;
      if (now - last < 350) {
        setEditingNodeId(node.id);
        setEditLabel(node.label);
        lastClickTime.current[node.id] = 0;
        return;
      }
      lastClickTime.current[node.id] = now;

      // Start drag
      dragging.current = {
        nodeId: node.id,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
      };
    },
    [pendingEdge, edges, toCanvas],
  );

  // ── Add nodes ─────────────────────────────────────────────────────────────

  const addEntity = useCallback(() => {
    const id = nextId();
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "entity",
        label: "Entity",
        x: 150 + Math.random() * 300,
        y: 150 + Math.random() * 100,
      },
    ]);
  }, []);

  const addComponent = useCallback((type: string) => {
    const id = nextId();
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "component",
        label: type,
        x: 100 + Math.random() * 400,
        y: 280 + Math.random() * 100,
        componentType: type,
      },
    ]);
  }, []);

  const clear = useCallback(() => {
    setNodes(makeDefaultNodes());
    setEdges(makeDefaultEdges());
    setGeneratedCode(null);
    setPendingEdge(null);
    setEditingNodeId(null);
  }, []);

  const exportCode = useCallback(() => {
    const code = generateCode(nodes, edges);
    setGeneratedCode(code);
    navigator.clipboard.writeText(code).catch(() => {
      /* clipboard may be unavailable */
    });
  }, [nodes, edges]);

  const commitLabel = useCallback(
    (nodeId: string) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId ? { ...n, label: editLabel || n.label } : n,
        ),
      );
      setEditingNodeId(null);
    },
    [editLabel],
  );

  // ── Delete edge on click ──────────────────────────────────────────────────

  const deleteEdge = useCallback((edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((ed) => ed.id !== edgeId));
  }, []);

  // ── Canvas dimensions ──────────────────────────────────────────────────────

  const canvasWidth = 800;
  const canvasHeight = 480;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg, #1a1a2e)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderBottom: "1px solid var(--es-border, #333)",
          background: "var(--es-surface, #16213e)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button onClick={addEntity} style={btnStyle("#2563eb")}>
          + Entity
        </button>

        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) addComponent(e.target.value);
            e.target.value = "";
          }}
          style={selectStyle}
        >
          <option value="" disabled>
            + Component
          </option>
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button onClick={exportCode} style={btnStyle("#7c6af7")}>
          Export Code
        </button>
        <button onClick={clear} style={btnStyleGhost}>
          Clear
        </button>
        <button
          onClick={() => {
            setVsScale(1);
            setVsPanX(0);
            setVsPanY(0);
          }}
          style={{ ...btnStyleGhost, marginLeft: "auto" }}
        >
          Reset view
        </button>
        <span
          style={{
            fontSize: 10,
            color: "var(--es-text-muted, #888)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(vsScale * 100)}%
        </span>
        <span style={{ fontSize: 11, color: "var(--es-text-muted, #888)" }}>
          Ctrl+scroll to zoom • Click ports to connect • Double-click to rename
        </span>
      </div>

      {/* Canvas area */}
      <div
        ref={outerRef}
        onPointerDown={onOuterPointerDown}
        onPointerMove={onOuterPointerMove}
        onPointerUp={onOuterPointerUp}
        onPointerCancel={onOuterPointerUp}
        style={{ flex: 1, overflow: "auto", position: "relative", touchAction: "none" }}
      >
        <div
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onClick={onCanvasClick}
          style={{
            position: "relative",
            width: canvasWidth,
            height: canvasHeight,
            minWidth: "100%",
            minHeight: "100%",
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 23px, var(--es-border, #333) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, var(--es-border, #333) 24px)",
            backgroundSize: `${24 * vsScale}px ${24 * vsScale}px`,
            userSelect: "none",
            cursor: pendingEdge ? "crosshair" : "default",
            transform: `translate(${vsPanX}px, ${vsPanY}px) scale(${vsScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* SVG layer for edges */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#7c6af7" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const p1 = outputPortCenter(fromNode);
              const p2 = inputPortCenter(toNode);
              return (
                <g key={edge.id}>
                  {/* Invisible wide hit area for click-to-delete */}
                  <path
                    d={edgePath(p1.x, p1.y, p2.x, p2.y)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) =>
                      deleteEdge(edge.id, e as unknown as React.MouseEvent)
                    }
                  />
                  <path
                    d={edgePath(p1.x, p1.y, p2.x, p2.y)}
                    fill="none"
                    stroke="#7c6af7"
                    strokeWidth={2}
                    opacity={0.8}
                    markerEnd="url(#arrowhead)"
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
            {/* Pending edge preview */}
            {pendingEdge &&
              (() => {
                const fromNode = nodes.find(
                  (n) => n.id === pendingEdge.fromNodeId,
                );
                if (!fromNode) return null;
                const p1 = outputPortCenter(fromNode);
                return (
                  <path
                    d={edgePath(p1.x, p1.y, mousePos.x, mousePos.y)}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    style={{ pointerEvents: "none" }}
                  />
                );
              })()}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = NODE_COLORS[node.type];
            const isEditing = editingNodeId === node.id;
            const canHaveInput = node.type !== "scene"; // scene has no parent
            const canHaveOutput = node.type !== "component"; // components are leaves

            return (
              <div
                key={node.id}
                data-node={node.id}
                onMouseDown={(e) => onNodeMouseDown(e, node)}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px",
                  gap: 8,
                  cursor:
                    dragging.current?.nodeId === node.id ? "grabbing" : "grab",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                  zIndex: 10,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                  {colors.icon}
                </span>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={() => commitLabel(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitLabel(node.id);
                      if (e.key === "Escape") setEditingNodeId(null);
                    }}
                    style={{
                      flex: 1,
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: 3,
                      color: "#fff",
                      fontSize: 12,
                      padding: "2px 4px",
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {node.label}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.5)",
                    flexShrink: 0,
                  }}
                >
                  {node.type}
                </span>

                {/* Input port */}
                {canHaveInput && (
                  <div
                    style={{
                      position: "absolute",
                      left: -PORT_RADIUS,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: PORT_RADIUS * 2,
                      height: PORT_RADIUS * 2,
                      borderRadius: "50%",
                      background: pendingEdge ? "#ef4444" : "#cbd5e1",
                      border: "2px solid rgba(255,255,255,0.4)",
                      cursor: "crosshair",
                      zIndex: 20,
                      boxShadow: pendingEdge ? "0 0 8px #ef4444" : undefined,
                    }}
                    title="Input port"
                  />
                )}

                {/* Output port */}
                {canHaveOutput && (
                  <div
                    style={{
                      position: "absolute",
                      right: -PORT_RADIUS,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: PORT_RADIUS * 2,
                      height: PORT_RADIUS * 2,
                      borderRadius: "50%",
                      background: colors.border,
                      border: "2px solid rgba(255,255,255,0.4)",
                      cursor: "crosshair",
                      zIndex: 20,
                    }}
                    title="Output port (drag to connect)"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Generated code panel */}
      {generatedCode !== null && (
        <div
          style={{
            borderTop: "1px solid var(--es-border, #333)",
            background: "var(--es-surface, #16213e)",
            maxHeight: 200,
            overflow: "auto",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "4px 12px",
              borderBottom: "1px solid var(--es-border, #333)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--es-text-muted, #888)",
                flex: 1,
              }}
            >
              Generated TypeScript (copied to clipboard)
            </span>
            <button
              onClick={() => setGeneratedCode(null)}
              style={{ ...btnStyleGhost, padding: "2px 8px", fontSize: 11 }}
            >
              ✕
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "8px 12px",
              fontSize: 11,
              color: "#e2e8f0",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
            }}
          >
            {generatedCode}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 4,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
  };
}

const btnStyleGhost: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid var(--es-border, #444)",
  background: "transparent",
  color: "var(--es-text, #e2e8f0)",
  cursor: "pointer",
  fontSize: 12,
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid var(--es-border, #444)",
  background: "var(--es-surface, #16213e)",
  color: "var(--es-text, #e2e8f0)",
  cursor: "pointer",
  fontSize: 12,
};
