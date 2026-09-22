import {
  VariableStore,
  evaluateCondition,
  type VariableCondition,
} from "./VariableStore.js";

export type { VariableCondition } from "./VariableStore.js";

export type EventTriggerType =
  | "autorun"
  | "player-touch"
  | "action-button"
  | "parallel";

export type EventCommand =
  | { type: "show-dialogue"; speaker: string; text: string }
  | { type: "set-variable"; index: number; value: number }
  | { type: "set-switch"; index: number; value: boolean }
  | { type: "play-audio"; src: string; volume?: number }
  | { type: "transition-scene"; scene: string; transition?: string }
  | { type: "move-character"; entityId: string; tileX: number; tileY: number };

export interface MapEvent {
  id: string;
  tileX: number;
  tileY: number;
  trigger: EventTriggerType;
  commands: EventCommand[];
  /**
   * Optional gate evaluated against the `VariableStore` before the event is
   * allowed to run. When present and false, `update()` skips the event
   * entirely — it never triggers, autoruns, or fires as a parallel process,
   * and it is re-checked every frame so it can start once the condition
   * becomes true.
   */
  when?: VariableCondition;
}

export type EventCommandHandler = (cmd: EventCommand) => void | Promise<void>;

interface RunningEvent {
  event: MapEvent;
  commandIndex: number;
  running: boolean;
}

export class MapEventSystem {
  private _events: Map<string, MapEvent> = new Map();
  private _handler: EventCommandHandler | null = null;
  private _running: RunningEvent | null = null;
  private _triggered: Set<string> = new Set();
  private _parallelRunning: Set<string> = new Set();
  private _destroyed = false;
  private readonly _store: VariableStore;

  /**
   * @param store The `VariableStore` used to gate `when`-conditioned events
   * and to apply `set-variable` / `set-switch` commands. Defaults to a fresh,
   * isolated instance — pass `ctx.variables` (the `Game`-owned instance
   * handed to every scene's `SceneLifecycle`) to share variables/switches
   * with the rest of the game, or a different instance for isolated testing
   * or a per-save-slot store.
   */
  constructor(store: VariableStore = new VariableStore()) {
    this._store = store;
  }

  /** Register the handler that executes each command */
  setHandler(handler: EventCommandHandler): void {
    this._handler = handler;
  }

  addEvent(event: MapEvent): void {
    this._events.set(event.id, event);
  }

  removeEvent(id: string): void {
    this._events.delete(id);
  }

  loadEvents(events: MapEvent[]): void {
    this._events.clear();
    for (const e of events) this._events.set(e.id, e);
  }

  /** Call each frame; tileX/tileY = player tile position; actionPressed = action button was pressed this frame */
  update(
    playerTileX: number,
    playerTileY: number,
    actionPressed: boolean,
  ): void {
    // Fire all parallel events that are not already running (concurrent — not blocked by _running)
    for (const event of this._events.values()) {
      if (
        event.when !== undefined &&
        !evaluateCondition(this._store, event.when)
      ) {
        continue;
      }
      if (
        event.trigger === "parallel" &&
        !this._parallelRunning.has(event.id)
      ) {
        this._runParallelEvent(event);
      }
    }

    if (this._running?.running) return;

    for (const event of this._events.values()) {
      if (event.trigger === "parallel") continue;
      if (
        event.when !== undefined &&
        !evaluateCondition(this._store, event.when)
      ) {
        continue;
      }
      if (event.trigger === "autorun" && !this._triggered.has(event.id)) {
        this._runEvent(event);
        return;
      }
      const onTile = event.tileX === playerTileX && event.tileY === playerTileY;
      if (!onTile) continue;
      if (event.trigger === "player-touch" && !this._triggered.has(event.id)) {
        this._runEvent(event);
        return;
      }
      if (event.trigger === "action-button" && actionPressed) {
        this._runEvent(event);
        return;
      }
    }
  }

  private _runEvent(event: MapEvent): void {
    if (!this._handler || event.commands.length === 0) return;
    const state: RunningEvent = { event, commandIndex: 0, running: true };
    this._running = state;
    this._triggered.add(event.id);
    this._executeCommandChain(state, () => {
      if (event.trigger !== "parallel" && event.trigger !== "autorun") {
        // allow re-triggering action-button / player-touch events
        this._triggered.delete(event.id);
      }
    });
  }

  private _runParallelEvent(event: MapEvent): void {
    if (!this._handler || event.commands.length === 0) return;
    this._parallelRunning.add(event.id);
    const state: RunningEvent = { event, commandIndex: 0, running: true };
    this._executeCommandChain(state, () => {
      this._parallelRunning.delete(event.id);
    });
  }

  private _executeCommandChain(state: RunningEvent, onDone: () => void): void {
    if (this._destroyed || !this._handler) return;
    const { event } = state;
    if (state.commandIndex >= event.commands.length) {
      state.running = false;
      onDone();
      return;
    }
    const cmd = event.commands[state.commandIndex];
    if (cmd === undefined) {
      state.running = false;
      onDone();
      return;
    }
    state.commandIndex++;

    // `set-variable` / `set-switch` are applied to the VariableStore directly
    // by the engine — they are the mechanism `when` conditions read back, so
    // game code never needs to intercept them in its command handler.
    if (cmd.type === "set-variable") {
      this._store.setVar(cmd.index, cmd.value);
      this._executeCommandChain(state, onDone);
      return;
    }
    if (cmd.type === "set-switch") {
      this._store.setSwitch(cmd.index, cmd.value);
      this._executeCommandChain(state, onDone);
      return;
    }

    const result = this._handler(cmd);
    if (result instanceof Promise) {
      void result.then(() => {
        this._executeCommandChain(state, onDone);
      });
    } else {
      this._executeCommandChain(state, onDone);
    }
  }

  clear(): void {
    this._events.clear();
    this._running = null;
    this._triggered.clear();
    this._parallelRunning.clear();
  }

  destroy(): void {
    this._destroyed = true;
    this.clear();
    this._handler = null;
  }

  /** Serialize all events (for saving in emptysock.project.json) */
  toJSON(): MapEvent[] {
    return Array.from(this._events.values());
  }
}
