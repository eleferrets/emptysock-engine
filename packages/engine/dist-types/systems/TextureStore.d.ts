import { type Texture } from "pixi.js";
/** Loads a texture for an asset path. Swappable for tests/headless hosts. */
export type TextureLoader = (path: string) => Promise<Texture>;
export declare class TextureStore {
  private readonly _custom;
  private readonly _local;
  private readonly _inflight;
  constructor(loader?: TextureLoader);
  /** The already-loaded texture for `path`, or `undefined` if not loaded yet. Never starts a load. */
  get(path: string): Texture | undefined;
  /** Loads `path` (or resolves from cache); concurrent calls for one path share one load. */
  load(path: string): Promise<Texture>;
  /** Drops the local cache (custom-loader mode). pixi's global `Assets` cache is not touched. */
  clear(): void;
}
