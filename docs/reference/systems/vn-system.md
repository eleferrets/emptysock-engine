# VNSystem

`VNSystem` plays back branching dialogue trees exported from the **Story Graph** panel. It is event-driven: implement `IVNListener`, register it with `setListener()`, then call `load()` to start playback.

For a task-oriented introduction, see the [Visual Novel tutorial](../../tutorials/visual-novel.md).

Import: `import { VNSystem, storyGraphToDialogueTree, type IVNListener, type DialogueNode, type StoryGraph, type VariableCondition } from '@emptysock/engine';`

---

## `new VNSystem(store?: VariableStore)`

Defaults to the shared `variableStore` singleton (see [VariableStore](./variable-store.md)). Pass your own `VariableStore` instance for isolated testing or a per-save-slot store. This is the store `"condition"` nodes and conditional (`when`) choice options read from.

---

## Setup

Export a `.storyGraph.json` from the Story Graph panel, then convert it before loading:

```typescript
const response = await fetch("assets/story/chapter1.storyGraph.json");
const graph = (await response.json()) as StoryGraph;
const tree = storyGraphToDialogueTree(graph);

const vn = new VNSystem();
// Register a listener BEFORE calling load():
vn.setListener({
  onNode(node) {
    /* ... */
  },
  onEnd() {
    /* ... */
  },
});
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
vn.setListener({
  onChoice(options) {
    options.forEach((opt) => {
      const btn = createButton(opt.label);
      btn.onClick(() => vn.selectOption(opt.next));
    });
  },
});
```

---

## `vn.currentNode: DialogueNode | null`

The node currently being displayed, or `null` if the tree has ended or not started.

---

## `vn.variables: Map<string, unknown>`

Read-only map of all variables set by `'variable-set'` nodes during playback.

---

## `vn.getVariable(key: string): unknown`

Retrieve the current value of a named variable, or `undefined` if not yet set.

---

## `vn.setListener(listener: IVNListener): void`

Register the active listener. Replaces any previously registered listener. Call before `load()` so the first `onNode` is delivered.

---

## `vn.removeListener(): void`

Detach the current listener. Subsequent node events are discarded until a new listener is set.

---

## `IVNListener` interface

All fields are optional — implement only the callbacks you need.

| Callback   | Signature                                              | When called                                                 |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `onNode`   | `(node: DialogueNode) => void`                         | Every node except auto-resolved `'jump'` nodes              |
| `onChoice` | `(options: { label: string; next: string }[]) => void` | When a `'choice'` node is reached (in addition to `onNode`) |
| `onEnd`    | `() => void`                                           | When the tree has no more nodes                             |
| `onEvent`  | `(eventName: string, ...args: unknown[]) => void`      | When an `'event'` node fires its payload                    |
| `onCGNode` | `(cgPath: string) => void`                             | When a node carries a CG image path                         |

---

## `DialogueNode` — discriminated union

Narrow on `node.type`:

| `node.type`      | Key fields                                                                             | Notes                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `'dialogue'`     | `speaker: string`, `text: string`, `next?: string`                                     | Call `vn.advance()` to continue                                                                                          |
| `'choice'`       | `text: string`, `options: { label: string; next: string; when?: VariableCondition }[]` | Call `vn.selectOption(opt.next)`; `when`-gated options are filtered out before `onChoice` fires                          |
| `'event'`        | `eventName: string`, `data?: Record<string, unknown>`                                  | Engine auto-advances; handle side effects in `onEvent`                                                                   |
| `'variable-set'` | `variableKey: string`, `variableValue: unknown`                                        | Engine auto-advances; read result via `getVariable()`                                                                    |
| `'jump'`         | (resolved automatically)                                                               | `onNode` never fires for jump nodes                                                                                      |
| `'condition'`    | `condition: VariableCondition`, `ifTrue: string`, `ifFalse?: string`                   | Engine auto-advances to `ifTrue` or `ifFalse` (or ends if omitted and false) — see **Variable-gated conditionals** below |

---

## Variable-gated conditionals

`VNSystem` reads persistent state from a [`VariableStore`](./variable-store.md) to gate branches in two ways:

1. **`"condition"` nodes** route to one of two targets depending on a `VariableCondition`:

   ```typescript
   const tree: DialogueTree = {
     startNode: "gate",
     nodes: {
       gate: {
         type: "condition",
         condition: { kind: "switch", index: 10, equals: true }, // "bossDefeated"
         ifTrue: "kingThanksYou",
         ifFalse: "kingWarnsYou",
       },
       kingThanksYou: {
         type: "dialogue",
         speaker: "King",
         text: "You saved the realm.",
       },
       kingWarnsYou: {
         type: "dialogue",
         speaker: "King",
         text: "The dragon still lives.",
       },
     },
   };

   const vn = new VNSystem(); // reads the shared variableStore
   vn.setListener({
     onNode(node) {
       /* ... */
     },
   });
   vn.load(tree); // resolves the condition node immediately, no listener callback for it
   ```

   `ifFalse` is optional — if omitted and the condition is false, the tree ends (`onEnd` fires) exactly as if `next` were `undefined` on a dialogue node.

2. **Choice options** can carry a `when: VariableCondition`. Options whose condition is not met are removed from the array passed to `onChoice` — the game code that renders buttons never has to re-check the condition itself:

   ```typescript
   const node: DialogueNode = {
     type: "choice",
     text: "The door is locked.",
     options: [
       {
         label: "Unlock it",
         next: "open",
         when: { kind: "switch", index: 2, equals: true },
       }, // "hasKey"
       { label: "Walk away", next: "leave" },
     ],
   };
   // If switch 2 ("hasKey") is false, onChoice receives only [{ label: "Walk away", next: "leave" }].
   ```

Set the variables driving these conditions from map events (`MapEventSystem`'s `set-variable` / `set-switch` commands apply directly to the shared store) or from your own game logic via `variableStore.setVar` / `setSwitch`.

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
  type IVNListener,
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

    const listener: IVNListener = {
      onNode(node: DialogueNode) {
        if (node.type === "dialogue") {
          dialogueBox.show(node.speaker, node.text);
        }
      },
      onEvent(eventName, data) {
        handleEvent(eventName, data);
        // engine auto-advances — no call needed
      },
      onChoice(options) {
        choicePanel.show(options, (chosen) => {
          this._vn.selectOption(chosen.next);
          choicePanel.hide();
        });
      },
      onEnd() {
        dialogueBox.hide();
      },
    };

    this._vn.setListener(listener);
    this._vn.load(tree);
  }
}
```

---

## Notes

- `VNSystem` has no `destroy()` — release the reference and it is garbage-collected.
- `VNSystem` has no internal save state. Store `vn.currentNode?.id` and re-walk the graph on resume.
- Register a listener with `setListener()` **before** calling `load()` or the first node fires without a listener.
- `"condition"` nodes and conditional (`when`) choice options can be authored visually in the Story Graph panel — click **+ Condition** to add a gate node (double-click to pick switch/variable and comparison), or check "Only show when…" on a choice option in its edit modal. The panel's Import/Export .vnscript round-trips this data losslessly, including branch targets and per-option conditions.
