import React from "react";
import type { VNNode, VNEdge, ViewTransform } from "./persistence";
import { NODE_W, NODE_H, MINI_W, MINI_H } from "./constants";

// ── VNMinimap ─────────────────────────────────────────────────────────────────

interface VNMinimapProps {
  nodes: VNNode[];
  edges: VNEdge[];
  view: ViewTransform;
  selected: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onViewChange: React.Dispatch<React.SetStateAction<ViewTransform>>;
}

export function VNMinimap({
  nodes,
  edges,
  view,
  selected,
  containerRef,
  onViewChange,
}: VNMinimapProps): React.ReactElement {
  const [showMinimap, setShowMinimap] = React.useState(true);
  const minimapCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const minimapIsDragging = React.useRef(false);

  // Compute the scale/offset that fits all nodes into the minimap canvas
  const minimapTransform = React.useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
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
    return { scale, offsetX, offsetY };
  }, [nodes]);

  // Redraw minimap canvas whenever graph, view, or selection changes
  React.useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, MINI_W, MINI_H);

    if (!minimapTransform || nodes.length === 0) return;
    const { scale, offsetX, offsetY } = minimapTransform;

    // Edges
    ctx.strokeStyle = "rgba(139,92,246,0.7)";
    ctx.lineWidth = 0.8;
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;
      const portCount = Math.max(1, fromNode.options?.length ?? 1);
      const fromSpacing = NODE_H / (portCount + 1);
      const x1 = (fromNode.x + NODE_W) * scale + offsetX;
      const y1 =
        (fromNode.y + fromSpacing * (edge.fromPort + 1)) * scale + offsetY;
      const x2 = toNode.x * scale + offsetX;
      const y2 = (toNode.y + NODE_H / 2) * scale + offsetY;
      const cpx = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cpx, y1, cpx, y2, x2, y2);
      ctx.stroke();
    }

    // Nodes
    for (const node of nodes) {
      const mx = node.x * scale + offsetX;
      const my = node.y * scale + offsetY;
      const mw = NODE_W * scale;
      const mh = NODE_H * scale;
      const isSelectedNode = selected === node.id;
      ctx.fillStyle = isSelectedNode
        ? "#6d28d9"
        : node.type === "dialogue"
          ? "#3730a3"
          : "#1a1a2e";
      ctx.strokeStyle = isSelectedNode ? "#fff" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = isSelectedNode ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.rect(mx, my, mw, mh);
      ctx.fill();
      ctx.stroke();
    }

    // Viewport rectangle
    const cw = containerRef.current?.clientWidth ?? 600;
    const ch = containerRef.current?.clientHeight ?? 400;
    const vx = (-view.x / view.scale) * scale + offsetX;
    const vy = (-view.y / view.scale) * scale + offsetY;
    const vw = (cw / view.scale) * scale;
    const vh = (ch / view.scale) * scale;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.fill();
    ctx.stroke();
  }, [nodes, edges, minimapTransform, view, selected, containerRef]);

  // Pan main canvas to a minimap canvas coordinate
  const panToMinimapPoint = React.useCallback(
    (clientX: number, clientY: number, canvas: HTMLCanvasElement): void => {
      if (!minimapTransform) return;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const { scale, offsetX, offsetY } = minimapTransform;
      const nodeX = (mx - offsetX) / scale;
      const nodeY = (my - offsetY) / scale;
      const cw = containerRef.current?.clientWidth ?? 600;
      const ch = containerRef.current?.clientHeight ?? 400;
      onViewChange((v) => ({
        ...v,
        x: cw / 2 - nodeX * v.scale,
        y: ch / 2 - nodeY * v.scale,
      }));
    },
    [minimapTransform, containerRef, onViewChange],
  );

  const handleMinimapPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    minimapIsDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    panToMinimapPoint(e.clientX, e.clientY, e.currentTarget);
  };

  const handleMinimapPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    if (!minimapIsDragging.current) return;
    panToMinimapPoint(e.clientX, e.clientY, e.currentTarget);
  };

  const handleMinimapPointerUp = (): void => {
    minimapIsDragging.current = false;
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 4,
      }}
    >
      <button
        onClick={() => setShowMinimap((v) => !v)}
        title={showMinimap ? "Hide minimap" : "Show minimap"}
        style={{
          padding: "2px 7px",
          background: showMinimap
            ? "var(--es-accent)"
            : "color-mix(in srgb, var(--es-bg) 60%, transparent)",
          border: "1px solid var(--es-border)",
          borderRadius: 4,
          color: "var(--es-text-on-accent)",
          cursor: "pointer",
          fontSize: 11,
          lineHeight: "16px",
        }}
      >
        Map
      </button>
      {showMinimap && (
        <canvas
          ref={minimapCanvasRef}
          width={MINI_W}
          height={MINI_H}
          onPointerDown={handleMinimapPointerDown}
          onPointerMove={handleMinimapPointerMove}
          onPointerUp={handleMinimapPointerUp}
          onPointerCancel={handleMinimapPointerUp}
          style={{
            display: "block",
            background: "color-mix(in srgb, var(--es-bg) 82%, transparent)",
            borderRadius: 6,
            border: "1px solid var(--es-border)",
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
      )}
    </div>
  );
}
