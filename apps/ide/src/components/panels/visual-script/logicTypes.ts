import type { VSNode, VSNodeKind, VSConnection } from "@emptysock/engine";

// ── Editor-side node shape ───────────────────────────────────────────────────
//
// A VSNode plus canvas layout. `next` is derived from `connections` on save
// and is not authored directly by the editor.

export type LogicNode = VSNode & { x: number; y: number };

export interface LogicGraphState {
  nodes: LogicNode[];
  connections: VSConnection[];
}

export interface LogicPendingEdge {
  fromNodeId: string;
  fromPort: number;
}

// ── Layout constants ─────────────────────────────────────────────────────────

export const LNODE_WIDTH = 168;
export const LNODE_HEADER = 26;
export const LPORT_ROW = 18;
export const LPORT_RADIUS = 6;
export const MIN_LS_SCALE = 0.25;
export const MAX_LS_SCALE = 2.5;

interface KindMeta {
  label: string;
  color: string;
  hasInput: boolean;
  /** Output port labels, in port-index order. Empty = no execution output. */
  outputs: string[];
}

export const KIND_META: Record<VSNodeKind, KindMeta> = {
  onUpdate: {
    label: "On Update",
    color: "var(--es-node-scene-border)",
    hasInput: false,
    outputs: [""],
  },
  onEvent: {
    label: "On Event",
    color: "var(--es-node-scene-border)",
    hasInput: false,
    outputs: [""],
  },
  sequence: {
    label: "Sequence",
    color: "var(--es-node-entity-border)",
    hasInput: true,
    outputs: [""],
  },
  branch: {
    label: "Branch",
    color: "var(--es-accent)",
    hasInput: true,
    outputs: ["true", "false"],
  },
  getVariable: {
    label: "Get Variable",
    color: "var(--es-node-component-border)",
    hasInput: true,
    outputs: [""],
  },
  setVariable: {
    label: "Set Variable",
    color: "var(--es-node-component-border)",
    hasInput: true,
    outputs: [""],
  },
  getSwitch: {
    label: "Get Switch",
    color: "var(--es-node-component-border)",
    hasInput: true,
    outputs: [""],
  },
  setSwitch: {
    label: "Set Switch",
    color: "var(--es-node-component-border)",
    hasInput: true,
    outputs: [""],
  },
  sendMessage: {
    label: "Send Message",
    color: "var(--es-red)",
    hasInput: true,
    outputs: [""],
  },
};

export const PALETTE_KINDS: VSNodeKind[] = [
  "onUpdate",
  "onEvent",
  "sequence",
  "branch",
  "getVariable",
  "setVariable",
  "getSwitch",
  "setSwitch",
  "sendMessage",
];

export function nodeHeight(kind: VSNodeKind): number {
  const outputs = KIND_META[kind].outputs.length;
  return LNODE_HEADER + Math.max(1, outputs) * LPORT_ROW + 8;
}
