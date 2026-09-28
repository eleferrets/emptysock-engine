export type WindowMode = "windowed" | "fullscreen" | "borderless";
export interface WindowConfig {
  mode: WindowMode;
  width: number;
  height: number;
  title: string;
  resizable: boolean;
  minWidth: number;
  minHeight: number;
}
export declare class WindowSystem {
  private config;
  private _f11Handler;
  /**
   * Apply an initial config at game startup. Mirrors the project's window
   * settings so game code doesn't have to call individual setters on load.
   */
  apply(config: Partial<WindowConfig>): Promise<void>;
  /**
   * The window's last-known width/height, in real OS pixels on desktop or
   * the backing element's CSS pixels in the browser — whatever `apply()`/
   * `setSize()` most recently set (or `DEFAULT_CONFIG`'s value if neither
   * has run yet). Not an async live query of the real OS window (unlike
   * `setSize`, which does await one) — GML's own `window_get_width`/
   * `_height` are synchronous, so this reads back the same authored value
   * this class itself is the source of truth for, matching every other
   * compat function's "read the value this engine already tracks" shape.
   */
  getSize(): {
    width: number;
    height: number;
  };
  setMode(mode: WindowMode): Promise<void>;
  setSize(width: number, height: number): Promise<void>;
  setTitle(title: string): Promise<void>;
  setResizable(resizable: boolean): Promise<void>;
  setMinSize(width: number, height: number): Promise<void>;
  setPosition(x: number, y: number): Promise<void>;
  center(): Promise<void>;
  setAlwaysOnTop(value: boolean): Promise<void>;
  get currentMode(): WindowMode;
  get currentConfig(): Readonly<WindowConfig>;
  destroy(): void;
  private _applyModeTauri;
  private _applyModeBrowser;
  private _installBrowserF11;
  private _toggleBrowserFullscreen;
}
//# sourceMappingURL=WindowSystem.d.ts.map
