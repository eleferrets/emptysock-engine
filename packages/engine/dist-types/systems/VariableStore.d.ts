export interface VariableStoreData {
  variables: Record<number, number>;
  switches: Record<number, boolean>;
  variableNames: Record<number, string>;
  switchNames: Record<number, string>;
}
export declare class VariableStore {
  private _vars;
  private _switches;
  private _varNames;
  private _switchNames;
  getVar(index: number): number;
  /**
   * Store a variable value. Values are stored as integers — fractional parts
   * are truncated. This matches RPG Maker's variable behaviour and is intentional.
   * Use separate fields in your save data if you need float precision.
   */
  setVar(index: number, value: number): void;
  getVarName(index: number): string;
  setVarName(index: number, name: string): void;
  getSwitch(index: number): boolean;
  setSwitch(index: number, value: boolean): void;
  getSwitchName(index: number): string;
  setSwitchName(index: number, name: string): void;
  save(): void;
  load(): void;
  reset(): void;
  snapshot(): VariableStoreData;
  restore(data: Partial<VariableStoreData>): void;
}
export declare const variableStore: VariableStore;
