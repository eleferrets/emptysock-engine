// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeType = "dialogue" | "choice";

export interface VNNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  speaker?: string;
  text: string;
  options?: string[];
}

export interface VNEdge {
  id: string;
  from: string;
  fromPort: number;
  to: string;
}

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export interface GuideLine {
  axis: "h" | "v";
  pos: number;
}

export interface GraphState {
  nodes: VNNode[];
  edges: VNEdge[];
}

// ── Seed data ─────────────────────────────────────────────────────────────────

export const INITIAL_NODES: VNNode[] = [
  {
    id: "n1",
    type: "dialogue",
    x: 60,
    y: 80,
    speaker: "Hero",
    text: "Hello, traveller.",
  },
  {
    id: "n2",
    type: "choice",
    x: 320,
    y: 80,
    text: "Choose a response",
    options: ["Who are you?", "Goodbye."],
  },
  {
    id: "n3",
    type: "dialogue",
    x: 580,
    y: 40,
    speaker: "Hero",
    text: "I am the last guardian.",
  },
  {
    id: "n4",
    type: "dialogue",
    x: 580,
    y: 160,
    speaker: "Hero",
    text: "Safe travels.",
  },
];

export const INITIAL_EDGES: VNEdge[] = [
  { id: "e1", from: "n1", fromPort: 0, to: "n2" },
  { id: "e2", from: "n2", fromPort: 0, to: "n3" },
  { id: "e3", from: "n2", fromPort: 1, to: "n4" },
];

// ── Storage key ───────────────────────────────────────────────────────────────

export const STORAGE_KEY = "es-story-graph";

// ── Persistence helpers ───────────────────────────────────────────────────────

export function loadGraph(): GraphState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GraphState;
  } catch {
    /* ignore */
  }
  return { nodes: INITIAL_NODES, edges: INITIAL_EDGES };
}

export function saveGraph(nodes: VNNode[], edges: VNEdge[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  } catch {
    /* storage full */
  }
}
