import { type VariableStore, type VariableCondition } from "./VariableStore.js";
export type { VariableCondition } from "./VariableStore.js";
export type DialogueNode =
  | {
      type: "dialogue";
      speaker: string;
      text: string;
      voice?: string;
      next?: string;
      cgPath?: string;
    }
  | {
      type: "choice";
      text: string;
      options: Array<{
        label: string;
        next: string;
        when?: VariableCondition;
      }>;
      cgPath?: string;
    }
  | {
      type: "event";
      eventName: string;
      data?: Record<string, unknown>;
      next?: string;
      cgPath?: string;
    }
  | {
      type: "jump";
      target: string;
      cgPath?: string;
    }
  | {
      type: "variable-set";
      variableKey: string;
      variableValue: unknown;
      next?: string;
      cgPath?: string;
    }
  | {
      type: "condition";
      condition: VariableCondition;
      ifTrue: string;
      ifFalse?: string;
      cgPath?: string;
    };
export interface ChoiceOption {
  label: string;
  next: string;
  when?: VariableCondition;
}
export interface DialogueTree {
  readonly nodes: Record<string, DialogueNode>;
  readonly startNode: string;
}
export interface IVNListener {
  onEvent?: (eventName: string, ...args: unknown[]) => void;
  onChoice?: (options: ChoiceOption[]) => void;
  onNode?: (node: DialogueNode) => void;
  onEnd?: () => void;
  onCGNode?: (cgPath: string) => void;
}
export declare class VNSystem {
  private _tree;
  private _currentNodeId;
  private _listener;
  /** Runtime variable store — populated automatically by variable-set nodes. */
  readonly variables: Map<string, unknown>;
  /**
   * The persistent `VariableStore` backing `"condition"` nodes and
   * conditional (`when`) choice options. Defaults to the shared
   * `variableStore` singleton; pass a different instance for isolated
   * testing or a per-save-slot store.
   */
  private readonly _store;
  constructor(store?: VariableStore);
  setListener(listener: IVNListener): void;
  removeListener(): void;
  load(tree: DialogueTree): void;
  get currentNode(): DialogueNode | null;
  advance(): void;
  selectOption(next: string): void;
  /** Read a runtime variable set by variable-set nodes. Returns undefined if not set. */
  getVariable(key: string): unknown;
  private _goto;
  private _processCurrentNode;
}
