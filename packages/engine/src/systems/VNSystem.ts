export type DialogueNode =
  | { type: 'dialogue'; speaker: string; text: string; voice?: string; next?: string; cgPath?: string }
  | { type: 'choice'; text: string; options: Array<{ label: string; next: string }>; cgPath?: string }
  | { type: 'event'; eventName: string; data?: Record<string, unknown>; next?: string; cgPath?: string }
  | { type: 'jump'; target: string; cgPath?: string }
  | { type: 'variable-set'; variableKey: string; variableValue: unknown; next?: string; cgPath?: string };

export interface DialogueTree {
  readonly nodes: Record<string, DialogueNode>;
  readonly startNode: string;
}

export class VNSystem {
  private _tree: DialogueTree | null = null;
  private _currentNodeId: string | null = null;

  public onEvent: ((eventName: string, data: Record<string, unknown>) => void) | null = null;
  public onChoice: ((options: Array<{ label: string; next: string }>) => void) | null = null;
  public onNode: ((node: DialogueNode) => void) | null = null;
  public onEnd: (() => void) | null = null;
  public onCGNode: ((cgPath: string) => void) | null = null;

  load(tree: DialogueTree): void {
    this._tree = tree;
    this._currentNodeId = tree.startNode;
    this._processCurrentNode();
  }

  get currentNode(): DialogueNode | null {
    if (this._tree === null || this._currentNodeId === null) return null;
    return this._tree.nodes[this._currentNodeId] ?? null;
  }

  advance(): void {
    const node = this.currentNode;
    if (node === null) return;

    if (node.type === 'dialogue') {
      this._goto(node.next ?? null);
    } else if (node.type === 'event') {
      this._goto(node.next ?? null);
    } else if (node.type === 'variable-set') {
      // auto-advance after variable-set; caller handles the variable via onNode
      this._goto(node.next ?? null);
    }
    // choice and jump are handled internally / by external call
  }

  selectOption(next: string): void {
    this._goto(next);
  }

  private _goto(nodeId: string | null): void {
    if (nodeId === null) {
      this._currentNodeId = null;
      if (this.onEnd) this.onEnd();
      return;
    }
    this._currentNodeId = nodeId;
    const node = this._tree?.nodes[nodeId];
    if (node !== undefined && this.onNode) this.onNode(node);
    if (node !== undefined && node.cgPath !== undefined && this.onCGNode) {
      this.onCGNode(node.cgPath);
    }
    this._processCurrentNode();
  }

  private _processCurrentNode(): void {
    const node = this.currentNode;
    if (node === null) return;

    if (node.type === 'jump') {
      this._goto(node.target);
    } else if (node.type === 'event') {
      this.onEvent?.(node.eventName, node.data ?? {});
    } else if (node.type === 'choice') {
      this.onChoice?.(node.options);
    } else if (node.type === 'variable-set') {
      // onNode was already fired in _goto; advance is triggered by the caller
    }
  }
}
