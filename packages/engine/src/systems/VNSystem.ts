export type DialogueNode =
  | { type: 'dialogue'; speaker: string; text: string; voice?: string; next?: string }
  | { type: 'choice'; text: string; options: Array<{ label: string; next: string }> }
  | { type: 'event'; eventName: string; data?: Record<string, unknown>; next?: string }
  | { type: 'jump'; target: string };

export interface DialogueTree {
  readonly nodes: Record<string, DialogueNode>;
  readonly startNode: string;
}

export class VNSystem {
  private _tree: DialogueTree | null = null;
  private _currentNodeId: string | null = null;

  public onEvent: ((eventName: string, data: Record<string, unknown>) => void) | null = null;
  public onChoice: ((options: Array<{ label: string; next: string }>) => void) | null = null;

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
    }
    // choice and jump are handled internally / by external call
  }

  selectOption(next: string): void {
    this._goto(next);
  }

  private _goto(nodeId: string | null): void {
    if (nodeId === null) {
      this._currentNodeId = null;
      return;
    }
    this._currentNodeId = nodeId;
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
    }
  }
}
