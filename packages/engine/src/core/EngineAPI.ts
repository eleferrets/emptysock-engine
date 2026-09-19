import type { Scene } from "./Scene.js";
import { SceneManagerInstance } from "./SceneManager.js";

type ErrorHandler = (msg: string) => void;

const _errorHandlers: ErrorHandler[] = [];
let _fileLogHandler: ErrorHandler | null = null;

// ── Debugger state ───────────────────────────────────────────────────────────

let _debugPaused = false;
const _debugBreakpoints = new Set<string>();

function _installDebugMessageListener(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data;
    if (typeof data !== "object" || data === null) return;
    const d = data as Record<string, unknown>;
    const msgType = d["type"];
    if (msgType === "debug:pause") {
      _debugPaused = true;
    } else if (msgType === "debug:resume") {
      _debugPaused = false;
    } else if (msgType === "debug:step") {
      _debugPaused = false;
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => {
          _debugPaused = true;
        });
      }
    } else if (msgType === "debug:setBreakpoints") {
      const labels = d["labels"];
      _debugBreakpoints.clear();
      if (Array.isArray(labels)) {
        for (const l of labels) {
          if (typeof l === "string") _debugBreakpoints.add(l);
        }
      }
    }
  });
}

if (typeof window !== "undefined") {
  _installDebugMessageListener();
}

export const Engine = {
  /** Register a callback invoked whenever Engine.logError is called. Returns an unsubscribe function. */
  onError(handler: ErrorHandler): () => void {
    _errorHandlers.push(handler);
    return () => {
      const i = _errorHandlers.indexOf(handler);
      if (i !== -1) _errorHandlers.splice(i, 1);
    };
  },

  /**
   * Register a callback that receives the message when logErrorToFile is called.
   * Wire this up in the IDE/Tauri layer; game code and the engine core must not
   * import Tauri APIs directly. Returns an unsubscribe function.
   */
  onFileLog(handler: ErrorHandler): () => void {
    _fileLogHandler = handler;
    return () => {
      if (_fileLogHandler === handler) _fileLogHandler = null;
    };
  },

  /** Log a runtime error to registered handlers and the console. */
  logError(msg: string): void {
    console.error("[Engine]", msg);
    for (const h of _errorHandlers) h(msg);
  },

  /** Log a debug-level message without triggering error handlers. */
  logDebugError(msg: string): void {
    console.debug("[Engine]", msg);
  },

  /** Delegate to the file-log handler registered by the host layer. No-op if not set. */
  logErrorToFile(msg: string): void {
    _fileLogHandler?.(msg);
  },

  // ── Debugger API ───────────────────────────────────────────────────────────

  /**
   * Returns true when the IDE debugger has paused the game loop.
   * Scene.update() checks this each frame to skip updates while paused.
   */
  isDebugPaused(): boolean {
    return _debugPaused;
  },

  /**
   * Programmatically set the active breakpoint labels. Prefer letting the IDE
   * keep this list in sync via debug:setBreakpoints postMessage, but this
   * method is available for use in tests or headless contexts.
   */
  setBreakpoints(labels: string[]): void {
    _debugBreakpoints.clear();
    for (const l of labels) _debugBreakpoints.add(l);
  },

  /**
   * Trigger a labelled breakpoint from game code. If `label` is in the active
   * breakpoint set, pauses the game loop and posts a debug:break message with
   * the current variable snapshot to the IDE window.
   *
   * Example:
   *   Engine.debugBreak('player-hit', { hp: player.hp, x: player.x });
   *
   * The IDE must have registered this label via addBreakpoint() in the
   * Debugger panel for the call to have any effect.
   */
  debugBreak(label: string, vars: Record<string, unknown> = {}): void {
    if (!_debugBreakpoints.has(label)) return;
    _debugPaused = true;
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "debug:break", label, vars }, "*");
    }
  },

  // ── Scene stack ───────────────────────────────────────────────────────────

  /**
   * Push a new scene on top of the active scene (e.g. a pause menu over the game).
   * The scene underneath is paused but stays in memory. Call popScene() to return.
   */
  pushScene(scene: Scene): void {
    SceneManagerInstance.pushScene(scene);
  },

  /** Pop the top scene off the stack and resume the scene underneath. */
  popScene(): void {
    SceneManagerInstance.popScene();
  },

  /**
   * Load a named scene, replacing the active scene.
   * Uses SceneManager.transition() with no animation so onDestroy/onLoad
   * lifecycle hooks are honoured. The scene must be registered first.
   */
  loadScene(name: string): void {
    SceneManagerInstance.transition(name, { effect: "none", duration: 0 });
  },
};
