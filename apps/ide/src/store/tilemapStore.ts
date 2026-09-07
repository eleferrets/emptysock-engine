import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TileLayer {
  id: string;
  name: string;
  data: Record<string, number>; // "col,row" -> tileIndex
}

export interface AutoTileRule {
  [key: string]: unknown;
}

// ── Initial data ─────────────────────────────────────────────────────────────

const INITIAL_TILEMAP_LAYERS: TileLayer[] = [
  { id: "layer-0", name: "Ground", data: {} },
  { id: "layer-1", name: "Objects", data: {} },
];

// ── State / actions ──────────────────────────────────────────────────────────

interface TilemapStoreState {
  tilemapLayers: TileLayer[];
  tilemapActiveLayer: string;
  autoTileRuleSets: Record<string, AutoTileRule[]>;
  setTilemapLayers: (layers: TileLayer[]) => void;
  setTilemapActiveLayer: (id: string) => void;
  setAutoTileRuleSets: (ruleSets: Record<string, AutoTileRule[]>) => void;
  resetTilemapStore: () => void;
}

const INITIAL_TILEMAP_STATE = {
  tilemapLayers: INITIAL_TILEMAP_LAYERS,
  tilemapActiveLayer: "layer-0",
  autoTileRuleSets: {} as Record<string, AutoTileRule[]>,
};

export const useTilemapStore = create<TilemapStoreState>((set) => ({
  ...INITIAL_TILEMAP_STATE,

  setTilemapLayers: (layers) => set({ tilemapLayers: layers }),
  setTilemapActiveLayer: (id) => set({ tilemapActiveLayer: id }),
  setAutoTileRuleSets: (ruleSets) => set({ autoTileRuleSets: ruleSets }),

  resetTilemapStore: () =>
    set({
      tilemapLayers: INITIAL_TILEMAP_LAYERS,
      tilemapActiveLayer: "layer-0",
      autoTileRuleSets: {},
    }),
}));
