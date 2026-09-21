import { PanelWidget } from "../ui/widgets/panel.js";
export type LogLevel = "log" | "warn" | "error";
export interface DebugLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
}
export type DebugCommandHandler = (args: string[]) => string | void;
export declare class DebugOverlaySystem {
  private _enabled;
  private readonly _commands;
  private readonly _log;
  private _entityCount;
  private _frameTimeMs;
  private _fps;
  private _frameAccum;
  private _frameSamples;
  readonly root: PanelWidget;
  private readonly _statsLabel;
  private readonly _consoleLabel;
  constructor();
  get enabled(): boolean;
  enable(): void;
  disable(): void;
  toggle(): void;
  /** Call once per frame with the frame's delta time (seconds) and current entity count. */
  update(dt: number, entityCount: number): void;
  log(message: string): void;
  warn(message: string): void;
  /** Intended to be wired to Engine.logError so runtime errors surface in-overlay. */
  logError(message: string): void;
  get history(): ReadonlyArray<DebugLogEntry>;
  private _push;
  registerCommand(name: string, handler: DebugCommandHandler): void;
  unregisterCommand(name: string): void;
  /** Parses "name arg1 arg2" and dispatches to a registered command. */
  runCommand(line: string): string;
  get commandNames(): ReadonlyArray<string>;
}
