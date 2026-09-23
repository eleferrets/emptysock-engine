import type {
  VSNode,
  VSNodeKind,
  VSConnection,
  VisualScriptGraph,
} from "@emptysock/engine/ecs";
import type { LogicNode, LogicGraphState } from "./logicTypes";
import {
  LNODE_WIDTH,
  LNODE_HEADER,
  LPORT_ROW,
  nodeHeight,
  KIND_META,
} from "./logicTypes";

let _idCounter = 100;
export function nextLogicId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${_idCounter}`;
}

/** Build a fresh node of `kind` with sane default field values and a canvas position. */
export function makeLogicNode<K extends VSNodeKind>(
  kind: K,
  x: number,
  y: number,
): Extract<LogicNode, { kind: K }>;
export function makeLogicNode(
  kind: VSNodeKind,
  x: number,
  y: number,
): LogicNode {
  const id = nextLogicId(kind);
  const base = { id, next: [] as string[], x, y };
  switch (kind) {
    case "onUpdate":
      return { ...base, kind };
    case "onEvent":
      return { ...base, kind, eventType: "hit" };
    case "sequence":
      return { ...base, kind };
    case "branch":
      return { ...base, kind, variableIndex: 0, comparator: "eq", value: 0 };
    case "getVariable":
      return { ...base, kind, variableIndex: 0, outputKey: "v" };
    case "setVariable":
      return { ...base, kind, variableIndex: 0, value: 0 };
    case "getSwitch":
      return { ...base, kind, switchIndex: 0, outputKey: "s" };
    case "setSwitch":
      return { ...base, kind, switchIndex: 0, value: true };
    case "sendMessage":
      return { ...base, kind, targetActorId: "", messageType: "" };
  }
}

export function makeDefaultLogicGraph(): LogicGraphState {
  const start = makeLogicNode("onUpdate", 60, 60);
  return { nodes: [start], connections: [] };
}

export function outputPortCenter(
  node: LogicNode,
  port: number,
): { x: number; y: number } {
  return {
    x: node.x + LNODE_WIDTH,
    y: node.y + LNODE_HEADER + LPORT_ROW * port + LPORT_ROW / 2,
  };
}

export function inputPortCenter(node: LogicNode): { x: number; y: number } {
  return { x: node.x, y: node.y + nodeHeight(node.kind) / 2 };
}

export function hitTestOutputPort(
  node: LogicNode,
  mx: number,
  my: number,
): number | null {
  const outputs = KIND_META[node.kind].outputs;
  for (let port = 0; port < outputs.length; port++) {
    const c = outputPortCenter(node, port);
    if (Math.hypot(mx - c.x, my - c.y) <= 10) return port;
  }
  return null;
}

export function hitTestInputPort(
  node: LogicNode,
  mx: number,
  my: number,
): boolean {
  if (!KIND_META[node.kind].hasInput) return false;
  const c = inputPortCenter(node);
  return Math.hypot(mx - c.x, my - c.y) <= 10;
}

export function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = Math.abs(x2 - x1) * 0.5 + 40;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/**
 * Derives each node's `next[]` from the connections list, and strips
 * editor-only x/y fields, producing exactly the VisualScriptGraph shape
 * VisualScriptComponent's constructor and VisualScriptGraphBuilder consume.
 */
export function toVisualScriptGraph(state: LogicGraphState): VisualScriptGraph {
  const nodes: VSNode[] = state.nodes.map((n) => {
    const next: string[] = [];
    for (const conn of state.connections) {
      if (conn.from === n.id) {
        next[conn.fromPort ?? 0] = conn.to;
      }
    }
    const { x: _x, y: _y, ...rest } = n;
    void _x;
    void _y;
    return { ...rest, next } as VSNode;
  });
  return { nodes, connections: state.connections.map((c) => ({ ...c })) };
}

/** Rehydrate editor state (adds layout) from a saved VisualScriptGraph + a position map. */
export function fromVisualScriptGraph(
  graph: VisualScriptGraph,
  layout: Record<string, { x: number; y: number }>,
): LogicGraphState {
  const nodes: LogicNode[] = graph.nodes.map((n, i) => {
    const pos = layout[n.id] ?? {
      x: 80 + (i % 4) * 200,
      y: 60 + Math.floor(i / 4) * 140,
    };
    return { ...n, x: pos.x, y: pos.y } as LogicNode;
  });
  return { nodes, connections: graph.connections.map((c) => ({ ...c })) };
}

export function connectionId(
  from: string,
  to: string,
  fromPort: number,
): string {
  return `lc-${from}-${fromPort}-${to}`;
}

export function removeConnectionsForNode(
  connections: VSConnection[],
  nodeId: string,
): VSConnection[] {
  return connections.filter((c) => c.from !== nodeId && c.to !== nodeId);
}
