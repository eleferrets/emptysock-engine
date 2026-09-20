import { Assets } from "pixi.js";
import type { AudioSystem } from "./AudioSystem.js";
import type { TextureLoader } from "./RenderPipeline.js";

export type AssetType = "texture" | "audio" | "json" | "font";

export interface AssetDescriptor {
  /** Unique id used to look up the loaded asset (and, for audio, the AudioSystem sound id). */
  id: string;
  /** Path or URL to load from. */
  path: string;
  type: AssetType;
}

export interface AssetLoadFailure {
  id: string;
  path: string;
  type: AssetType;
  error: unknown;
}

export interface AssetLoadResult {
  loaded: string[];
  failed: AssetLoadFailure[];
}

export type AssetProgressListener = (
  loaded: number,
  total: number,
  current: AssetDescriptor,
) => void;

export interface AssetManifestOptions {
  /**
   * Loader used for "texture" assets. Uses the same `TextureLoader` shape as
   * `RenderPipelineOptions.textureLoader` — pass the exact function you gave
   * RenderPipeline (or nothing, since both default to `Assets.load`) so a
   * texture preloaded here lands in the identical pixi.js `Assets` cache
   * RenderPipeline resolves through, and is instantly available (no
   * redundant fetch) the first time gameplay code renders it.
   */
  textureLoader?: TextureLoader;
  /**
   * AudioSystem to warm for "audio" assets. Calling AudioSystem.load() here
   * registers the Howl under the descriptor's id in AudioSystem's own sound
   * map, so audio.play(id) later hits the same loaded Howl instead of
   * loading a fresh one.
   */
  audioSystem?: AudioSystem;
  /** Injectable fetch implementation, e.g. for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * When true (default), a failed asset is recorded and loading continues
   * with the rest of the manifest. When false, load() rejects on the first
   * failure (still reporting which asset via the thrown AssetLoadFailure).
   */
  continueOnError?: boolean;
}

const defaultTextureLoader: TextureLoader = (path) => Assets.load(path);

/**
 * A declarative list of assets (textures/audio/json/fonts) with progress
 * reporting, so a game can build its own loading screen — the engine
 * intentionally never renders one itself. Loaded assets are cached here by
 * id and, for textures and audio, warm the same underlying caches that
 * RenderSystem and AudioSystem use, so gameplay code that touches them
 * afterwards does not trigger a redundant fetch.
 */
export class AssetManifest {
  private readonly _descriptors: AssetDescriptor[] = [];
  private readonly _cache: Map<string, unknown> = new Map();
  private _failures: AssetLoadFailure[] = [];
  private readonly _listeners: Set<AssetProgressListener> = new Set();

  private readonly _textureLoader: TextureLoader;
  private readonly _audioSystem: AudioSystem | undefined;
  private readonly _fetchImpl: typeof fetch | undefined;
  private readonly _continueOnError: boolean;

  constructor(options: AssetManifestOptions = {}) {
    this._textureLoader = options.textureLoader ?? defaultTextureLoader;
    this._audioSystem = options.audioSystem;
    this._fetchImpl =
      options.fetchImpl ??
      (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);
    this._continueOnError = options.continueOnError ?? true;
  }

  add(descriptor: AssetDescriptor): this {
    this._descriptors.push(descriptor);
    return this;
  }

  addAll(descriptors: AssetDescriptor[]): this {
    for (const d of descriptors) this.add(d);
    return this;
  }

  get total(): number {
    return this._descriptors.length;
  }

  /** Subscribe to progress updates. Returns an unsubscribe function. */
  onProgress(listener: AssetProgressListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  get failures(): readonly AssetLoadFailure[] {
    return this._failures;
  }

  has(id: string): boolean {
    return this._cache.has(id);
  }

  get(id: string): unknown | undefined {
    return this._cache.get(id);
  }

  /**
   * Loads every registered asset in order, reporting progress via
   * onProgress() as each one settles. Per-asset failures are collected in
   * `failures` (and the returned result) rather than rejecting the whole
   * batch, unless `continueOnError` is false, in which case load() rejects
   * with the AssetLoadFailure for the first asset that fails.
   */
  async load(): Promise<AssetLoadResult> {
    this._failures = [];
    const total = this._descriptors.length;
    let loaded = 0;

    for (const descriptor of this._descriptors) {
      try {
        const asset = await this._loadOne(descriptor);
        this._cache.set(descriptor.id, asset);
      } catch (error) {
        const failure: AssetLoadFailure = {
          id: descriptor.id,
          path: descriptor.path,
          type: descriptor.type,
          error,
        };
        if (!this._continueOnError) {
          throw failure;
        }
        this._failures.push(failure);
      }

      loaded++;
      for (const listener of this._listeners)
        listener(loaded, total, descriptor);
    }

    return { loaded: Array.from(this._cache.keys()), failed: this._failures };
  }

  private async _loadOne(descriptor: AssetDescriptor): Promise<unknown> {
    switch (descriptor.type) {
      case "texture":
        return this._textureLoader(descriptor.path);

      case "audio": {
        if (this._audioSystem) {
          return this._audioSystem.load(descriptor.id, descriptor.path);
        }
        throw new Error(
          `AssetManifest: cannot load audio asset "${descriptor.id}" without an AudioSystem (pass { audioSystem } to the constructor)`,
        );
      }

      case "json": {
        if (!this._fetchImpl) {
          throw new Error(
            `AssetManifest: no fetch implementation available to load json asset "${descriptor.id}"`,
          );
        }
        const response = await this._fetchImpl(descriptor.path);
        if (!response.ok) {
          throw new Error(
            `AssetManifest: HTTP ${response.status} loading "${descriptor.path}"`,
          );
        }
        return response.json();
      }

      case "font": {
        if (typeof FontFace === "undefined") {
          throw new Error(
            `AssetManifest: FontFace is unavailable in this environment for asset "${descriptor.id}"`,
          );
        }
        const font = new FontFace(descriptor.id, `url(${descriptor.path})`);
        await font.load();
        if (typeof document !== "undefined") {
          document.fonts.add(font);
        }
        return font;
      }
    }
  }
}
