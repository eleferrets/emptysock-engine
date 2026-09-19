/**
 * HotReloadSystem — registers window-level hooks that the IDE iframe message
 * handler calls during hot reload. Game code calls install() once (e.g. in
 * onLoad) and destroy() in onDestroy to clean up.
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
  install(): void;
  destroy(): void;
}
