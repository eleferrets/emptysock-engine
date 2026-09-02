/**
 * HotReloadSystem — registers window-level hooks that the IDE iframe message
 * handler calls during hot reload. Game code calls install() once (e.g. in
 * onLoad) and destroy() in onDestroy to clean up.
 */
export class HotReloadSystem {
  private beforeHooks: Array<() => void> = [];
  private afterHooks: Array<() => void> = [];
  private spriteHooks: Array<(name: string, dataUrl: string) => void> = [];
  private shaderHooks: Array<
    (name: string, vert: string, frag: string) => void
  > = [];
  private roomHooks: Array<(name: string, roomJson: string) => void> = [];

  onBeforeReload(fn: () => void): void {
    this.beforeHooks.push(fn);
  }

  onAfterReload(fn: () => void): void {
    this.afterHooks.push(fn);
  }

  onSpriteReload(fn: (name: string, dataUrl: string) => void): void {
    this.spriteHooks.push(fn);
  }

  onShaderReload(fn: (name: string, vert: string, frag: string) => void): void {
    this.shaderHooks.push(fn);
  }

  onRoomReload(fn: (name: string, roomJson: string) => void): void {
    this.roomHooks.push(fn);
  }

  install(): void {
    const win = window as unknown as Record<string, unknown>;
    win["__es_before_reload__"] = (): void => {
      this.beforeHooks.forEach((h) => h());
    };
    win["__es_after_reload__"] = (): void => {
      this.afterHooks.forEach((h) => h());
    };
    win["__es_hmr_sprite__"] = (n: string, d: string): void => {
      this.spriteHooks.forEach((h) => h(n, d));
    };
    win["__es_hmr_shader__"] = (n: string, v: string, f: string): void => {
      this.shaderHooks.forEach((h) => h(n, v, f));
    };
    win["__es_hmr_room__"] = (n: string, r: string): void => {
      this.roomHooks.forEach((h) => h(n, r));
    };
  }

  destroy(): void {
    const win = window as unknown as Record<string, unknown>;
    delete win["__es_before_reload__"];
    delete win["__es_after_reload__"];
    delete win["__es_hmr_sprite__"];
    delete win["__es_hmr_shader__"];
    delete win["__es_hmr_room__"];
    this.beforeHooks = [];
    this.afterHooks = [];
    this.spriteHooks = [];
    this.shaderHooks = [];
    this.roomHooks = [];
  }
}
