# VisualScriptComponent

`VisualScriptComponent` is an ECS `Component` that holds a serialized node graph and interprets it each frame or on a fired event. It is the runtime counterpart to the **Visual Script Editor** panel: the panel authors a `VisualScriptGraph`, and this component walks it against a `VariableStore` and, optionally, an `ActorSystem`.

Import: `import { VisualScriptComponent, VisualScriptGraphBuilder, type VisualScriptGraph } from '@emptysock/engine';`

---

## Node types

| Kind | Role | Fields |
| --- | --- | --- |
| `onUpdate` | Entry point, fires every `update()` call | — |
| `onEvent` | Entry point, fires when `fireEvent(eventType)` is called | `eventType` |
| `sequence` | Passes execution straight through | — |
| `branch` | Reads a `VariableStore` variable and compares it | `variableIndex`, `comparator` (`eq`\|`neq`\|`gt`\|`lt`\|`gte`\|`lte`), `value`; `next[0]` = true edge, `next[1]` = false edge |
| `getVariable` | Reads a `VariableStore` variable into the per-tick evaluation scope | `variableIndex`, `outputKey` |
| `setVariable` | Writes a literal or a scoped value into `VariableStore` | `variableIndex`, `value: number \| { fromKey: string }` |
| `getSwitch` / `setSwitch` | Same as above for `VariableStore` boolean switches | `switchIndex`, `outputKey` / `value` |
| `sendMessage` | Sends a real `Message` through `ActorSystem.send()` | `targetActorId`, `messageType`, `payload?` |

Every node carries a `next: string[]` array of node ids it wires forward to (execution-output ports). `branch` is the only node with two ports; every other node kind uses `next[0]`.

---

## Authoring a graph in code

`VisualScriptGraphBuilder` produces the exact `VisualScriptGraph` shape the panel round-trips, so a developer can hand-write what a visual edit would otherwise produce:

```typescript
import { VisualScriptGraphBuilder, VisualScriptComponent } from '@emptysock/engine';

const b = new VisualScriptGraphBuilder();
const start = b.onUpdate();
const branch = b.branch(/* variableIndex */ 10, 'gt', 2);
const onHigh = b.setVariable(20, 1);
const onLow = b.setVariable(20, 0);

b.connect(start, branch)
 .connect(branch, onHigh, 0) // true edge
 .connect(branch, onLow, 1); // false edge

const vs = new VisualScriptComponent({ graph: b.build() });
entity.addComponent(vs);
```

---

## `new VisualScriptComponent(options): VisualScriptComponent`

`options.graph: VisualScriptGraph` (required), `options.variableStore?: VariableStore` (defaults to a private instance), `options.actorSystem?: ActorSystem` (required only if the graph contains `sendMessage` nodes).

`VisualScriptComponent.TYPE` is `"VisualScript"` — the string used as the `ComponentType` key by `addComponent`/`getComponent`, per the engine's component-identity convention.

---

## `vs.update(deltaTime: number): void`

Called by the entity's normal component update pass. Runs every `onUpdate` node's chain once. Not `async` — see the engine-wide `onUpdate must not be async` rule.

## `vs.fireEvent(eventType: string): void`

Runs every `onEvent` node whose `eventType` matches.

## `vs.setGraph(graph)` / `vs.graph` / `vs.setActorSystem(actorSystem)` / `vs.variableStore`

Swap the graph or wire an `ActorSystem` after construction; read the live `VariableStore` the interpreter is bound to.

---

## Execution semantics

- A trigger fires, execution walks `next` edges synchronously node-by-node until a node has no outgoing edge for the taken port.
- A per-tick evaluation scope (cleared at the start of each trigger) lets `getVariable`/`getSwitch` results flow into a later `setVariable` via `{ fromKey }`.
- A defensive step cap (10,000 steps per trigger) stops a graph that wires back into itself from hanging the frame — it logs a warning and returns rather than looping forever, mirroring the ActorSystem mailbox-drain guidance in `CLAUDE.md`.
