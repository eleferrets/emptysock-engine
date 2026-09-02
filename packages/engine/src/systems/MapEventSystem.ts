export type EventTriggerType = 'autorun' | 'player-touch' | 'action-button' | 'parallel';

export type EventCommand =
  | { type: 'show-dialogue'; speaker: string; text: string }
  | { type: 'set-variable'; index: number; value: number }
  | { type: 'set-switch'; index: number; value: boolean }
  | { type: 'play-audio'; src: string; volume?: number }
  | { type: 'transition-scene'; scene: string; transition?: string }
  | { type: 'move-character'; entityId: string; tileX: number; tileY: number };

export interface MapEvent {
  id: string;
  tileX: number;
  tileY: number;
  trigger: EventTriggerType;
  commands: EventCommand[];
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
  update(playerTileX: number, playerTileY: number, actionPressed: boolean): void {
    if (this._running?.running) return;

    for (const event of this._events.values()) {
      if (event.trigger === 'autorun' && !this._triggered.has(event.id)) {
        this._runEvent(event);
        return;
      }
      if (event.trigger === 'parallel') {
        this._runEvent(event);
        return;
      }
      const onTile = event.tileX === playerTileX && event.tileY === playerTileY;
      if (!onTile) continue;
      if (event.trigger === 'player-touch' && !this._triggered.has(event.id)) {
        this._runEvent(event);
        return;
      }
      if (event.trigger === 'action-button' && actionPressed) {
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
    this._executeNext(state);
  }

  private _executeNext(state: RunningEvent): void {
    if (!this._handler) return;
    const { event } = state;
    if (state.commandIndex >= event.commands.length) {
      state.running = false;
      if (event.trigger !== 'parallel' && event.trigger !== 'autorun') {
        // allow re-triggering action-button / player-touch events
        this._triggered.delete(event.id);
      }
      return;
    }
    const cmd = event.commands[state.commandIndex];
    state.commandIndex++;
    const result = this._handler(cmd);
    if (result instanceof Promise) {
      result.then(() => this._executeNext(state));
    } else {
      this._executeNext(state);
    }
  }

  /** Serialize all events (for saving in emptysock.project.json) */
  toJSON(): MapEvent[] {
    return Array.from(this._events.values());
  }
}
