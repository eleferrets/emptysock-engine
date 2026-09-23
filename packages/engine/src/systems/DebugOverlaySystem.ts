import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import { LayoutStyle } from "../components/Layout.js";
import { Label, PanelStyle, WidgetAppearance } from "../components/Widgets.js";
import type { WidgetTree } from "../ui/WidgetTree.js";

export type LogLevel = "log" | "warn" | "error";

export interface DebugLogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
}

export type DebugCommandHandler = (args: string[]) => string | void;

const MAX_LOG_LINES = 200;
const VISIBLE_LOG_LINES = 8;

/**
 * ECS-core port of `../../systems/DebugOverlaySystem.ts` — same contract
 * (disabled by default, a stats line + scrollback console, a command
 * registry), rendered through `WidgetTree`/`UISystem` (`PanelStyle` +
 * `Label` widgets) instead of the classic `PanelWidget`/`LabelWidget`
 * classes, so it works identically in Node/tests, the browser preview, and
 * the Tauri WebView the same way the classic version did. Uses `Layout`'s
 * new `positionType: "absolute"` (added for exactly this: a fixed HUD
 * overlay position independent of any sibling flex layout).
 */
export class DebugOverlaySystem {
  private _enabled = false;
  private readonly _commands = new Map<string, DebugCommandHandler>();
  private readonly _log: DebugLogEntry[] = [];

  private _entityCount = 0;
  private _frameTimeMs = 0;
  private _fps = 0;
  private _frameAccum = 0;
  private _frameSamples = 0;

  readonly root: Entity;
  private readonly _statsLabel: Entity;
  private readonly _consoleLabel: Entity;

  constructor(scene: Scene, tree: WidgetTree) {
    this.root = tree.createWidget(scene);
    this.root.add(PanelStyle, {
      background: "#000000cc",
      borderColor: "#33ff99",
      borderWidth: 1,
    });
    this.root.add(WidgetAppearance, { visible: false });
    const rootStyle = this.root.get(LayoutStyle);
    if (rootStyle !== undefined) {
      rootStyle.positionType = 1;
      rootStyle.left = 8;
      rootStyle.top = 8;
      rootStyle.width = 360;
      rootStyle.height = 160;
      rootStyle.padding = 8;
    }

    this._statsLabel = tree.createWidget(scene, this.root);
    this._statsLabel.add(Label, {
      color: "#33ff99",
      font: "monospace",
      fontSize: 12,
    });
    const statsStyle = this._statsLabel.get(LayoutStyle);
    if (statsStyle !== undefined) statsStyle.height = 40;

    this._consoleLabel = tree.createWidget(scene, this.root);
    this._consoleLabel.add(Label, {
      color: "#cccccc",
      font: "monospace",
      fontSize: 11,
    });
    const consoleStyle = this._consoleLabel.get(LayoutStyle);
    if (consoleStyle !== undefined) consoleStyle.height = 100;

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
    const appearance = this.root.get(WidgetAppearance);
    if (appearance !== undefined) appearance.visible = true;
  }

  disable(): void {
    this._enabled = false;
    const appearance = this.root.get(WidgetAppearance);
    if (appearance !== undefined) appearance.visible = false;
  }

  toggle(): void {
    if (this._enabled) this.disable();
    else this.enable();
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
    const statsLabel = this._statsLabel.get(Label);
    if (statsLabel !== undefined) {
      statsLabel.text = `FPS: ${this._fps}  frame: ${this._frameTimeMs.toFixed(2)}ms  entities: ${this._entityCount}`;
    }
    const consoleLabel = this._consoleLabel.get(Label);
    if (consoleLabel !== undefined) {
      const visible = this._log.slice(-VISIBLE_LOG_LINES);
      consoleLabel.text = visible
        .map((e) => `[${e.level}] ${e.message}`)
        .join("\n");
    }
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
