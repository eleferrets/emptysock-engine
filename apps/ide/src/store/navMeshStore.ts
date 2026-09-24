import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────
//
// Mirrors `@emptysock/tilemap`'s `NavPolygon`/`NavMeshData` shape
// (`packages/tilemap/src/NavMeshSystem.ts`) exactly, using plain mutable
// arrays instead of `ReadonlyArray`, so a loaded/exported JSON file round-trips
// into `NavMeshSystem.load()` with zero transformation.

export interface NavMeshVec2 {
  x: number;
  y: number;
}

export interface EditorNavPolygon {
  id: number;
  vertices: NavMeshVec2[];
  centroid: NavMeshVec2;
  /** IDs of adjacent walkable polygons. */
  neighbours: number[];
}

export interface EditorNavMeshData {
  polygons: EditorNavPolygon[];
}

const INITIAL_NAVMESH: EditorNavMeshData = { polygons: [] };

// ── State / actions ──────────────────────────────────────────────────────────

interface NavMeshStoreState {
  navMeshPolygons: EditorNavPolygon[];
  navMeshNextId: number;
  setNavMeshPolygons: (polygons: EditorNavPolygon[]) => void;
  allocateNavMeshId: () => number;
  resetNavMeshStore: () => void;
}

export const useNavMeshStore = create<NavMeshStoreState>((set, get) => ({
  navMeshPolygons: INITIAL_NAVMESH.polygons,
  navMeshNextId: 1,

  setNavMeshPolygons: (polygons) => set({ navMeshPolygons: polygons }),

  allocateNavMeshId: () => {
    const id = get().navMeshNextId;
    set({ navMeshNextId: id + 1 });
    return id;
  },

  resetNavMeshStore: () =>
    set({ navMeshPolygons: INITIAL_NAVMESH.polygons, navMeshNextId: 1 }),
}));
