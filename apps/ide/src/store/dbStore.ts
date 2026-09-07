import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbEntry {
  id: string;
  name?: string;
  [key: string]: unknown;
}

// ── State / actions ──────────────────────────────────────────────────────────

interface DBStoreState {
  dbActors: DbEntry[];
  dbClasses: DbEntry[];
  dbItems: DbEntry[];
  dbEnemies: DbEntry[];
  setDBActors: (v: DbEntry[]) => void;
  setDBClasses: (v: DbEntry[]) => void;
  setDBItems: (v: DbEntry[]) => void;
  setDBEnemies: (v: DbEntry[]) => void;
  resetDBStore: () => void;
}

const INITIAL_DB_STATE = {
  dbActors: [] as DbEntry[],
  dbClasses: [] as DbEntry[],
  dbItems: [] as DbEntry[],
  dbEnemies: [] as DbEntry[],
};

export const useDBStore = create<DBStoreState>((set) => ({
  ...INITIAL_DB_STATE,

  setDBActors: (v) => set({ dbActors: v }),
  setDBClasses: (v) => set({ dbClasses: v }),
  setDBItems: (v) => set({ dbItems: v }),
  setDBEnemies: (v) => set({ dbEnemies: v }),

  resetDBStore: () => set({ ...INITIAL_DB_STATE }),
}));
