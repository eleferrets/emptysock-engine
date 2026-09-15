import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VSNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  componentType?: string;
}

export interface VSEdge {
  id: string;
  from: string;
  to: string;
}

// ── State / actions ──────────────────────────────────────────────────────────

interface VSStoreState {
  visualScriptGraph: { nodes: VSNode[]; edges: VSEdge[] } | null;
  setVisualScriptGraph: (graph: { nodes: VSNode[]; edges: VSEdge[] }) => void;
  resetVSStore: () => void;
}

export const useVSStore = create<VSStoreState>((set) => ({
  visualScriptGraph: null,

  setVisualScriptGraph: (graph) => set({ visualScriptGraph: graph }),

  resetVSStore: () => set({ visualScriptGraph: null }),
}));
