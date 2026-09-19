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
export declare const windowSystem: WindowSystem;
