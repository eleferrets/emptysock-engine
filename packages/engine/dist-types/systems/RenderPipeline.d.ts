import { Container, Texture } from "pixi.js";
import type { Renderer } from "pixi.js";
import type { Scene } from "../core/Scene.js";
import { type RenderSystemOptions } from "./RenderSystem.js";
import { LayerSystem } from "./LayerSystem.js";
import type { AutoTileSystem } from "./AutoTileSystem.js";
import type { PostProcessSystem } from "./PostProcessSystem.js";
/**
 * The subset of `@emptysock/tilemap`'s `Tilemap` shape that RenderPipeline
 * actually reads. RenderPipeline lives in the core engine and must not
 * depend on the optional `@emptysock/tilemap` module package (§13.1), so it
 * depends on this structural interface instead — `Tilemap` satisfies it
 * without either package importing the other. Only `mountTilemap()`'s
 * caller (game code that already imports `@emptysock/tilemap`) needs both
 * types in scope at once.
 */
export interface TileLayerSource {
  readonly data: {
    readonly tileWidth: number;
    readonly tileHeight: number;
    readonly rows: number;
    readonly cols: number;
    readonly tileset: {
      readonly imagePath: string;
      readonly tileWidth: number;
      readonly tileHeight: number;
      readonly columns: number;
      readonly spacing?: number;
      readonly margin?: number;
    };
    readonly layers: ReadonlyArray<{
      readonly visible: boolean;
      readonly opacity: number;
      readonly cells: ReadonlyArray<
        ReadonlyArray<
          | {
              readonly tileIndex: number;
            }
          | undefined
        >
      >;
    }>;
  };
}
/** Loads (and ideally caches) a texture for a given asset path. Swappable for tests/headless hosts. */
export type TextureLoader = (path: string) => Promise<Texture>;
export interface RenderPipelineOptions extends Omit<
  RenderSystemOptions,
  "layerSystem"
> {
  /** Supply a LayerSystem to share with other code; a fresh one is created otherwise. */
  layers?: LayerSystem;
  /** Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`. */
  textureLoader?: TextureLoader;
}
/**
 * RenderPipeline is the one piece of code a game needs to touch to see
 * something on screen. It owns a RenderSystem (the raw PixiJS renderer) and a
 * LayerSystem (draw order), and on every `renderFrame(scene)` call it:
 *
 *  1. Walks the scene for every entity carrying both `Transform` and
 *     `Sprite`, keeps a PixiJS sprite in sync with it (position, rotation,
 *     scale, tint, alpha, anchor, visibility), loads its texture exactly
 *     once, and places it in the layer/depth the `Sprite` component asks
 *     for — no manual `layerSystem.addEntity()` call required.
 *  2. Draws any tilemap mounted via `mountTilemap()` as real textured tile
 *     sprites (optionally resolved through an `AutoTileSystem`), not just a
 *     walkability grid.
 *  3. Renders the frame.
 *
 * Attaching `Transform` + `Sprite` to an entity is the entire contract for
 * "this shows up on screen" — there is no second, separate step.
 */
export declare class RenderPipeline {
  private readonly _render;
  private readonly _layers;
  private readonly _loadTexture;
  private readonly _pixiSprites;
  private readonly _texturePaths;
  private readonly _textureCache;
  private readonly _sortedLayers;
  private readonly _mountedTilemaps;
  private _tilemapGeneration;
  /** Full-screen graphics used to paint the scene-transition overlay, created lazily. */
  private _transitionOverlay;
  constructor(options?: RenderPipelineOptions);
  init(options?: RenderPipelineOptions): Promise<void>;
  /** The engine's LayerSystem — call `defineLayer()` on it for custom draw order. */
  get layers(): LayerSystem;
  get renderer(): Renderer;
  get stage(): Container;
  get canvas(): HTMLCanvasElement;
  resize(width: number, height: number): void;
  /**
   * Sync every Transform+Sprite entity in `scene` to its PixiJS sprite, then
   * render the frame. Call this once per frame from the game loop, after
   * `SceneManager.update()`.
   */
  renderFrame(scene: Scene, postProcess?: PostProcessSystem): void;
  /**
   * Paint the scene-transition overlay described by `postProcess`'s
   * transitionEffect/transitionProgress/transitionColour on top of the
   * stage. Called automatically from `renderFrame()` when a PostProcessSystem
   * is supplied; callers with a custom render loop can call it directly
   * after `syncEntities()`.
   *
   * - "fade": full-screen colour rect, alpha rises to 1 over the first half
   *   of the transition and falls back to 0 over the second half (a
   *   crossfade through `transitionColour`).
   * - "wipe": a directional reveal — a colour rect that grows from one edge
   *   of the screen to the other as progress advances.
   * - "slide": a colour panel that pushes fully across the screen and off
   *   again, simulating the outgoing/incoming scene sliding — since
   *   RenderPipeline doesn't keep two scenes' worth of sprites live
   *   simultaneously, the panel itself carries the transition motion.
   */
  renderTransitionOverlay(postProcess: PostProcessSystem): void;
  private _ensureTransitionOverlay;
  /** Sync PixiJS sprites from Transform+Sprite components without rendering. Exposed for tests and custom loops. */
  syncEntities(scene: Scene): void;
  private _containerFor;
  private _applyTexture;
  private _removeSprite;
  /**
   * Build real tile sprites for `tilemap` and add them to `renderLayer`
   * (defaults to `"default"`). Pass an `AutoTileSystem` to resolve neighbour-
   * aware tile variants instead of drawing the raw tile indices. Safe to call
   * once per tilemap; call `unmountTilemap()` first to rebuild after edits.
   */
  mountTilemap(
    tilemap: TileLayerSource,
    renderLayer?: string,
    autoTile?: AutoTileSystem,
  ): void;
  unmountTilemap(tilemap: TileLayerSource): void;
  private _buildTilemapSprites;
  destroy(): void;
}
