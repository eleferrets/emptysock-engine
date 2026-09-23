import type { DialogueNode, DialogueTree } from "./VNSystem.js";
import type { VariableCondition } from "@emptysock/engine/ecs";

// Story Graph node/edge types — the visual-editor representation persisted
// in the IDE and exported as .storyGraph.json.
export interface StoryGraphNode {
  id: string;
  type: "dialogue" | "choice" | "condition";
  x: number;
  y: number;
  speaker?: string;
  text: string;
  options?: string[];
  /**
   * Per-option `when` gate, aligned by index with `options`. Present only on
   * `"choice"` nodes; an `undefined` entry (or a shorter/absent array) means
   * that option has no condition and is always shown.
   */
  optionWhens?: Array<VariableCondition | undefined>;
  /** Present only on `"condition"` nodes — the gate evaluated to pick a branch. */
  condition?: VariableCondition;
}

export interface StoryGraphEdge {
  id: string;
  from: string;
  fromPort: number;
  to: string;
}

export interface StoryGraph {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  startNodeId: string;
}

// ─── Story Graph → DialogueTree ───────────────────────────────────────────────

/**
 * Convert a Story Graph (visual-editor format) to a VNSystem DialogueTree
 * (.vnscript JSON). The returned tree is ready to pass to `new VNSystem().load()`.
 *
 * Lossless for dialogue, choice (including per-option `when`), condition, and
 * jump nodes. Positional data (x, y) is dropped — it is preserved in the
 * Story Graph format only.
 */
export function storyGraphToDialogueTree(graph: StoryGraph): DialogueTree {
  const nodeMap: Record<string, DialogueNode> = {};

  // Pre-build edge index keyed by source node id for O(1) lookups
  const edgesByFrom = new Map<string, StoryGraphEdge[]>();
  for (const e of graph.edges) {
    let arr = edgesByFrom.get(e.from);
    if (arr === undefined) {
      arr = [];
      edgesByFrom.set(e.from, arr);
    }
    arr.push(e);
  }

  for (const gn of graph.nodes) {
    if (gn.type === "dialogue") {
      const outEdges = edgesByFrom.get(gn.id);
      const nextEdge = outEdges?.find((e) => e.fromPort === 0);
      const node: DialogueNode = {
        type: "dialogue",
        speaker: gn.speaker ?? "",
        text: gn.text,
        ...(nextEdge !== undefined ? { next: nextEdge.to } : {}),
      };
      nodeMap[gn.id] = node;
    } else if (gn.type === "condition") {
      // fromPort 0 is the "true" branch, fromPort 1 is the optional "false" branch
      const outEdges = edgesByFrom.get(gn.id) ?? [];
      const trueEdge = outEdges.find((e) => e.fromPort === 0);
      const falseEdge = outEdges.find((e) => e.fromPort === 1);
      if (gn.condition === undefined || trueEdge === undefined) {
        // Malformed condition node (no condition configured, or no "true"
        // branch wired up) — nothing sane to emit, so skip it rather than
        // produce a DialogueTree with an invalid/dangling node.
        continue;
      }
      const node: DialogueNode = {
        type: "condition",
        condition: gn.condition,
        ifTrue: trueEdge.to,
        ...(falseEdge !== undefined ? { ifFalse: falseEdge.to } : {}),
      };
      nodeMap[gn.id] = node;
    } else {
      // choice node — edges sorted by fromPort become the options array
      const outEdges = (edgesByFrom.get(gn.id) ?? [])
        .slice()
        .sort((a, b) => a.fromPort - b.fromPort);
      const labels = gn.options ?? outEdges.map((_, i) => `Option ${i + 1}`);
      const options = outEdges.map((e, i) => {
        const when = gn.optionWhens?.[i];
        return {
          label: labels[i] ?? `Option ${i + 1}`,
          next: e.to,
          ...(when !== undefined ? { when } : {}),
        };
      });
      const node: DialogueNode = { type: "choice", text: gn.text, options };
      nodeMap[gn.id] = node;
    }
  }

  return { nodes: nodeMap, startNode: graph.startNodeId };
}

// ─── DialogueTree → Story Graph ───────────────────────────────────────────────

const LAYOUT_COL_WIDTH = 260;
const LAYOUT_ROW_HEIGHT = 120;

/** Human-readable summary of a `VariableCondition`, used as a condition node's label. */
function describeCondition(condition: VariableCondition): string {
  if (condition.kind === "switch") {
    return `switch[${condition.index}] == ${String(condition.equals)}`;
  }
  const ops: Record<typeof condition.op, string> = {
    eq: "==",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
  };
  return `var[${condition.index}] ${ops[condition.op]} ${condition.value}`;
}

/**
 * Convert a VNSystem DialogueTree (.vnscript JSON) back into a Story Graph for
 * display in the IDE's Story Graph editor. Positional data is auto-generated
 * with a simple left-to-right BFS layout.
 *
 * Lossless for dialogue, choice (including per-option `when`), and condition
 * nodes. Event nodes are represented as dialogue nodes tagged
 * `[event: eventName]`. Jump nodes are omitted — the target's edge is
 * followed directly.
 */
export function dialogueTreeToStoryGraph(tree: DialogueTree): StoryGraph {
  const nodes: StoryGraphNode[] = [];
  const edges: StoryGraphEdge[] = [];
  let edgeCounter = 0;

  // BFS layout
  const visited = new Set<string>();
  const queue: Array<{ id: string; col: number; row: number }> = [
    { id: tree.startNode, col: 0, row: 0 },
  ];
  const colRowCount: Record<number, number> = {};

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) break;
    const { id, col, row } = item;
    if (visited.has(id)) continue;
    visited.add(id);

    const dn = tree.nodes[id];
    if (dn === undefined) continue;

    const x = col * LAYOUT_COL_WIDTH + 40;
    const y = row * LAYOUT_ROW_HEIGHT + 40;
    colRowCount[col] = (colRowCount[col] ?? 0) + 1;

    if (dn.type === "dialogue") {
      nodes.push({
        id,
        type: "dialogue",
        x,
        y,
        speaker: dn.speaker,
        text: dn.text,
      });
      if (dn.next !== undefined) {
        edges.push({
          id: `e${edgeCounter++}`,
          from: id,
          fromPort: 0,
          to: dn.next,
        });
        const nextRow = colRowCount[col + 1] ?? 0;
        queue.push({ id: dn.next, col: col + 1, row: nextRow });
      }
    } else if (dn.type === "event") {
      nodes.push({
        id,
        type: "dialogue",
        x,
        y,
        speaker: "[event]",
        text: `${dn.eventName}`,
      });
      if (dn.next !== undefined) {
        edges.push({
          id: `e${edgeCounter++}`,
          from: id,
          fromPort: 0,
          to: dn.next,
        });
        const nextRow = colRowCount[col + 1] ?? 0;
        queue.push({ id: dn.next, col: col + 1, row: nextRow });
      }
    } else if (dn.type === "choice") {
      // Only emit optionWhens when at least one option actually has a `when`
      // — keeps the common (no conditions) case free of a dangling all-undefined array.
      const hasWhen = dn.options.some((o) => o.when !== undefined);
      nodes.push({
        id,
        type: "choice",
        x,
        y,
        text: dn.text,
        options: dn.options.map((o) => o.label),
        ...(hasWhen ? { optionWhens: dn.options.map((o) => o.when) } : {}),
      });
      dn.options.forEach((opt, i) => {
        edges.push({
          id: `e${edgeCounter++}`,
          from: id,
          fromPort: i,
          to: opt.next,
        });
        const nextRow = colRowCount[col + 1] ?? 0;
        queue.push({ id: opt.next, col: col + 1, row: nextRow });
        colRowCount[col + 1] = (colRowCount[col + 1] ?? 0) + 1;
      });
    } else if (dn.type === "condition") {
      nodes.push({
        id,
        type: "condition",
        x,
        y,
        text: describeCondition(dn.condition),
        condition: dn.condition,
      });
      edges.push({
        id: `e${edgeCounter++}`,
        from: id,
        fromPort: 0,
        to: dn.ifTrue,
      });
      const trueRow = colRowCount[col + 1] ?? 0;
      queue.push({ id: dn.ifTrue, col: col + 1, row: trueRow });
      colRowCount[col + 1] = (colRowCount[col + 1] ?? 0) + 1;
      if (dn.ifFalse !== undefined) {
        edges.push({
          id: `e${edgeCounter++}`,
          from: id,
          fromPort: 1,
          to: dn.ifFalse,
        });
        const falseRow = colRowCount[col + 1] ?? 0;
        queue.push({ id: dn.ifFalse, col: col + 1, row: falseRow });
        colRowCount[col + 1] = (colRowCount[col + 1] ?? 0) + 1;
      }
    } else if (dn.type === "jump") {
      // Flatten jump nodes — don't add a graph node, just follow the target
      if (!visited.has(dn.target)) {
        const nextRow = colRowCount[col] ?? 0;
        queue.push({ id: dn.target, col, row: nextRow });
      }
    }
  }

  return { nodes, edges, startNodeId: tree.startNode };
}
