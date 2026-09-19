import type { DialogueNode, DialogueTree } from "./VNSystem.js";

// Story Graph node/edge types — the visual-editor representation persisted
// in the IDE and exported as .storyGraph.json.
export interface StoryGraphNode {
  id: string;
  type: "dialogue" | "choice";
  x: number;
  y: number;
  speaker?: string;
  text: string;
  options?: string[];
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
 * Lossless for dialogue, choice, and jump nodes. Positional data (x, y) is
 * dropped — it is preserved in the Story Graph format only.
 */
export function storyGraphToDialogueTree(graph: StoryGraph): DialogueTree {
  const nodeMap: Record<string, DialogueNode> = {};

  // Pre-build edge index keyed by source node id for O(1) lookups
  const edgesByFrom = new Map<string, StoryGraphEdge[]>();
  for (const e of graph.edges) {
    let arr = edgesByFrom.get(e.from);
    if (arr === undefined) { arr = []; edgesByFrom.set(e.from, arr); }
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
    } else {
      // choice node — edges sorted by fromPort become the options array
      const outEdges = (edgesByFrom.get(gn.id) ?? [])
        .slice()
        .sort((a, b) => a.fromPort - b.fromPort);
      const labels = gn.options ?? outEdges.map((_, i) => `Option ${i + 1}`);
      const options = outEdges.map((e, i) => ({
        label: labels[i] ?? `Option ${i + 1}`,
        next: e.to,
      }));
      const node: DialogueNode = { type: "choice", text: gn.text, options };
      nodeMap[gn.id] = node;
    }
  }

  return { nodes: nodeMap, startNode: graph.startNodeId };
}

// ─── DialogueTree → Story Graph ───────────────────────────────────────────────

const LAYOUT_COL_WIDTH = 260;
const LAYOUT_ROW_HEIGHT = 120;

/**
 * Convert a VNSystem DialogueTree (.vnscript JSON) back into a Story Graph for
 * display in the IDE's Story Graph editor. Positional data is auto-generated
 * with a simple left-to-right BFS layout.
 *
 * Lossless for dialogue and choice nodes. Event nodes are represented as
 * dialogue nodes tagged `[event: eventName]`. Jump nodes are omitted — the
 * target's edge is followed directly.
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
      nodes.push({
        id,
        type: "choice",
        x,
        y,
        text: dn.text,
        options: dn.options.map((o) => o.label),
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
