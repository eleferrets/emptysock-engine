import { create } from "zustand";

/** Editor-declared game-wide globals: name -> TypeScript type expression. */
interface GameGlobalsState {
  gameGlobals: Record<string, string>;
  setGameGlobal: (name: string, type: string) => void;
  removeGameGlobal: (name: string) => void;
  /** Replaces every declared global (project load). */
  hydrateGameGlobals: (globals: Record<string, string>) => void;
  resetGameGlobalsStore: () => void;
}

export const useGameGlobalsStore = create<GameGlobalsState>((set) => ({
  gameGlobals: {},
  setGameGlobal: (name, type) =>
    set((s) => ({ gameGlobals: { ...s.gameGlobals, [name]: type } })),
  removeGameGlobal: (name) =>
    set((s) => {
      const next = { ...s.gameGlobals };
      delete next[name];
      return { gameGlobals: next };
    }),
  hydrateGameGlobals: (globals) => set({ gameGlobals: { ...globals } }),
  resetGameGlobalsStore: () => set({ gameGlobals: {} }),
}));
