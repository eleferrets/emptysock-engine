import { Assets, type Texture } from "pixi.js";

/** Loads a texture for an asset path. Swappable for tests/headless hosts. */
export type TextureLoader = (path: string) => Promise<Texture>;

/**
 * The one texture load/lookup path shared by `RenderPipeline` (sprite sync,
 * `draw_sprite`) and `UISystem` (`ImageWidget`). With no custom loader it
 * delegates entirely to pixi's `Assets` cache: `Assets.load` (which itself
 * dedupes concurrent loads of one path) for loading, and a synchronous
 * `Assets.cache.has`/`Assets.get` for "already loaded?" lookups, so no
 * parallel `Map` of textures exists to drift from pixi's own. A custom
 * `TextureLoader` (the test/host seam) keeps a small local cache plus an
 * in-flight map so the same path is still only loaded once.
 */
export class TextureStore {
  private readonly _custom: TextureLoader | undefined;
  private readonly _local = new Map<string, Texture>();
  private readonly _inflight = new Map<string, Promise<Texture>>();

  constructor(loader?: TextureLoader) {
    this._custom = loader;
  }

  /** The already-loaded texture for `path`, or `undefined` if not loaded yet. Never starts a load. */
  get(path: string): Texture | undefined {
    if (this._custom === undefined) {
      return Assets.cache.has(path) ? Assets.get<Texture>(path) : undefined;
    }
    return this._local.get(path);
  }

  /** Loads `path` (or resolves from cache); concurrent calls for one path share one load. */
  load(path: string): Promise<Texture> {
    const hit = this.get(path);
    if (hit !== undefined) return Promise.resolve(hit);
    if (this._custom === undefined) return Assets.load<Texture>(path);
    const pending = this._inflight.get(path);
    if (pending !== undefined) return pending;
    const custom = this._custom;
    const p = custom(path).then(
      (texture) => {
        this._local.set(path, texture);
        this._inflight.delete(path);
        return texture;
      },
      (err: unknown) => {
        this._inflight.delete(path);
        throw err;
      },
    );
    this._inflight.set(path, p);
    return p;
  }

  /** Drops the local cache (custom-loader mode). pixi's global `Assets` cache is not touched. */
  clear(): void {
    this._local.clear();
    this._inflight.clear();
  }
}
