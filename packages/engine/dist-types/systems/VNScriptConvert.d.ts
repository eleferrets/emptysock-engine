import type { DialogueTree } from "./VNSystem.js";
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
/**
 * Convert a Story Graph (visual-editor format) to a VNSystem DialogueTree
 * (.vnscript JSON). The returned tree is ready to pass to `new VNSystem().load()`.
 *
 * Lossless for dialogue, choice, and jump nodes. Positional data (x, y) is
 * dropped — it is preserved in the Story Graph format only.
 */
export declare function storyGraphToDialogueTree(
  graph: StoryGraph,
): DialogueTree;
/**
 * Convert a VNSystem DialogueTree (.vnscript JSON) back into a Story Graph for
 * display in the IDE's Story Graph editor. Positional data is auto-generated
 * with a simple left-to-right BFS layout.
 *
 * Lossless for dialogue and choice nodes. Event nodes are represented as
 * dialogue nodes tagged `[event: eventName]`. Jump nodes are omitted — the
 * target's edge is followed directly.
 */
export declare function dialogueTreeToStoryGraph(
  tree: DialogueTree,
): StoryGraph;
