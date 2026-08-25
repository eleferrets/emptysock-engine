import { autoDetectRenderer, Container, type Renderer } from 'pixi.js';

export interface RenderSystemOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
  antialias?: boolean;
  resolution?: number;
}

export class RenderSystem {
  private _renderer: Renderer | null = null;
  private _stage: Container | null = null;
  private _canvas: HTMLCanvasElement | null = null;

  async init(options: RenderSystemOptions = {}): Promise<void> {
    this._renderer = await autoDetectRenderer({
      width: options.width ?? 1280,
      height: options.height ?? 720,
      backgroundColor: options.backgroundColor ?? 0x0e0e10,
      antialias: options.antialias ?? true,
      resolution: options.resolution ?? window.devicePixelRatio,
      powerPreference: 'high-performance',
      preference: ['webgpu', 'webgl'],
    });

    this._canvas = this._renderer.canvas as HTMLCanvasElement;
    this._stage = new Container();
  }

  get renderer(): Renderer {
    if (this._renderer === null) throw new Error('RenderSystem not initialized');
    return this._renderer;
  }

  get stage(): Container {
    if (this._stage === null) throw new Error('RenderSystem not initialized');
    return this._stage;
  }

  get canvas(): HTMLCanvasElement {
    if (this._canvas === null) throw new Error('RenderSystem not initialized');
    return this._canvas;
  }

  render(): void {
    if (this._renderer === null || this._stage === null) return;
    this._renderer.render(this._stage);
  }

  resize(width: number, height: number): void {
    this._renderer?.resize(width, height);
  }

  destroy(): void {
    this._renderer?.destroy();
    this._renderer = null;
    this._stage = null;
    this._canvas = null;
  }
}
