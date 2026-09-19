import {
  type VariableStore,
  variableStore,
  evaluateCondition,
  type VariableCondition,
} from "./VariableStore.js";

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
      options: Array<{ label: string; next: string; when?: VariableCondition }>;
      cgPath?: string;
    }
  | {
      type: "event";
      eventName: string;
      data?: Record<string, unknown>;
      next?: string;
      cgPath?: string;
    }
  | { type: "jump"; target: string; cgPath?: string }
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

export class VNSystem {
  private _tree: DialogueTree | null = null;
  private _currentNodeId: string | null = null;
  private _listener: IVNListener | null = null;

  /** Runtime variable store — populated automatically by variable-set nodes. */
  public readonly variables: Map<string, unknown> = new Map();

  /**
   * The persistent `VariableStore` backing `"condition"` nodes and
   * conditional (`when`) choice options. Defaults to the shared
   * `variableStore` singleton; pass a different instance for isolated
   * testing or a per-save-slot store.
   */
  private readonly _store: VariableStore;

  constructor(store: VariableStore = variableStore) {
    this._store = store;
  }

  setListener(listener: IVNListener): void {
    this._listener = listener;
  }

  removeListener(): void {
    this._listener = null;
  }

  load(tree: DialogueTree): void {
    this._tree = tree;
    this._currentNodeId = tree.startNode;
    // Fire onNode for the first node when it is dialogue — _processCurrentNode
    // handles jump/event/choice automatically but intentionally skips dialogue
    // (display is the caller's responsibility), so we fire it here to match the
    // behaviour of _goto() for all subsequent nodes.
    const first = this.currentNode;
    if (first !== null) {
      if (first.cgPath !== undefined) this._listener?.onCGNode?.(first.cgPath);
      if (first.type === "dialogue") this._listener?.onNode?.(first);
    }
    this._processCurrentNode();
  }

  get currentNode(): DialogueNode | null {
    if (this._tree === null || this._currentNodeId === null) return null;
    return this._tree.nodes[this._currentNodeId] ?? null;
  }

  advance(): void {
    const node = this.currentNode;
    if (node === null) return;

    if (node.type === "dialogue") {
      this._goto(node.next ?? null);
    } else if (node.type === "event") {
      this._goto(node.next ?? null);
    } else if (node.type === "variable-set") {
      this._goto(node.next ?? null);
    }
    // choice and jump are handled internally / by external call
  }

  selectOption(next: string): void {
    this._goto(next);
  }

  /** Read a runtime variable set by variable-set nodes. Returns undefined if not set. */
  getVariable(key: string): unknown {
    return this.variables.get(key);
  }

  private _goto(nodeId: string | null): void {
    if (nodeId === null) {
      this._currentNodeId = null;
      this._listener?.onEnd?.();
      return;
    }
    this._currentNodeId = nodeId;
    const node = this._tree?.nodes[nodeId];
    if (node !== undefined) {
      this._listener?.onNode?.(node);
      if (node.cgPath !== undefined) this._listener?.onCGNode?.(node.cgPath);
    }
    this._processCurrentNode();
  }

  private _processCurrentNode(): void {
    const node = this.currentNode;
    if (node === null) return;

    if (node.type === "jump") {
      this._goto(node.target);
    } else if (node.type === "event") {
      this._listener?.onEvent?.(node.eventName, node.data ?? {});
    } else if (node.type === "choice") {
      // Conditional options (`when`) are evaluated against the VariableStore
      // and filtered out before the listener ever sees them — the developer
      // never has to re-check the condition when handling the click.
      const visible = node.options.filter(
        (opt) =>
          opt.when === undefined || evaluateCondition(this._store, opt.when),
      );
      this._listener?.onChoice?.(visible);
    } else if (node.type === "variable-set") {
      // Store the variable and auto-advance — game code reads variables via
      // getVariable() rather than intercepting the node directly.
      this.variables.set(node.variableKey, node.variableValue);
      this._goto(node.next ?? null);
    } else if (node.type === "condition") {
      // Gate the next node on the VariableStore's current values — no
      // listener callback, this resolves and advances synchronously like jump.
      const target = evaluateCondition(this._store, node.condition)
        ? node.ifTrue
        : (node.ifFalse ?? null);
      this._goto(target);
    }
  }
}
