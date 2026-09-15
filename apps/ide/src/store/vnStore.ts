import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VnNode {
  id: string;
  [key: string]: unknown;
}

// ── State / actions ──────────────────────────────────────────────────────────

interface VNStoreState {
  vnNodes: VnNode[];
  setVNNodes: (nodes: VnNode[]) => void;
  resetVNStore: () => void;
}

export const useVNStore = create<VNStoreState>((set) => ({
  vnNodes: [],

  setVNNodes: (nodes) => set({ vnNodes: nodes }),

  resetVNStore: () => set({ vnNodes: [] }),
}));
