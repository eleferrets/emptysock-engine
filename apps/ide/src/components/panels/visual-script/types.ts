// ── Types ─────────────────────────────────────────────────────────────────────

export interface NodeData {
  id: string;
  type: "scene" | "entity" | "component";
  label: string;
  x: number;
  y: number;
  componentType?: string;
}

export interface EdgeData {
  id: string;
  from: string;
  to: string;
}

export interface PendingEdge {
  fromNodeId: string;
  fromSide: "output";
}

export interface GraphState {
  nodes: NodeData[];
  edges: EdgeData[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const NODE_WIDTH = 144;
export const NODE_HEIGHT = 56;
export const PORT_RADIUS = 7;
export const MIN_VS_SCALE = 0.25;
export const MAX_VS_SCALE = 2.5;

export const NODE_COLORS: Record<
  NodeData["type"],
  { bg: string; border: string; icon: string }
> = {
  scene: {
    bg: "var(--es-node-scene-bg)",
    border: "var(--es-node-scene-border)",
    icon: "🎬",
  },
  entity: {
    bg: "var(--es-node-entity-bg)",
    border: "var(--es-node-entity-border)",
    icon: "📦",
  },
  component: {
    bg: "var(--es-node-component-bg)",
    border: "var(--es-node-component-border)",
    icon: "⚙️",
  },
};

export const COMPONENT_TYPES = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "Animator",
  "CharacterController",
  "AudioSource",
];
