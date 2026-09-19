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
    };
export interface DialogueTree {
  readonly nodes: Record<string, DialogueNode>;
  readonly startNode: string;
}
export declare class VNSystem {
  private _tree;
  private _currentNodeId;
  private readonly _eventHandlers;
  private readonly _choiceHandlers;
  private readonly _nodeHandlers;
  private readonly _endHandlers;
  private readonly _cgNodeHandlers;
  onEvent(
    handler: (eventName: string, data: Record<string, unknown>) => void,
  ): () => void;
  onChoice(
    handler: (
      options: Array<{
        label: string;
        next: string;
      }>,
    ) => void,
  ): () => void;
  onNode(handler: (node: DialogueNode) => void): () => void;
  onEnd(handler: () => void): () => void;
  onCGNode(handler: (cgPath: string) => void): () => void;
  load(tree: DialogueTree): void;
  get currentNode(): DialogueNode | null;
  advance(): void;
  selectOption(next: string): void;
  private _goto;
  private _processCurrentNode;
  /**
   * Clear all event subscriptions. Call in `onDestroy()` if you subscribed
   * and did not store the unsubscriber functions.
   */
  destroy(): void;
}
