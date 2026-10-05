# MapEventSystem

`MapEventSystem` is a tile-aligned event system similar to RPG Maker. Events sit at tile coordinates, run a command list when triggered, and can be gated on persistent state via [`VariableStore`](./variable-store.md).

Import: `import { MapEventSystem, type MapEvent, type EventCommand, type EventTriggerType } from '@emptysock/engine';`

---

## `new MapEventSystem(store?: VariableStore)`

Defaults to the shared `variableStore` singleton. Pass your own `VariableStore` instance for isolated testing or a per-save-slot store.

## `addEvent(event: MapEvent): void` / `removeEvent(id: string): void` / `loadEvents(events: MapEvent[]): void`

Register events. `loadEvents` clears and replaces the whole set — use it when loading a map.

## `setHandler(handler: EventCommandHandler): void`

Registers the callback that executes each command as it runs, in order. `handler` may return `void` or a `Promise<void>`; returning a promise pauses the chain until it resolves, so `await`-style sequencing (e.g. waiting on a dialogue box) works naturally.

> `"set-variable"` and `"set-switch"` commands are **not** forwarded to your handler — `MapEventSystem` applies them directly to its `VariableStore`. Handle every other `EventCommand` type in your handler.

## `update(playerTileX: number, playerTileY: number, actionPressed: boolean): void`

Call once per frame. Runs `parallel` events concurrently, then (if nothing else is running) checks `autorun`, `player-touch`, and `action-button` events against the player's tile.

## `clear(): void` / `destroy(): void`

`clear()` resets registered events and running state (keeps the handler). `destroy()` additionally detaches the handler and stops further command execution — call it when the map unloads.

## `toJSON(): MapEvent[]`

Serialize all registered events, for saving inside `emptysock.project.json`.

---

## `MapEvent`

| Field      | Type                 | Notes                                                          |
| ---------- | -------------------- | -------------------------------------------------------------- |
| `id`       | `string`             | Unique per map                                                 |
| `tileX`    | `number`             | —                                                              |
| `tileY`    | `number`             | —                                                              |
| `trigger`  | `EventTriggerType`   | `'autorun' \| 'player-touch' \| 'action-button' \| 'parallel'` |
| `commands` | `EventCommand[]`     | Executed in order                                              |
| `when`     | `VariableCondition?` | Optional gate — see **Conditional events** below               |

## `EventCommand` — discriminated union

| `type`               | Fields                       | Notes                                                       |
| -------------------- | ---------------------------- | ----------------------------------------------------------- |
| `'show-dialogue'`    | `speaker`, `text`            | Forwarded to your handler                                   |
| `'set-variable'`     | `index`, `value`             | Applied to the `VariableStore` automatically, not forwarded |
| `'set-switch'`       | `index`, `value`             | Applied to the `VariableStore` automatically, not forwarded |
| `'play-audio'`       | `src`, `volume?`             | Forwarded to your handler                                   |
| `'transition-scene'` | `scene`, `transition?`       | Forwarded to your handler                                   |
| `'move-character'`   | `entityId`, `tileX`, `tileY` | Forwarded to your handler                                   |

---

## Conditional events

Add a `when: VariableCondition` field (see [VariableStore](./variable-store.md#variablecondition--the-conditional-logic-seam)) to gate whether an event is even eligible to run. `update()` re-checks it every frame, so a gated `autorun` fires the instant its condition becomes true — no polling code required in game logic:

```typescript
import { MapEventSystem, variableStore } from "@emptysock/engine";

const events = new MapEventSystem();

events.addEvent({
  id: "secret-passage",
  tileX: 12,
  tileY: 3,
  trigger: "autorun",
  when: { kind: "switch", index: 10, equals: true }, // "bossDefeated"
  commands: [
    { type: "show-dialogue", speaker: "Narrator", text: "A path appears." },
  ],
});

events.addEvent({
  id: "defeat-boss",
  tileX: 12,
  tileY: 1,
  trigger: "player-touch",
  // Flips the switch automatically — no handler code needed for this command.
  commands: [{ type: "set-switch", index: 10, value: true }],
});

events.setHandler((cmd) => {
  if (cmd.type === "show-dialogue") dialogueBox.show(cmd.speaker, cmd.text);
});

// In onUpdate:
events.update(playerTileX, playerTileY, Input.isPressed("Space"));
```

The first time `update()` runs after the player steps onto `defeat-boss`'s tile, `set-switch` flips switch 10 to `true`. On the very next `update()` call, `secret-passage`'s `when` condition passes and its `autorun` fires.

A `variable`-kind condition works the same way for numeric thresholds:

```typescript
events.addEvent({
  id: "merchant-discount",
  tileX: 0,
  tileY: 0,
  trigger: "player-touch",
  when: { kind: "variable", index: 2, op: "gte", value: 100 }, // reputation >= 100
  commands: [
    {
      type: "show-dialogue",
      speaker: "Merchant",
      text: "For you, a discount.",
    },
  ],
});
```

---

## Notes

- `MapEventSystem` requires a handler (`setHandler`) to run any event, including one whose only commands are `set-variable` / `set-switch` — register a handler (even a no-op for unused command types) before calling `update()`.
- `autorun` and `player-touch` events fire once and then stay latched until re-triggerable conditions reset them (`autorun` never re-fires once triggered in the current session; `player-touch` re-arms once the player leaves and returns).
- `parallel` events run independently of the single "blocking" event slot and of each other.
