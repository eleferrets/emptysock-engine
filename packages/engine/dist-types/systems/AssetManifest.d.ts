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
/**
 * A declarative list of assets (textures/audio/json/fonts) with progress
 * reporting, so a game can build its own loading screen — the engine
 * intentionally never renders one itself. Loaded assets are cached here by
 * id and, for textures and audio, warm the same underlying caches that
 * RenderSystem and AudioSystem use, so gameplay code that touches them
 * afterwards does not trigger a redundant fetch.
 */
export declare class AssetManifest {
  private readonly _descriptors;
  private readonly _cache;
  private _failures;
  private readonly _listeners;
  private readonly _textureLoader;
  private readonly _audioSystem;
  private readonly _fetchImpl;
  private readonly _continueOnError;
  constructor(options?: AssetManifestOptions);
  add(descriptor: AssetDescriptor): this;
  addAll(descriptors: AssetDescriptor[]): this;
  get total(): number;
  /** Subscribe to progress updates. Returns an unsubscribe function. */
  onProgress(listener: AssetProgressListener): () => void;
  get failures(): readonly AssetLoadFailure[];
  has(id: string): boolean;
  get(id: string): unknown | undefined;
  /**
   * Loads every registered asset in order, reporting progress via
   * onProgress() as each one settles. Per-asset failures are collected in
   * `failures` (and the returned result) rather than rejecting the whole
   * batch, unless `continueOnError` is false, in which case load() rejects
   * with the AssetLoadFailure for the first asset that fails.
   */
  load(): Promise<AssetLoadResult>;
  private _loadOne;
}
