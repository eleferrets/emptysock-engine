export type EventTriggerType =
  | "autorun"
  | "player-touch"
  | "action-button"
  | "parallel";
export type EventCommand =
  | {
      type: "show-dialogue";
      speaker: string;
      text: string;
    }
  | {
      type: "set-variable";
      index: number;
      value: number;
    }
  | {
      type: "set-switch";
      index: number;
      value: boolean;
    }
  | {
      type: "play-audio";
      src: string;
      volume?: number;
    }
  | {
      type: "transition-scene";
      scene: string;
      transition?: string;
    }
  | {
      type: "move-character";
      entityId: string;
      tileX: number;
      tileY: number;
    };
export interface MapEvent {
  id: string;
  tileX: number;
  tileY: number;
  trigger: EventTriggerType;
  commands: EventCommand[];
}
export type EventCommandHandler = (cmd: EventCommand) => void | Promise<void>;
export declare class MapEventSystem {
  private _events;
  private _handler;
  private _running;
  private _triggered;
  private _parallelRunning;
  private _destroyed;
  /** Register the handler that executes each command */
  setHandler(handler: EventCommandHandler): void;
  addEvent(event: MapEvent): void;
  removeEvent(id: string): void;
  loadEvents(events: MapEvent[]): void;
  /** Call each frame; tileX/tileY = player tile position; actionPressed = action button was pressed this frame */
  update(
    playerTileX: number,
    playerTileY: number,
    actionPressed: boolean,
  ): void;
  private _runEvent;
  private _runParallelEvent;
  private _executeCommandChain;
  clear(): void;
  destroy(): void;
  /** Serialize all events (for saving in emptysock.project.json) */
  toJSON(): MapEvent[];
}
