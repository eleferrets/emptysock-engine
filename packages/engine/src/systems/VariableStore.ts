const STORAGE_KEY = "emptysock_varstore";
const MAX_VARS = 1000;
const MAX_SWITCHES = 1000;

export interface VariableStoreData {
  variables: Record<number, number>;
  switches: Record<number, boolean>;
  variableNames: Record<number, string>;
  switchNames: Record<number, string>;
}

function readStorage(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable — silently fail
  }
}

function clampIndex(index: number, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(index)));
}

export class VariableStore {
  private _vars: Map<number, number> = new Map();
  private _switches: Map<number, boolean> = new Map();
  private _varNames: Map<number, string> = new Map();
  private _switchNames: Map<number, string> = new Map();

  getVar(index: number): number {
    return this._vars.get(clampIndex(index, MAX_VARS)) ?? 0;
  }

  /**
   * Store a variable value. Values are stored as integers — fractional parts
   * are truncated. This matches RPG Maker's variable behaviour and is intentional.
   * Use separate fields in your save data if you need float precision.
   */
  setVar(index: number, value: number): void {
    this._vars.set(clampIndex(index, MAX_VARS), Math.trunc(value));
  }

  getVarName(index: number): string {
    return this._varNames.get(clampIndex(index, MAX_VARS)) ?? "";
  }

  setVarName(index: number, name: string): void {
    this._varNames.set(clampIndex(index, MAX_VARS), name);
  }

  getSwitch(index: number): boolean {
    return this._switches.get(clampIndex(index, MAX_SWITCHES)) ?? false;
  }

  setSwitch(index: number, value: boolean): void {
    this._switches.set(clampIndex(index, MAX_SWITCHES), value);
  }

  getSwitchName(index: number): string {
    return this._switchNames.get(clampIndex(index, MAX_SWITCHES)) ?? "";
  }

  setSwitchName(index: number, name: string): void {
    this._switchNames.set(clampIndex(index, MAX_SWITCHES), name);
  }

  save(): void {
    writeStorage(JSON.stringify(this.snapshot()));
  }

  load(): void {
    const raw = readStorage();
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") {
        this.restore(parsed as Partial<VariableStoreData>);
      }
    } catch {
      // Corrupted data — silently ignore
    }
  }

  reset(): void {
    this._vars.clear();
    this._switches.clear();
    this._varNames.clear();
    this._switchNames.clear();
  }

  snapshot(): VariableStoreData {
    const variables: Record<number, number> = {};
    const switches: Record<number, boolean> = {};
    const variableNames: Record<number, string> = {};
    const switchNames: Record<number, string> = {};

    this._vars.forEach((v, k) => {
      variables[k] = v;
    });
    this._switches.forEach((v, k) => {
      switches[k] = v;
    });
    this._varNames.forEach((v, k) => {
      variableNames[k] = v;
    });
    this._switchNames.forEach((v, k) => {
      switchNames[k] = v;
    });

    return { variables, switches, variableNames, switchNames };
  }

  restore(data: Partial<VariableStoreData>): void {
    this._vars.clear();
    this._switches.clear();
    this._varNames.clear();
    this._switchNames.clear();

    for (const [k, v] of Object.entries(data.variables ?? {})) {
      if (typeof v === "number") this._vars.set(Number(k), Math.trunc(v));
    }
    for (const [k, v] of Object.entries(data.switches ?? {})) {
      if (typeof v === "boolean") this._switches.set(Number(k), v);
    }
    for (const [k, v] of Object.entries(data.variableNames ?? {})) {
      if (typeof v === "string") this._varNames.set(Number(k), v);
    }
    for (const [k, v] of Object.entries(data.switchNames ?? {})) {
      if (typeof v === "string") this._switchNames.set(Number(k), v);
    }
  }
}

export const variableStore = new VariableStore();

/**
 * A condition evaluated against a `VariableStore`, used to gate branches in
 * `VNSystem` (condition nodes, conditional choice options) and triggers in
 * `MapEventSystem` (the `when` field on a `MapEvent`).
 *
 * - `"switch"` compares a boolean switch to an expected value.
 * - `"variable"` compares an integer variable to a value with a comparison operator.
 */
export type VariableCondition =
  | { kind: "switch"; index: number; equals: boolean }
  | {
      kind: "variable";
      index: number;
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      value: number;
    };

/** Evaluate a `VariableCondition` against a `VariableStore`'s current values. */
export function evaluateCondition(
  store: VariableStore,
  condition: VariableCondition,
): boolean {
  if (condition.kind === "switch") {
    return store.getSwitch(condition.index) === condition.equals;
  }

  const value = store.getVar(condition.index);
  switch (condition.op) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "gt":
      return value > condition.value;
    case "gte":
      return value >= condition.value;
    case "lt":
      return value < condition.value;
    case "lte":
      return value <= condition.value;
  }
}
