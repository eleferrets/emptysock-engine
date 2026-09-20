// Pure state-transform helpers for authoring condition nodes and when-gated
// choice options in the Story Graph panel. Kept separate from
// VNNodeEditModal.tsx (a React component) so the actual mutation logic is
// unit-testable without a DOM/render harness.

import type { VNNode, VariableCondition } from "./persistence";

export function defaultCondition(): VariableCondition {
  return { kind: "switch", index: 1, equals: true };
}

/** Mirrors VNScriptConvert's describeCondition — kept local so the IDE
 * package doesn't need a round-trip through the engine just to label a node. */
export function describeCondition(condition: VariableCondition): string {
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

/** Sets a `"condition"` node's gate, updating its auto-derived label text. */
export function setNodeCondition(
  node: VNNode,
  condition: VariableCondition,
): VNNode {
  return { ...node, condition, text: describeCondition(condition) };
}

/**
 * Enables or disables the `when` gate on choice option `index`, growing
 * `optionWhens` to match `options` length on first use.
 */
export function toggleOptionWhen(
  node: VNNode,
  index: number,
  enabled: boolean,
): VNNode {
  const opts: Array<VariableCondition | undefined> = node.optionWhens
    ? [...node.optionWhens]
    : new Array<VariableCondition | undefined>(node.options?.length ?? 0).fill(
        undefined,
      );
  opts[index] = enabled ? defaultCondition() : undefined;
  return { ...node, optionWhens: opts };
}

/** Replaces the `when` condition at choice option `index`. */
export function updateOptionWhen(
  node: VNNode,
  index: number,
  condition: VariableCondition,
): VNNode {
  const opts = node.optionWhens ? [...node.optionWhens] : [];
  opts[index] = condition;
  return { ...node, optionWhens: opts };
}

/** Removes choice option `index`, keeping `optionWhens` aligned by index. */
export function removeOption(node: VNNode, index: number): VNNode {
  if (!node.options) return node;
  return {
    ...node,
    options: node.options.filter((_, j) => j !== index),
    ...(node.optionWhens !== undefined
      ? { optionWhens: node.optionWhens.filter((_, j) => j !== index) }
      : {}),
  };
}
