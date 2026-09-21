import type { DialogueTree } from "./VNSystem.js";
import type { VariableCondition } from "./VariableStore.js";
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
/**
 * Convert a Story Graph (visual-editor format) to a VNSystem DialogueTree
 * (.vnscript JSON). The returned tree is ready to pass to `new VNSystem().load()`.
 *
 * Lossless for dialogue, choice (including per-option `when`), condition, and
 * jump nodes. Positional data (x, y) is dropped — it is preserved in the
 * Story Graph format only.
 */
export declare function storyGraphToDialogueTree(
  graph: StoryGraph,
): DialogueTree;
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
export declare function dialogueTreeToStoryGraph(
  tree: DialogueTree,
): StoryGraph;
