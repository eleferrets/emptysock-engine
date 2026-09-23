/**
 * `Engine`'s error/file-log/debugger surface lives in `../ecs/Diagnostics.ts`
 * now (zero classic-model coupling — a future ECS-only host wires it without
 * needing this object's `pushScene`/`popScene` facade, which genuinely does
 * need `SceneManagerInstance`). `Engine` spreads that one implementation
 * rather than duplicating it, and adds only the scene-stack methods that are
 * actually classic-only.
 */
export declare const Engine: {
  /**
   * Push a new scene on top of the active scene (e.g. a pause menu over the game).
   * The scene underneath is paused but stays in memory. Call popScene() to return.
   */
  pushScene: (scene: import("./Scene.js").Scene) => void;
  /** Pop the top scene off the stack and resume the scene underneath. */
  popScene: () => void;
  init(adapter: import("@emptysock/types").HostAdapter): void;
  onError(handler: (msg: string) => void): () => void;
  onFileLog(handler: (msg: string) => void): () => void;
  logError(msg: string): void;
  logDebugError(msg: string): void;
  logErrorToFile(msg: string): void;
  isDebugPaused(): boolean;
  setBreakpoints(labels: string[]): void;
  debugBreak(label: string, vars?: Record<string, unknown>): void;
};
