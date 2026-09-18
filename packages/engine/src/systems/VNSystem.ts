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

  private readonly _eventHandlers: Array<(eventName: string, data: Record<string, unknown>) => void> = [];
  private readonly _choiceHandlers: Array<(options: Array<{ label: string; next: string }>) => void> = [];
  private readonly _nodeHandlers: Array<(node: DialogueNode) => void> = [];
  private readonly _endHandlers: Array<() => void> = [];
  private readonly _cgNodeHandlers: Array<(cgPath: string) => void> = [];

  onEvent(handler: (eventName: string, data: Record<string, unknown>) => void): () => void {
    this._eventHandlers.push(handler);
    return () => { const i = this._eventHandlers.indexOf(handler); if (i !== -1) this._eventHandlers.splice(i, 1); };
  }

  onChoice(handler: (options: Array<{ label: string; next: string }>) => void): () => void {
    this._choiceHandlers.push(handler);
    return () => { const i = this._choiceHandlers.indexOf(handler); if (i !== -1) this._choiceHandlers.splice(i, 1); };
  }

  onNode(handler: (node: DialogueNode) => void): () => void {
    this._nodeHandlers.push(handler);
    return () => { const i = this._nodeHandlers.indexOf(handler); if (i !== -1) this._nodeHandlers.splice(i, 1); };
  }

  onEnd(handler: () => void): () => void {
    this._endHandlers.push(handler);
    return () => { const i = this._endHandlers.indexOf(handler); if (i !== -1) this._endHandlers.splice(i, 1); };
  }

  onCGNode(handler: (cgPath: string) => void): () => void {
    this._cgNodeHandlers.push(handler);
    return () => { const i = this._cgNodeHandlers.indexOf(handler); if (i !== -1) this._cgNodeHandlers.splice(i, 1); };
  }

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
      for (const h of this._endHandlers) h();
      return;
    }
    this._currentNodeId = nodeId;
    const node = this._tree?.nodes[nodeId];
    if (node !== undefined) {
      for (const h of this._nodeHandlers) h(node);
      if (node.cgPath !== undefined) for (const h of this._cgNodeHandlers) h(node.cgPath);
    }
    this._processCurrentNode();
  }

  private _processCurrentNode(): void {
    const node = this.currentNode;
    if (node === null) return;

    if (node.type === 'jump') {
      this._goto(node.target);
    } else if (node.type === 'event') {
      for (const h of this._eventHandlers) h(node.eventName, node.data ?? {});
    } else if (node.type === 'choice') {
      for (const h of this._choiceHandlers) h(node.options);
    } else if (node.type === 'variable-set') {
      // onNode was already fired in _goto; advance is triggered by the caller
    }
  }
}
