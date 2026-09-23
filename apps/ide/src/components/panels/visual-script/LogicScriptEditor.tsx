import React, { useState, useRef, useCallback, useEffect } from "react";
import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { useHistory } from "../../../hooks/useHistory";
import { useLogicScriptStore } from "../../../store/logicScriptStore";
import type {
  VSNode,
  VSNodeKind,
  BranchNode,
  SetVariableNode,
} from "@emptysock/engine/ecs";
import type {
  LogicNode,
  LogicGraphState,
  LogicPendingEdge,
} from "./logicTypes";
import {
  LNODE_WIDTH,
  LPORT_RADIUS,
  MIN_LS_SCALE,
  MAX_LS_SCALE,
  KIND_META,
  PALETTE_KINDS,
  nodeHeight,
} from "./logicTypes";
import {
  makeLogicNode,
  makeDefaultLogicGraph,
  outputPortCenter,
  inputPortCenter,
  hitTestOutputPort,
  hitTestInputPort,
  edgePath,
  toVisualScriptGraph,
  fromVisualScriptGraph,
  connectionId,
  removeConnectionsForNode,
} from "./logicHelpers";

const EMPTY_QUIPS = [
  "No logic yet. The game plays itself, badly.",
  "An onUpdate node is the front door. Start there.",
  "Zero nodes, zero bugs. Enjoy it while it lasts.",
];

export function LogicScriptEditor(): React.ReactElement {
  const storedGraph = useLogicScriptStore((s) => s.logicScriptGraph);
  const storedLayout = useLogicScriptStore((s) => s.logicScriptLayout);
  const setLogicScriptGraph = useLogicScriptStore((s) => s.setLogicScriptGraph);
  const setLogicScriptLayout = useLogicScriptStore(
    (s) => s.setLogicScriptLayout,
  );

  const initial: LogicGraphState =
    storedGraph !== null
      ? fromVisualScriptGraph(storedGraph, storedLayout)
      : makeDefaultLogicGraph();

  const {
    state: graph,
    set: setGraph,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<LogicGraphState>(initial);

  const nodes = graph.nodes;
  const connections = graph.connections;

  // Sync to store on every change (real VisualScriptGraph shape, zero translation).
  useEffect(() => {
    setLogicScriptGraph(toVisualScriptGraph(graph));
    const layout: Record<string, { x: number; y: number }> = {};
    for (const n of graph.nodes) layout[n.id] = { x: n.x, y: n.y };
    setLogicScriptLayout(layout);
  }, [graph, setLogicScriptGraph, setLogicScriptLayout]);

  const [pendingEdge, setPendingEdge] = useState<LogicPendingEdge | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const quip = useRef(
    EMPTY_QUIPS[Math.floor(Math.random() * EMPTY_QUIPS.length)],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo) redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedId !== null &&
          document.activeElement?.tagName !== "INPUT"
        ) {
          e.preventDefault();
          setGraph((g) => ({
            nodes: g.nodes.filter((n) => n.id !== selectedId),
            connections: removeConnectionsForNode(g.connections, selectedId),
          }));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, undo, redo, selectedId, setGraph]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) =>
        Math.min(MAX_LS_SCALE, Math.max(MIN_LS_SCALE, s * delta)),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toCanvas = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (pendingEdge || dragging.current) {
        const pos = toCanvas(e);
        setMousePos(pos);
        if (dragging.current) {
          const { nodeId, offsetX, offsetY } = dragging.current;
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, x: pos.x - offsetX, y: pos.y - offsetY }
                : n,
            ),
          }));
        }
      }
    },
    [pendingEdge, toCanvas, setGraph],
  );

  const onCanvasMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-lnode]")) return;
    setPendingEdge(null);
    setSelectedId(null);
  }, []);

  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, node: LogicNode) => {
      e.stopPropagation();
      const pos = toCanvas(e);

      const outPort = hitTestOutputPort(node, pos.x, pos.y);
      if (outPort !== null) {
        setMousePos(pos);
        setPendingEdge({ fromNodeId: node.id, fromPort: outPort });
        return;
      }

      if (hitTestInputPort(node, pos.x, pos.y)) {
        if (pendingEdge && pendingEdge.fromNodeId !== node.id) {
          const id = connectionId(
            pendingEdge.fromNodeId,
            node.id,
            pendingEdge.fromPort,
          );
          setGraph((g) => {
            const withoutSamePort = g.connections.filter(
              (c) =>
                !(
                  c.from === pendingEdge.fromNodeId &&
                  c.fromPort === pendingEdge.fromPort
                ),
            );
            return {
              ...g,
              connections: [
                ...withoutSamePort,
                {
                  id,
                  from: pendingEdge.fromNodeId,
                  to: node.id,
                  fromPort: pendingEdge.fromPort,
                },
              ],
            };
          });
        }
        setPendingEdge(null);
        return;
      }

      setSelectedId(node.id);
      dragging.current = {
        nodeId: node.id,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
      };
    },
    [pendingEdge, toCanvas, setGraph],
  );

  const addNode = useCallback(
    (kind: VSNodeKind) => {
      const node = makeLogicNode(
        kind,
        80 + Math.random() * 300,
        80 + Math.random() * 200,
      );
      setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
      setSelectedId(node.id);
    },
    [setGraph],
  );

  const deleteConnection = useCallback(
    (connId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setGraph((g) => ({
        ...g,
        connections: g.connections.filter((c) => c.id !== connId),
      }));
    },
    [setGraph],
  );

  const clear = useCallback(() => {
    setGraph(makeDefaultLogicGraph());
    setSelectedId(null);
    setPendingEdge(null);
  }, [setGraph]);

  const updateNode = useCallback(
    (id: string, patch: Partial<VSNode>) => {
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === id ? ({ ...n, ...patch } as LogicNode) : n,
        ),
      }));
    },
    [setGraph],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) addNode(e.target.value as VSNodeKind);
            e.target.value = "";
          }}
          style={selectStyle}
          title="Add node"
        >
          <option value="" disabled>
            + Node
          </option>
          {PALETTE_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </select>

        <button onClick={clear} style={btnStyleGhost}>
          Clear
        </button>

        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{ ...btnStyleGhost, opacity: canUndo ? 1 : 0.35 }}
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{ ...btnStyleGhost, opacity: canRedo ? 1 : 0.35 }}
        >
          <RotateCw size={13} />
        </button>

        <span
          style={{
            fontSize: 11,
            color: "var(--es-text-muted)",
            marginLeft: "auto",
          }}
        >
          Click a port to connect • Select + Delete to remove
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div
          ref={outerRef}
          style={{ flex: 1, overflow: "auto", position: "relative" }}
        >
          <div
            ref={canvasRef}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onClick={onCanvasClick}
            style={{
              position: "relative",
              width: 1400,
              height: 900,
              background:
                "repeating-linear-gradient(0deg, transparent, transparent 23px, var(--es-border) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, var(--es-border) 24px)",
              backgroundSize: `${24 * scale}px ${24 * scale}px`,
              userSelect: "none",
              cursor: pendingEdge ? "crosshair" : "default",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
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
              {connections.map((conn) => {
                const fromNode = nodes.find((n) => n.id === conn.from);
                const toNode = nodes.find((n) => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                const p1 = outputPortCenter(fromNode, conn.fromPort ?? 0);
                const p2 = inputPortCenter(toNode);
                return (
                  <g key={conn.id}>
                    <path
                      d={edgePath(p1.x, p1.y, p2.x, p2.y)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={(e) =>
                        deleteConnection(
                          conn.id,
                          e as unknown as React.MouseEvent,
                        )
                      }
                    />
                    <path
                      d={edgePath(p1.x, p1.y, p2.x, p2.y)}
                      fill="none"
                      strokeWidth={2}
                      opacity={0.85}
                      style={{
                        stroke: "var(--es-accent)",
                        pointerEvents: "none",
                      }}
                    />
                  </g>
                );
              })}
              {pendingEdge &&
                (() => {
                  const fromNode = nodes.find(
                    (n) => n.id === pendingEdge.fromNodeId,
                  );
                  if (!fromNode) return null;
                  const p1 = outputPortCenter(fromNode, pendingEdge.fromPort);
                  return (
                    <path
                      d={edgePath(p1.x, p1.y, mousePos.x, mousePos.y)}
                      fill="none"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      style={{ stroke: "var(--es-red)", pointerEvents: "none" }}
                    />
                  );
                })()}
            </svg>

            {nodes.map((node) => {
              const meta = KIND_META[node.kind];
              const h = nodeHeight(node.kind);
              const isSelected = selectedId === node.id;
              return (
                <div
                  key={node.id}
                  data-lnode={node.id}
                  onMouseDown={(e) => onNodeMouseDown(e, node)}
                  style={{
                    position: "absolute",
                    left: node.x,
                    top: node.y,
                    width: LNODE_WIDTH,
                    height: h,
                    background: "var(--es-surface)",
                    border: `2px solid ${isSelected ? "var(--es-accent)" : meta.color}`,
                    borderRadius: 8,
                    cursor:
                      dragging.current?.nodeId === node.id
                        ? "grabbing"
                        : "grab",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    zIndex: 10,
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      background: meta.color,
                      color: "var(--es-text-on-accent)",
                      padding: "4px 8px",
                      borderRadius: "6px 6px 0 0",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {meta.label}
                  </div>

                  {meta.outputs.map((portLabel, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 26 + i * 18 + 9,
                        fontSize: 9,
                        color: "var(--es-text-muted)",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {portLabel}
                    </div>
                  ))}

                  {meta.hasInput && (
                    <div
                      title="Input"
                      style={{
                        position: "absolute",
                        left: -LPORT_RADIUS,
                        top: h / 2,
                        transform: "translateY(-50%)",
                        width: LPORT_RADIUS * 2,
                        height: LPORT_RADIUS * 2,
                        borderRadius: "50%",
                        background: pendingEdge ? "var(--es-red)" : "#cbd5e1",
                        border: "2px solid rgba(255,255,255,0.4)",
                        cursor: "crosshair",
                        zIndex: 20,
                      }}
                    />
                  )}

                  {meta.outputs.map((_, i) => (
                    <div
                      key={i}
                      title={`Output${meta.outputs[i] ? ` (${meta.outputs[i]})` : ""}`}
                      style={{
                        position: "absolute",
                        right: -LPORT_RADIUS,
                        top: 26 + i * 18 + 9,
                        transform: "translateY(-50%)",
                        width: LPORT_RADIUS * 2,
                        height: LPORT_RADIUS * 2,
                        borderRadius: "50%",
                        background: meta.color,
                        border: "2px solid rgba(255,255,255,0.4)",
                        cursor: "crosshair",
                        zIndex: 20,
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>

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
              <div>No nodes yet</div>
              <div style={{ fontSize: 11 }}>{quip.current}</div>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodePropertyPanel
            node={selectedNode}
            onChange={(patch) => updateNode(selectedNode.id, patch)}
            onDelete={() => {
              setGraph((g) => ({
                nodes: g.nodes.filter((n) => n.id !== selectedNode.id),
                connections: removeConnectionsForNode(
                  g.connections,
                  selectedNode.id,
                ),
              }));
              setSelectedId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Property panel ────────────────────────────────────────────────────────────

function NodePropertyPanel(props: {
  node: LogicNode;
  onChange: (patch: Partial<VSNode>) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { node, onChange, onDelete } = props;

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        borderLeft: "1px solid var(--es-border)",
        background: "var(--es-surface)",
        padding: 12,
        overflowY: "auto",
        fontSize: 12,
        color: "var(--es-text)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <strong style={{ flex: 1 }}>{KIND_META[node.kind].label}</strong>
        <button
          onClick={onDelete}
          title="Delete node"
          style={{ ...btnStyleGhost, padding: "2px 6px" }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {node.kind === "onEvent" && (
        <Field label="Event type">
          <input
            style={inputStyle}
            value={node.eventType}
            onChange={(e) => onChange({ eventType: e.target.value })}
          />
        </Field>
      )}

      {node.kind === "branch" && (
        <BranchFields node={node} onChange={onChange} />
      )}

      {(node.kind === "getVariable" || node.kind === "getSwitch") && (
        <>
          <Field
            label={
              node.kind === "getVariable" ? "Variable index" : "Switch index"
            }
          >
            <input
              type="number"
              style={inputStyle}
              value={
                node.kind === "getVariable"
                  ? node.variableIndex
                  : node.switchIndex
              }
              onChange={(e) =>
                onChange(
                  node.kind === "getVariable"
                    ? { variableIndex: Number(e.target.value) }
                    : { switchIndex: Number(e.target.value) },
                )
              }
            />
          </Field>
          <Field label="Output key">
            <input
              style={inputStyle}
              value={node.outputKey}
              onChange={(e) => onChange({ outputKey: e.target.value })}
            />
          </Field>
        </>
      )}

      {node.kind === "setVariable" && (
        <SetVariableFields node={node} onChange={onChange} />
      )}

      {node.kind === "setSwitch" && (
        <>
          <Field label="Switch index">
            <input
              type="number"
              style={inputStyle}
              value={node.switchIndex}
              onChange={(e) =>
                onChange({ switchIndex: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Value">
            <select
              style={inputStyle}
              value={node.value ? "true" : "false"}
              onChange={(e) => onChange({ value: e.target.value === "true" })}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </Field>
        </>
      )}

      {node.kind === "sendMessage" && (
        <>
          <Field label="Target actor id">
            <input
              style={inputStyle}
              value={node.targetActorId}
              onChange={(e) => onChange({ targetActorId: e.target.value })}
            />
          </Field>
          <Field label="Message type">
            <input
              style={inputStyle}
              value={node.messageType}
              onChange={(e) => onChange({ messageType: e.target.value })}
            />
          </Field>
        </>
      )}

      {(node.kind === "onUpdate" || node.kind === "sequence") && (
        <div style={{ color: "var(--es-text-muted)", fontSize: 11 }}>
          No configurable fields.
        </div>
      )}
    </div>
  );
}

function BranchFields(props: {
  node: BranchNode;
  onChange: (patch: Partial<VSNode>) => void;
}): React.ReactElement {
  const { node, onChange } = props;
  return (
    <>
      <Field label="Variable index">
        <input
          type="number"
          style={inputStyle}
          value={node.variableIndex}
          onChange={(e) => onChange({ variableIndex: Number(e.target.value) })}
        />
      </Field>
      <Field label="Comparator">
        <select
          style={inputStyle}
          value={node.comparator}
          onChange={(e) =>
            onChange({ comparator: e.target.value as BranchNode["comparator"] })
          }
        >
          {(["eq", "neq", "gt", "lt", "gte", "lte"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Value">
        <input
          type="number"
          style={inputStyle}
          value={node.value}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

function SetVariableFields(props: {
  node: SetVariableNode;
  onChange: (patch: Partial<VSNode>) => void;
}): React.ReactElement {
  const { node, onChange } = props;
  const usesKey = typeof node.value === "object";
  return (
    <>
      <Field label="Variable index">
        <input
          type="number"
          style={inputStyle}
          value={node.variableIndex}
          onChange={(e) => onChange({ variableIndex: Number(e.target.value) })}
        />
      </Field>
      <Field label="Value source">
        <select
          style={inputStyle}
          value={usesKey ? "key" : "literal"}
          onChange={(e) =>
            onChange({ value: e.target.value === "key" ? { fromKey: "" } : 0 })
          }
        >
          <option value="literal">Literal number</option>
          <option value="key">From upstream key</option>
        </select>
      </Field>
      {usesKey ? (
        <Field label="From key">
          <input
            style={inputStyle}
            value={(node.value as { fromKey: string }).fromKey}
            onChange={(e) => onChange({ value: { fromKey: e.target.value } })}
          />
        </Field>
      ) : (
        <Field label="Literal value">
          <input
            type="number"
            style={inputStyle}
            value={node.value as number}
            onChange={(e) => onChange({ value: Number(e.target.value) })}
          />
        </Field>
      )}
    </>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const btnStyleGhost: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 4,
  border: "1px solid var(--es-border)",
  background: "transparent",
  color: "var(--es-text)",
  cursor: "pointer",
  fontSize: 12,
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid var(--es-border)",
  background: "var(--es-surface)",
  color: "var(--es-text)",
  cursor: "pointer",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid var(--es-border)",
  background: "var(--es-bg)",
  color: "var(--es-text)",
  fontSize: 12,
};
