import { create } from "zustand";

// ── State / actions ──────────────────────────────────────────────────────────

export interface VariableStoreSnapshot {
  variableStoreVars: Record<number, number>;
  variableStoreSwitches: Record<number, boolean>;
  variableStoreVarNames: Record<number, string>;
  variableStoreSwitchNames: Record<number, string>;
}

interface VariableStoreState extends VariableStoreSnapshot {
  setVar: (index: number, value: number) => void;
  setSwitch: (index: number, value: boolean) => void;
  setVarName: (index: number, name: string) => void;
  setSwitchName: (index: number, name: string) => void;
  hydrateVariableStore: (snapshot: VariableStoreSnapshot) => void;
  resetVariableStore: () => void;
}

const INITIAL_VARIABLE_STATE = {
  variableStoreVars: {} as Record<number, number>,
  variableStoreSwitches: {} as Record<number, boolean>,
  variableStoreVarNames: {} as Record<number, string>,
  variableStoreSwitchNames: {} as Record<number, string>,
};

export const useVariableStore = create<VariableStoreState>((set) => ({
  ...INITIAL_VARIABLE_STATE,

  setVar: (index, value) =>
    set((s) => ({
      variableStoreVars: { ...s.variableStoreVars, [index]: Math.floor(value) },
    })),
  setSwitch: (index, value) =>
    set((s) => ({
      variableStoreSwitches: { ...s.variableStoreSwitches, [index]: value },
    })),
  setVarName: (index, name) =>
    set((s) => ({
      variableStoreVarNames: { ...s.variableStoreVarNames, [index]: name },
    })),
  setSwitchName: (index, name) =>
    set((s) => ({
      variableStoreSwitchNames: {
        ...s.variableStoreSwitchNames,
        [index]: name,
      },
    })),

  hydrateVariableStore: (snapshot) => set({ ...snapshot }),

  resetVariableStore: () => set({ ...INITIAL_VARIABLE_STATE }),
}));
