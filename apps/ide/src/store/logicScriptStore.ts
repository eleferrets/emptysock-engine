import { create } from "zustand";
import type { VisualScriptGraph } from "@emptysock/engine";

// ── State / actions ──────────────────────────────────────────────────────────
//
// Holds the real VisualScriptGraph shape (nodes + connections) that
// VisualScriptComponent's constructor and VisualScriptGraphBuilder both
// produce/consume. The panel saves exactly this shape — zero translation
// is needed to drop it into `new VisualScriptComponent({ graph })`.
//
// Node canvas positions are session-only editor state (not part of the
// runtime graph shape) and are kept separately so the saved graph never
// carries x/y fields that VisualScriptComponent doesn't know about.

interface LogicScriptLayoutEntry {
  x: number;
  y: number;
}

interface LogicScriptStoreState {
  logicScriptGraph: VisualScriptGraph | null;
  logicScriptLayout: Record<string, LogicScriptLayoutEntry>;
  setLogicScriptGraph: (graph: VisualScriptGraph) => void;
  setLogicScriptLayout: (
    layout: Record<string, LogicScriptLayoutEntry>,
  ) => void;
  resetLogicScriptStore: () => void;
}

export const useLogicScriptStore = create<LogicScriptStoreState>((set) => ({
  logicScriptGraph: null,
  logicScriptLayout: {},

  setLogicScriptGraph: (graph) => set({ logicScriptGraph: graph }),
  setLogicScriptLayout: (layout) => set({ logicScriptLayout: layout }),

  resetLogicScriptStore: () =>
    set({ logicScriptGraph: null, logicScriptLayout: {} }),
}));
