// DebugOverlaySystem — a shippable in-game debug overlay and console.
//
// Disabled by default: construct it and call `enable()` behind a dev flag
// (e.g. a query param or a build-time constant the game itself defines —
// this system takes no opinion on how that flag is read). Renders through
// the existing UI widget tree (PanelWidget + LabelWidget) so it works in
// Node/tests, the browser preview, and the Tauri WebView identically. Add
// its root widget to a scene's UISystem placed at LAYER.UI so it always
// draws above game content.

import { PanelWidget } from "../ui/widgets/panel.js";
import { LabelWidget } from "../ui/widgets/label.js";

export type LogLevel = "log" | "warn" | "error";

export interface DebugLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
}

export type DebugCommandHandler = (args: string[]) => string | void;

const MAX_LOG_LINES = 200;
const VISIBLE_LOG_LINES = 8;

export class DebugOverlaySystem {
  private _enabled = false;
  private readonly _commands: Map<string, DebugCommandHandler> = new Map();
  private readonly _log: DebugLogEntry[] = [];

  private _entityCount = 0;
  private _frameTimeMs = 0;
  private _fps = 0;
  private _frameAccum = 0;
  private _frameSamples = 0;

  readonly root: PanelWidget;
  private readonly _statsLabel: LabelWidget;
  private readonly _consoleLabel: LabelWidget;

  constructor() {
    this.root = new PanelWidget({
      x: 8,
      y: 8,
      width: 360,
      height: 160,
      background: "#000000cc",
      border: "#33ff99",
      borderWidth: 1,
      visible: false,
    });
    this._statsLabel = new LabelWidget({
      x: 8,
      y: 4,
      width: 344,
      height: 40,
      color: "#33ff99",
      font: "monospace",
      fontSize: 12,
      align: "left",
    });
    this._consoleLabel = new LabelWidget({
      x: 8,
      y: 48,
      width: 344,
      height: 100,
      color: "#cccccc",
      font: "monospace",
      fontSize: 11,
      align: "left",
    });
    this.root.children.push(this._statsLabel, this._consoleLabel);

    this.registerCommand("help", () =>
      [...this._commands.keys()].sort().join(", "),
    );
    this.registerCommand("clear", () => {
      this._log.length = 0;
      return undefined;
    });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  enable(): void {
    this._enabled = true;
    this.root.visible = true;
  }

  disable(): void {
    this._enabled = false;
    this.root.visible = false;
  }

  toggle(): void {
    this._enabled ? this.disable() : this.enable();
  }

  /** Call once per frame with the frame's delta time (seconds) and current entity count. */
  update(dt: number, entityCount: number): void {
    this._entityCount = entityCount;
    this._frameTimeMs = dt * 1000;
    this._frameAccum += dt;
    this._frameSamples++;
    if (this._frameAccum >= 0.5) {
      this._fps = Math.round(this._frameSamples / this._frameAccum);
      this._frameAccum = 0;
      this._frameSamples = 0;
    }
    if (!this._enabled) return;
    this._statsLabel.text = `FPS: ${this._fps}  frame: ${this._frameTimeMs.toFixed(2)}ms  entities: ${this._entityCount}`;
    const visible = this._log.slice(-VISIBLE_LOG_LINES);
    this._consoleLabel.text = visible
      .map((e) => `[${e.level}] ${e.message}`)
      .join("\n");
  }

  // ─── Logging ──────────────────────────────────────────────────────────

  log(message: string): void {
    this._push("log", message);
  }
  warn(message: string): void {
    this._push("warn", message);
  }
  /** Intended to be wired to Engine.logError so runtime errors surface in-overlay. */
  logError(message: string): void {
    this._push("error", message);
  }

  get history(): ReadonlyArray<DebugLogEntry> {
    return this._log;
  }

  private _push(level: LogLevel, message: string): void {
    this._log.push({ level, message, timestamp: Date.now() });
    if (this._log.length > MAX_LOG_LINES) this._log.shift();
  }

  // ─── Commands ─────────────────────────────────────────────────────────

  registerCommand(name: string, handler: DebugCommandHandler): void {
    this._commands.set(name, handler);
  }

  unregisterCommand(name: string): void {
    this._commands.delete(name);
  }

  /** Parses "name arg1 arg2" and dispatches to a registered command. */
  runCommand(line: string): string {
    const parts = line
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    const name = parts[0];
    if (name === undefined) return "";
    const handler = this._commands.get(name);
    if (handler === undefined) {
      const result = `unknown command: ${name}`;
      this.warn(result);
      return result;
    }
    const result = handler(parts.slice(1)) ?? "";
    this.log(`> ${line}`);
    if (result.length > 0) this.log(result);
    return result;
  }

  get commandNames(): ReadonlyArray<string> {
    return [...this._commands.keys()];
  }
}
