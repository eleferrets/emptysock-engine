/**
 * HotReloadSystem — registers per-reload hooks that the IDE layer calls during
 * hot reload. Game code calls the on* registration methods (e.g. in onLoad) to
 * receive reload events.
 *
 * The IDE / host layer is responsible for wiring window.__es_before_reload__ and
 * the other window-level globals to this system's runBefore/runAfter/etc helpers.
 * The engine does not write to window directly.
 */
export class HotReloadSystem {
  private beforeHooks: Array<() => void> = [];
  private afterHooks: Array<() => void> = [];
  private spriteHooks: Array<(name: string, dataUrl: string) => void> = [];
  private shaderHooks: Array<
    (name: string, vert: string, frag: string) => void
  > = [];
  private roomHooks: Array<(name: string, roomJson: string) => void> = [];

  onBeforeReload(fn: () => void): () => void {
    this.beforeHooks.push(fn);
    return () => { const i = this.beforeHooks.indexOf(fn); if (i !== -1) this.beforeHooks.splice(i, 1); };
  }

  onAfterReload(fn: () => void): () => void {
    this.afterHooks.push(fn);
    return () => { const i = this.afterHooks.indexOf(fn); if (i !== -1) this.afterHooks.splice(i, 1); };
  }

  onSpriteReload(fn: (name: string, dataUrl: string) => void): () => void {
    this.spriteHooks.push(fn);
    return () => { const i = this.spriteHooks.indexOf(fn); if (i !== -1) this.spriteHooks.splice(i, 1); };
  }

  onShaderReload(fn: (name: string, vert: string, frag: string) => void): () => void {
    this.shaderHooks.push(fn);
    return () => { const i = this.shaderHooks.indexOf(fn); if (i !== -1) this.shaderHooks.splice(i, 1); };
  }

  onRoomReload(fn: (name: string, roomJson: string) => void): () => void {
    this.roomHooks.push(fn);
    return () => { const i = this.roomHooks.indexOf(fn); if (i !== -1) this.roomHooks.splice(i, 1); };
  }

  // ── Helpers called by the IDE host layer ─────────────────────────────────
  // The IDE wires window.__es_before_reload__ etc. to these methods.

  runBeforeReload(): void {
    this.beforeHooks.forEach((h) => h());
  }

  runAfterReload(): void {
    this.afterHooks.forEach((h) => h());
  }

  runSpriteReload(name: string, dataUrl: string): void {
    this.spriteHooks.forEach((h) => h(name, dataUrl));
  }

  runShaderReload(name: string, vert: string, frag: string): void {
    this.shaderHooks.forEach((h) => h(name, vert, frag));
  }

  runRoomReload(name: string, roomJson: string): void {
    this.roomHooks.forEach((h) => h(name, roomJson));
  }

  /** Clear all registered hooks (call when the scene is destroyed). */
  destroy(): void {
    this.beforeHooks = [];
    this.afterHooks = [];
    this.spriteHooks = [];
    this.shaderHooks = [];
    this.roomHooks = [];
  }
}
