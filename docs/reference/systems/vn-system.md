# VNSystem

`VNSystem` plays back branching dialogue trees exported from the **Story Graph** panel. It is event-driven: register callbacks, then call `load()` to start playback.

For a task-oriented introduction, see the [Visual Novel tutorial](../../tutorials/visual-novel.md).

Import: `import { VNSystem, storyGraphToDialogueTree, type DialogueNode, type StoryGraph } from '@emptysock/engine';`

---

## Setup

Export a `.storyGraph.json` from the Story Graph panel, then convert it before loading:

```typescript
const response = await fetch("assets/story/chapter1.storyGraph.json");
const graph = (await response.json()) as StoryGraph;
const tree = storyGraphToDialogueTree(graph);

const vn = new VNSystem();
// Register callbacks BEFORE calling load():
vn.onNode = (node) => {
  /* ... */
};
vn.onEnd = () => {
  /* ... */
};
vn.load(tree); // synchronous; onNode fires immediately for the first node
```

---

## `vn.load(tree: DialogueTree): void`

Load a dialogue tree and immediately fire `onNode` for the first node. Synchronous.

---

## `vn.advance(): void`

Move a `dialogue` node to its successor. No-op on `choice` nodes (use `selectOption` instead).

---

## `vn.selectOption(nextNodeId: string): void`

Resolve a choice by advancing to the node with the given ID. The `nextNodeId` comes from `option.next` in the options array.

```typescript
vn.onChoice = (options) => {
  options.forEach((opt) => {
    const btn = createButton(opt.label);
    btn.onClick(() => vn.selectOption(opt.next));
  });
};
```

---

## `vn.currentNode: DialogueNode | null`

The node currently being displayed, or `null` if the tree has ended or not started.

---

## Callbacks

Register all callbacks before calling `load()`. The first `onNode` fires during `load()`.

| Callback   | Signature                                              | When called                                                 |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `onNode`   | `(node: DialogueNode) => void`                         | Every node except auto-resolved `'jump'` nodes              |
| `onChoice` | `(options: { label: string; next: string }[]) => void` | When a `'choice'` node is reached (in addition to `onNode`) |
| `onEnd`    | `() => void`                                           | When the tree has no more nodes                             |

---

## `DialogueNode` — discriminated union

Narrow on `node.type`:

| `node.type`      | Key fields                                                   | Notes                                                 |
| ---------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `'dialogue'`     | `speaker: string`, `text: string`, `next?: string`           | Call `vn.advance()` to continue                       |
| `'choice'`       | `text: string`, `options: { label: string; next: string }[]` | Call `vn.selectOption(opt.next)`                      |
| `'event'`        | `eventName: string`, `data?: Record<string, unknown>`        | Engine auto-advances; handle side effects in `onNode` |
| `'variable-set'` | `variableKey: string`, `variableValue: unknown`              | Engine auto-advances after `onNode` fires             |
| `'jump'`         | (resolved automatically)                                     | `onNode` never fires for jump nodes                   |

---

## `storyGraphToDialogueTree` / `dialogueTreeToStoryGraph`

```typescript
import {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "@emptysock/engine";

// Convert from IDE export to runtime format:
const tree = storyGraphToDialogueTree(storyGraphJson);
vn.load(tree);

// Round-trip back to IDE format (for programmatic script editing):
const graph = dialogueTreeToStoryGraph(tree);
```

---

## Full example

```typescript
import {
  VNSystem,
  storyGraphToDialogueTree,
  type DialogueNode,
  type StoryGraph,
} from "@emptysock/engine";

export class NarrativeScene extends Scene {
  private _vn!: VNSystem;

  override async onLoad(): Promise<void> {
    const response = await fetch("assets/story/chapter1.storyGraph.json");
    const graph = (await response.json()) as StoryGraph;
    const tree = storyGraphToDialogueTree(graph);

    this._vn = new VNSystem();

    this._vn.onNode = (node: DialogueNode) => {
      if (node.type === "dialogue") {
        dialogueBox.show(node.speaker, node.text);
      } else if (node.type === "event") {
        handleEvent(node.eventName, node.data);
        // engine auto-advances — no call needed
      }
    };

    this._vn.onChoice = (options) => {
      choicePanel.show(options, (chosen) => {
        this._vn.selectOption(chosen.next);
        choicePanel.hide();
      });
    };

    this._vn.onEnd = () => {
      dialogueBox.hide();
    };

    this._vn.load(tree);
  }
}
```

---

## Notes

- `VNSystem` has no `destroy()` — release the reference and it is garbage-collected.
- `VNSystem` has no internal save state. Store `vn.currentNode?.id` and re-walk the graph on resume.
- Register `onNode`, `onChoice`, and `onEnd` **before** calling `load()` or the first node fires without a listener.
