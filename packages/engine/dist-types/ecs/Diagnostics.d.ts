import type { HostAdapter } from "@emptysock/types";
/**
 * Error/file-log/debugger surface, extracted out of `core/EngineAPI.ts`'s
 * `Engine` object so `apps/ide` (or any other ECS-only host) can wire the
 * Tauri file-log handler and the IDE debugger's pause/breakpoint protocol
 * without needing `Engine`'s `pushScene`/`popScene` facade, which genuinely
 * does need the classic scene-stack singleton (`SceneManager.ts`'s
 * `SceneManagerInstance`) — the ECS core has no equivalent pause/resume
 * stack (see CLAUDE.md's "SceneTransitionManager" entry). This module has
 * zero classic-model coupling: it never imports `SceneManager.ts`. `Engine`
 * itself spreads this object plus its own `pushScene`/`popScene` methods, so
 * there is exactly one diagnostics implementation, not a parallel copy.
 */
type ErrorHandler = (msg: string) => void;
export declare const Diagnostics: {
  /**
   * Attach a HostAdapter so the debugger message listener and postMessage
   * calls route through the correct host environment. Call once at startup
   * from the IDE layer or PlayRunner; game code should not call this.
   */
  init(adapter: HostAdapter): void;
  /** Register a callback invoked whenever Diagnostics.logError is called. Returns an unsubscribe function. */
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
   * `Game.update()` checks this each frame to skip updates while paused.
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
   *   Diagnostics.debugBreak('player-hit', { hp: player.hp, x: player.x });
   *
   * The IDE must have registered this label via addBreakpoint() in the
   * Debugger panel for the call to have any effect.
   */
  debugBreak(label: string, vars?: Record<string, unknown>): void;
};
export {};
