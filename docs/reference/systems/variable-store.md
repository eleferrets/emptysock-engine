# VariableStore

`VariableStore` holds indexed integer variables (1–1000) and boolean switches (1–1000), persisted automatically to `localStorage` under a fixed key. It is the persistent-state backbone behind conditional dialogue in `VNSystem` and conditional map events in `MapEventSystem` — this page also documents that shared `VariableCondition` seam.

Import: `import { VariableStore, variableStore, evaluateCondition, type VariableCondition } from '@emptysock/engine';`

---

## The `variableStore` singleton

`variableStore` is a module-level instance, exported alongside the `VariableStore` class. `VNSystem` and `MapEventSystem` both default to it when constructed with no arguments, so a game with one save file needs no wiring at all — just call `variableStore.load()` once at startup and `variableStore.save()` whenever you persist.

Pass your own `VariableStore` instance to `VNSystem` / `MapEventSystem` instead when you need isolation — per-save-slot state, or a clean store in a test.

---

## `getVar(index: number): number` / `setVar(index: number, value: number): void`

Integer variables. Values are truncated to integers on write (matches RPG Maker's variable behaviour). Reading an unset index returns `0`.

## `getSwitch(index: number): boolean` / `setSwitch(index: number, value: boolean): void`

Boolean switches. Reading an unset index returns `false`.

## `getVarName` / `setVarName` / `getSwitchName` / `setSwitchName`

Human-readable labels for the IDE's Variables panel — purely cosmetic, not read by `evaluateCondition`.

## `save(): void` / `load(): void`

Persist to / restore from `localStorage`. `load()` silently no-ops if nothing was saved yet or the stored JSON is corrupted.

## `snapshot(): VariableStoreData` / `restore(data: Partial<VariableStoreData>): void`

Serialize/deserialize the whole store as a plain object, for embedding inside your own `SaveSystem` slot (see [SaveSystem](./save-system.md)).

## `reset(): void`

Clears all variables, switches, and their names. Use when starting a New Game so a previous playthrough's state doesn't leak in.

---

## `VariableCondition` — the conditional-logic seam

```typescript
type VariableCondition =
  | { kind: "switch"; index: number; equals: boolean }
  | {
      kind: "variable";
      index: number;
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      value: number;
    };
```

## `evaluateCondition(store: VariableStore, condition: VariableCondition): boolean`

Evaluates a `VariableCondition` against a store's current values. `VNSystem`'s `"condition"` nodes, `VNSystem` choice options' `when` field, and `MapEventSystem`'s per-event `when` field all call this internally — you only need it directly if you are building your own conditional gate outside those two systems.

```typescript
import { variableStore, evaluateCondition } from "@emptysock/engine";

variableStore.setSwitch(1, true);
evaluateCondition(variableStore, { kind: "switch", index: 1, equals: true }); // true

variableStore.setVar(4, 12);
evaluateCondition(variableStore, {
  kind: "variable",
  index: 4,
  op: "gte",
  value: 10,
}); // true
```

---

## Full example — driving conditional dialogue and a gated map event

This is the "batteries included" path: one shared `variableStore`, a Story Graph node that branches on it, and a map event that only appears once a switch flips.

```typescript
import {
  variableStore,
  VNSystem,
  MapEventSystem,
  type DialogueTree,
} from "@emptysock/engine";

// 1. A switch that starts false.
variableStore.setSwitchName(10, "bossDefeated");

// 2. A dialogue tree with a condition node gated on it.
const tree: DialogueTree = {
  startNode: "throneRoomCheck",
  nodes: {
    throneRoomCheck: {
      type: "condition",
      condition: { kind: "switch", index: 10, equals: true },
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
      text: "The dragon still lives — hurry.",
    },
  },
};

const vn = new VNSystem(); // uses the shared variableStore by default
vn.setListener({
  onNode(node) {
    if (node.type === "dialogue") dialogueBox.show(node.speaker, node.text);
  },
});
vn.load(tree); // → shows "The dragon still lives — hurry." (switch 10 is false)

// 3. A map event elsewhere that flips the switch when the dragon dies, and a
//    second event that is invisible until it does.
const events = new MapEventSystem(); // same shared variableStore
events.addEvent({
  id: "dragon-death",
  tileX: 20,
  tileY: 4,
  trigger: "player-touch",
  commands: [{ type: "set-switch", index: 10, value: true }],
});
events.addEvent({
  id: "throne-room-door",
  tileX: 0,
  tileY: 0,
  trigger: "autorun",
  when: { kind: "switch", index: 10, equals: true },
  commands: [
    { type: "show-dialogue", speaker: "Guard", text: "The way is open." },
  ],
});

// Once the player steps on the dragon-death tile, `throne-room-door` fires on
// the very next update() — and re-running `vn.load(tree)` now shows
// "You saved the realm." because both systems read the same VariableStore.
```

---

## Notes

- Indices are clamped to `[1, 1000]` and floored — out-of-range or fractional indices are silently normalized rather than throwing.
- `VariableStore` has no `destroy()` — release the reference and it is garbage-collected. It has no per-frame work, so it is not an `UpdatableSystem`.
- For save-game integration, embed `variableStore.snapshot()` inside your `SaveSystem` slot's `data` field and call `variableStore.restore(...)` after loading — see [SaveSystem](./save-system.md).
