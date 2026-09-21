import type { HostAdapter } from "@emptysock/types";
type ErrorHandler = (msg: string) => void;
export declare const Engine: {
  /**
   * Attach a HostAdapter so the debugger message listener and postMessage
   * calls route through the correct host environment. Call once at startup
   * from the IDE layer or PlayRunner; game code should not call this.
   */
  init(adapter: HostAdapter): void;
  /** Register a callback invoked whenever Engine.logError is called. Returns an unsubscribe function. */
  onError(handler: ErrorHandler): () => void;
  /**
   * Register a callback that receives the message when logErrorToFile is called.
   * Wire this up in the IDE/Tauri layer; game code and the engine core must not
   * import Tauri APIs directly. Returns an unsubscribe function.
   */
  onFileLog(handler: ErrorHandler): () => void;
  /** Log a runtime error to registered handlers and the console. */
  logError(msg: string): void;
  /** Log a debug-level message without triggering error handlers. */
  logDebugError(msg: string): void;
  /** Delegate to the file-log handler registered by the host layer. No-op if not set. */
  logErrorToFile(msg: string): void;
  /**
   * Returns true when the IDE debugger has paused the game loop.
   * Scene.update() checks this each frame to skip updates while paused.
   */
  isDebugPaused(): boolean;
  /**
   * Programmatically set the active breakpoint labels. Prefer letting the IDE
   * keep this list in sync via debug:setBreakpoints postMessage, but this
   * method is available for use in tests or headless contexts.
   */
  setBreakpoints(labels: string[]): void;
  /**
   * Trigger a labelled breakpoint from game code. If `label` is in the active
   * breakpoint set, pauses the game loop and posts a debug:break message to
   * the host frame via the registered HostAdapter.
   *
   * Example:
   *   Engine.debugBreak('player-hit', { hp: player.hp, x: player.x });
   *
   * The IDE must have registered this label via addBreakpoint() in the
   * Debugger panel for the call to have any effect.
   */
  debugBreak(label: string, vars?: Record<string, unknown>): void;
  /**
   * Push a new scene on top of the active scene (e.g. a pause menu over the game).
   * The scene underneath is paused but stays in memory. Call popScene() to return.
   */
  pushScene: (scene: import("./Scene.js").Scene) => void;
  /** Pop the top scene off the stack and resume the scene underneath. */
  popScene: () => void;
};
export {};
