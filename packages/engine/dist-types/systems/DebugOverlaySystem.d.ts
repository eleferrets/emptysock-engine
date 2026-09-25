import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { WidgetTree } from "../ui/WidgetTree.js";
export type LogLevel = "log" | "warn" | "error";
export interface DebugLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
}
export type DebugCommandHandler = (args: string[]) => string | void;
/**
 * Disabled by default; a stats line + scrollback console, a command
 * registry, rendered through `WidgetTree`/`UISystem` (`PanelStyle` +
 * `Label` widgets), so it works identically in Node/tests, the browser
 * preview, and the Tauri WebView. Uses `Layout`'s `positionType: "absolute"`
 * (added for exactly this: a fixed HUD overlay position independent of any
 * sibling flex layout).
 */
export declare class DebugOverlaySystem {
  private _enabled;
  private readonly _commands;
  private readonly _log;
  private _entityCount;
  private _frameTimeMs;
  private _fps;
  private _frameAccum;
  private _frameSamples;
  readonly root: Entity;
  private readonly _statsLabel;
  private readonly _consoleLabel;
  constructor(scene: Scene, tree: WidgetTree);
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
