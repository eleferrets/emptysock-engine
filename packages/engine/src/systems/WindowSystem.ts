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

const DEFAULT_CONFIG: WindowConfig = {
  mode: "windowed",
  width: 1280,
  height: 720,
  title: "My Game",
  resizable: true,
  minWidth: 320,
  minHeight: 240,
};

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getTauriWindow(): Promise<TauriWindow | null> {
  if (!isTauri()) return null;
  try {
    // Keep the specifier in a variable so bundlers cannot resolve it at build
    // time. In the Tauri WebView the module is injected by the runtime; in
    // any other context isTauri() already returned false above.
    const specifier = "@tauri-apps/api/window";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      getCurrentWindow(): TauriWindow;
    };
    return mod.getCurrentWindow();
  } catch {
    return null;
  }
}

// Minimal shape we use — avoids importing the full Tauri type tree at the engine boundary
interface TauriWindow {
  setFullscreen(fullscreen: boolean): Promise<void>;
  setDecorations(decorations: boolean): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  setSize(size: { width: number; height: number }): Promise<void>;
  setMinSize(size: { width: number; height: number } | null): Promise<void>;
  setPosition(position: { x: number; y: number }): Promise<void>;
  center(): Promise<void>;
  setTitle(title: string): Promise<void>;
  setResizable(resizable: boolean): Promise<void>;
  setAlwaysOnTop(alwaysOnTop: boolean): Promise<void>;
}

function applyBrowserSize(w: number, h: number): void {
  if (typeof document === "undefined") return;
  const canvas = document.querySelector<HTMLElement>("#game-canvas");
  if (canvas === null) return;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.maxWidth = "100vw";
  canvas.style.maxHeight = "100vh";
}

function applyBrowserFill(): void {
  if (typeof document === "undefined") return;
  const canvas = document.querySelector<HTMLElement>("#game-canvas");
  if (canvas === null) return;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.maxWidth = "";
  canvas.style.maxHeight = "";
}

export class WindowSystem {
  private config: WindowConfig = { ...DEFAULT_CONFIG };
  private _f11Handler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Apply an initial config at game startup. Mirrors the project's window
   * settings so game code doesn't have to call individual setters on load.
   */
  async apply(config: Partial<WindowConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    const win = await getTauriWindow();

    if (win !== null) {
      await win.setTitle(this.config.title);
      await win.setResizable(this.config.resizable);
      await win.setMinSize({
        width: this.config.minWidth,
        height: this.config.minHeight,
      });
      await this._applyModeTauri(win, this.config.mode);
    } else {
      this._applyModeBrowser(this.config.mode);
      this._installBrowserF11();
    }
  }

  async setMode(mode: WindowMode): Promise<void> {
    this.config.mode = mode;
    const win = await getTauriWindow();
    if (win !== null) {
      await this._applyModeTauri(win, mode);
    } else {
      this._applyModeBrowser(mode);
    }
  }

  async setSize(width: number, height: number): Promise<void> {
    this.config.width = width;
    this.config.height = height;
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setSize({ width, height });
    } else {
      applyBrowserSize(width, height);
    }
  }

  async setTitle(title: string): Promise<void> {
    if (typeof document === "undefined") return;
    this.config.title = title;
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setTitle(title);
    } else {
      document.title = title;
    }
  }

  async setResizable(resizable: boolean): Promise<void> {
    this.config.resizable = resizable;
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setResizable(resizable);
    }
    // browser: not applicable
  }

  async setMinSize(width: number, height: number): Promise<void> {
    this.config.minWidth = width;
    this.config.minHeight = height;
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setMinSize({ width, height });
    }
  }

  async setPosition(x: number, y: number): Promise<void> {
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setPosition({ x, y });
    }
    // browser: not applicable
  }

  async center(): Promise<void> {
    const win = await getTauriWindow();
    if (win !== null) {
      await win.center();
    }
    // browser: already centred by the page layout
  }

  async setAlwaysOnTop(value: boolean): Promise<void> {
    const win = await getTauriWindow();
    if (win !== null) {
      await win.setAlwaysOnTop(value);
    }
  }

  get currentMode(): WindowMode {
    return this.config.mode;
  }

  get currentConfig(): Readonly<WindowConfig> {
    return this.config;
  }

  destroy(): void {
    if (this._f11Handler && typeof window !== "undefined") {
      window.removeEventListener("keydown", this._f11Handler);
      this._f11Handler = null;
    }
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private async _applyModeTauri(
    win: TauriWindow,
    mode: WindowMode,
  ): Promise<void> {
    switch (mode) {
      case "fullscreen":
        await win.setDecorations(true);
        await win.setFullscreen(true);
        break;
      case "borderless":
        await win.setFullscreen(false);
        await win.setDecorations(false);
        await win.maximize();
        break;
      case "windowed":
        await win.setFullscreen(false);
        await win.setDecorations(true);
        await win.unmaximize();
        await win.setSize({
          width: this.config.width,
          height: this.config.height,
        });
        break;
    }
  }

  private _applyModeBrowser(mode: WindowMode): void {
    if (typeof document === "undefined") return;
    switch (mode) {
      case "fullscreen":
        void document.documentElement.requestFullscreen();
        break;
      case "borderless":
        applyBrowserFill();
        break;
      case "windowed":
        applyBrowserSize(this.config.width, this.config.height);
        break;
    }
  }

  private _installBrowserF11(): void {
    if (typeof window === "undefined") return;
    this._f11Handler = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        this._toggleBrowserFullscreen();
      }
    };
    window.addEventListener("keydown", this._f11Handler);
  }

  private _toggleBrowserFullscreen(): void {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }
}

export const windowSystem = new WindowSystem();
