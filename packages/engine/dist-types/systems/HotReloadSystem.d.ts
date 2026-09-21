/**
 * HotReloadSystem — registers per-reload hooks that the IDE layer calls during
 * hot reload. Game code calls the on* registration methods (e.g. in onLoad) to
 * receive reload events.
 *
 * The IDE / host layer is responsible for wiring window.__es_before_reload__ and
 * the other window-level globals to this system's runBefore/runAfter/etc helpers.
 * The engine does not write to window directly.
 */
export declare class HotReloadSystem {
  private beforeHooks;
  private afterHooks;
  private spriteHooks;
  private shaderHooks;
  private roomHooks;
  onBeforeReload(fn: () => void): () => void;
  onAfterReload(fn: () => void): () => void;
  onSpriteReload(fn: (name: string, dataUrl: string) => void): () => void;
  onShaderReload(
    fn: (name: string, vert: string, frag: string) => void,
  ): () => void;
  onRoomReload(fn: (name: string, roomJson: string) => void): () => void;
  runBeforeReload(): void;
  runAfterReload(): void;
  runSpriteReload(name: string, dataUrl: string): void;
  runShaderReload(name: string, vert: string, frag: string): void;
  runRoomReload(name: string, roomJson: string): void;
  /** Clear all registered hooks (call when the scene is destroyed). */
  destroy(): void;
}
