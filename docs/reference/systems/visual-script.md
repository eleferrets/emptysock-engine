# Visual Script

The visual script runtime is made of four pieces, all exported from `@emptysock/engine`:

- `VisualScriptGraph` — the plain-data node graph the **Logic Script** panel authors (and that you can hand-write with `VisualScriptGraphBuilder`).
- `registerVisualScriptGraph` / `getVisualScriptGraph` / `unregisterVisualScriptGraph` — a shared, module-level registry of graphs keyed by `graphId`.
- `VisualScriptState` — the small per-entity component (`{ graphId: string }`) that says which registered graph an entity runs.
- `VisualScriptSystem` — the driver that compiles each distinct graph once (to JavaScript source) and runs it for every entity carrying `VisualScriptState`.

There is no `VisualScriptComponent` class; graph data is shared and immutable, and only `graphId` lives on the entity.

Import: `import { VisualScriptState, VisualScriptSystem, VisualScriptGraphBuilder, registerVisualScriptGraph, type VisualScriptGraph } from '@emptysock/engine';`

---

## Node types

| Kind                      | Role                                                               | Fields                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `onUpdate`                | Entry point, runs every `VisualScriptSystem.update()` call         | —                                                                                                                             |
| `onEvent`                 | Entry point, runs when `fireEvent(scene, eventType)` is called     | `eventType`                                                                                                                   |
| `sequence`                | Passes execution straight through                                  | —                                                                                                                             |
| `branch`                  | Reads a `VariableStore` variable and compares it                   | `variableIndex`, `comparator` (`eq`\|`neq`\|`gt`\|`lt`\|`gte`\|`lte`), `value`; `next[0]` = true edge, `next[1]` = false edge |
| `getVariable`             | Reads a `VariableStore` variable into the per-run evaluation scope | `variableIndex`, `outputKey`                                                                                                  |
| `setVariable`             | Writes a literal or a scoped value into `VariableStore`            | `variableIndex`, `value: number \| { fromKey: string }`                                                                       |
| `getSwitch` / `setSwitch` | Same as above for `VariableStore` boolean switches                 | `switchIndex`, `outputKey` / `value`                                                                                          |
| `sendMessage`             | Sends a message through `ActorSystem.send()`                       | `targetActorId`, `messageType`, `payload?`                                                                                    |

Every node carries a `next: string[]` array of node ids it wires forward to (execution-output ports). `branch` is the only node with two ports; every other node kind uses `next[0]`. A graph is `{ nodes: VSNode[], connections: VSConnection[] }`.

---

## Authoring a graph in code

`VisualScriptGraphBuilder` produces the exact `VisualScriptGraph` shape the panel round-trips, so a developer can hand-write what a visual edit would otherwise produce:

```typescript
import {
  VisualScriptGraphBuilder,
  VisualScriptState,
  VisualScriptSystem,
  registerVisualScriptGraph,
} from "@emptysock/engine";

const b = new VisualScriptGraphBuilder();
const start = b.onUpdate();
const branch = b.branch(/* variableIndex */ 10, "gt", 2);
const onHigh = b.setVariable(20, 1);
const onLow = b.setVariable(20, 0);

b.connect(start, branch)
  .connect(branch, onHigh, 0) // true edge
  .connect(branch, onLow, 1); // false edge

registerVisualScriptGraph("door-logic", b.build());

// In a scene's onLoad (ctx.variables / ctx.actors share state with the game):
const vs = new VisualScriptSystem({
  variables: ctx.variables,
  actorSystem: ctx.actors,
});
scene.spawn("Door").add(VisualScriptState, { graphId: "door-logic" });

// Each frame, from onUpdate:
vs.update(scene);
// When something happens:
vs.fireEvent(scene, "interact");
```

---

## Registry

`registerVisualScriptGraph(graphId, graph)` registers or replaces a graph. `getVisualScriptGraph(graphId)` returns it (or `undefined`), and `unregisterVisualScriptGraph(graphId)` removes it. Re-registering a `graphId` does not recompile automatically: call `vs.invalidate(graphId)` on each `VisualScriptSystem` that already ran it.

## `new VisualScriptSystem(options?)`

`options.variables?: VariableStore` (defaults to a private instance), `options.actorSystem?: ActorSystem` (only needed if a graph contains `sendMessage` nodes; without one those nodes do nothing useful).

## `vs.update(scene: Scene): void`

Runs every `onUpdate` chain of every entity with `VisualScriptState`. The system is not driven by `Game` automatically; call it from your scene's `onUpdate`. Not `async` — see the engine-wide `onUpdate must not be async` rule.

## `vs.fireEvent(scene: Scene, eventType: string): void`

Runs every `onEvent` chain whose `eventType` matches, on every entity with `VisualScriptState`.

## `vs.invalidate(graphId)` / `vs.variables`

Drop a cached compiled module after re-registering a graph; read the `VariableStore` the system is bound to.

## `compileVisualScriptGraph(graph): string`

Pure function that returns the generated module source (`run(ctx)` and `fireEvent(eventType, ctx)`). `VisualScriptSystem` uses it internally; it is exported for inspection and tooling.

---

## Execution semantics

- Each graph is compiled once per `graphId` into JavaScript (a `switch` over node ids with the node's fields baked in) and cached for the lifetime of the system; entities sharing a `graphId` share one compiled module.
- A trigger fires and execution walks `next` edges synchronously node-by-node until a node has no outgoing edge for the taken port.
- A per-entity evaluation scope (cleared at the start of each trigger) lets `getVariable`/`getSwitch` results flow into a later `setVariable` via `{ fromKey }`. The scope is stored in a side table keyed by world and entity, and cleared when the entity is destroyed.
- A defensive step cap (10,000 steps per trigger) stops a graph that wires back into itself from hanging the frame — it logs a warning and returns.
