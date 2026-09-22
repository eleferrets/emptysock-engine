import {
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite as PixiSprite,
  Texture,
} from "pixi.js";
import type { Renderer } from "pixi.js";
import type { Scene } from "../core/Scene.js";
import { Sprite } from "../components/Sprite.js";
import { Transform } from "../components/Transform.js";
import { RenderSystem, type RenderSystemOptions } from "./RenderSystem.js";
import { LayerSystem } from "./LayerSystem.js";
import type { PostProcessSystem } from "./PostProcessSystem.js";

/**
 * The minimal shape `mountTilemap()` needs from an auto-tile resolver —
 * just the one `resolve()` method it actually calls. `@emptysock/tilemap`'s
 * `AutoTileSystem` satisfies this without either package importing the
 * other, the same "engine depends on the interface, never a concrete
 * implementation" pattern as `TileLayerSource`/`Tilemap` (see CLAUDE.md).
 * `AutoTileSystem` itself moved to `@emptysock/tilemap` (RELEASE_PASS.md
 * Track 2) since it's pure tile-authoring logic with zero rendering/ECS
 * coupling, matching the precedent that already put `NavMeshSystem` there.
 */
export interface AutoTileResolver {
  resolve(
    col: number,
    row: number,
    baseTileIndex: number,
    tileAt: (col: number, row: number) => number,
  ): number;
}

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
        ReadonlyArray<{ readonly tileIndex: number } | undefined>
      >;
    }>;
  };
}

/** Loads (and ideally caches) a texture for a given asset path. Swappable for tests/headless hosts. */
export type TextureLoader = (path: string) => Promise<Texture>;

const defaultTextureLoader: TextureLoader = (path) => Assets.load(path);

export interface RenderPipelineOptions extends Omit<
  RenderSystemOptions,
  "layerSystem"
> {
  /** Supply a LayerSystem to share with other code; a fresh one is created otherwise. */
  layers?: LayerSystem;
  /** Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`. */
  textureLoader?: TextureLoader;
}

interface MountedTilemap {
  container: Container;
  generation: number;
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
 *     sprites (optionally resolved through an `AutoTileResolver`), not just a
 *     walkability grid.
 *  3. Renders the frame.
 *
 * Attaching `Transform` + `Sprite` to an entity is the entire contract for
 * "this shows up on screen" — there is no second, separate step.
 */
export class RenderPipeline {
  private readonly _render: RenderSystem = new RenderSystem();
  private readonly _layers: LayerSystem;
  private readonly _loadTexture: TextureLoader;

  private readonly _pixiSprites: Map<number, PixiSprite> = new Map();
  private readonly _texturePaths: Map<number, string> = new Map();
  private readonly _textureCache: Map<string, Texture> = new Map();
  private readonly _sortedLayers: Set<string> = new Set();

  private readonly _mountedTilemaps: Map<TileLayerSource, MountedTilemap> =
    new Map();
  private _tilemapGeneration = 0;

  /** Full-screen graphics used to paint the scene-transition overlay, created lazily. */
  private _transitionOverlay: Graphics | null = null;

  constructor(options: RenderPipelineOptions = {}) {
    this._layers = options.layers ?? new LayerSystem();
    this._loadTexture = options.textureLoader ?? defaultTextureLoader;
  }

  async init(options: RenderPipelineOptions = {}): Promise<void> {
    await this._render.init({ ...options, layerSystem: this._layers });
  }

  /** The engine's LayerSystem — call `defineLayer()` on it for custom draw order. */
  get layers(): LayerSystem {
    return this._layers;
  }

  get renderer(): Renderer {
    return this._render.renderer;
  }

  get stage(): Container {
    return this._render.stage;
  }

  get canvas(): HTMLCanvasElement {
    return this._render.canvas;
  }

  resize(width: number, height: number): void {
    this._render.resize(width, height);
  }

  // ─── Sprites ─────────────────────────────────────────────────────────────

  /**
   * Sync every Transform+Sprite entity in `scene` to its PixiJS sprite, then
   * render the frame. Call this once per frame from the game loop, after
   * `SceneManager.update()`.
   */
  renderFrame(scene: Scene, postProcess?: PostProcessSystem): void {
    this.syncEntities(scene);
    if (postProcess !== undefined) {
      this._render.syncPostProcessLayerFilters(postProcess);
      this.renderTransitionOverlay(postProcess);
    }
    this._render.render();
  }

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
  renderTransitionOverlay(postProcess: PostProcessSystem): void {
    if (!postProcess.transitionActive) {
      if (this._transitionOverlay !== null) {
        this._transitionOverlay.visible = false;
      }
      return;
    }

    const overlay = this._ensureTransitionOverlay();
    overlay.visible = true;
    overlay.clear();

    const w = this._render.canvas.width;
    const h = this._render.canvas.height;
    const colour = postProcess.transitionColour;
    const progress = postProcess.transitionProgress; // 0..1 across the whole transition

    switch (postProcess.transitionEffect) {
      case "fade": {
        // Triangle wave: 0 -> 1 at the midpoint -> 0 at the end.
        const alpha =
          progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5;
        overlay.rect(0, 0, w, h).fill({ color: colour, alpha });
        break;
      }
      case "wipe": {
        // Grows left-to-right across the whole transition, covering the cut
        // at the midpoint, then continues off to fully reveal the new scene.
        const width = w * progress;
        overlay.rect(0, 0, width, h).fill({ color: colour, alpha: 1 });
        break;
      }
      case "slide": {
        // A full-screen panel travels left-to-right across the screen once.
        const x = -w + w * 2 * progress;
        overlay.rect(x, 0, w, h).fill({ color: colour, alpha: 1 });
        break;
      }
      default:
        overlay.visible = false;
        break;
    }
  }

  private _ensureTransitionOverlay(): Graphics {
    if (this._transitionOverlay === null) {
      this._transitionOverlay = new Graphics();
      this._transitionOverlay.zIndex = Number.MAX_SAFE_INTEGER;
      this._render.stage.addChild(this._transitionOverlay);
      this._render.stage.sortableChildren = true;
    }
    return this._transitionOverlay;
  }

  /** Sync PixiJS sprites from Transform+Sprite components without rendering. Exposed for tests and custom loops. */
  syncEntities(scene: Scene): void {
    const seen = new Set<number>();

    for (const entity of scene.getEntities().values()) {
      const transform = entity.getComponent(Transform.TYPE);
      const sprite = entity.getComponent(Sprite.TYPE);
      if (transform === undefined || sprite === undefined) continue;

      seen.add(entity.id);
      let pixiSprite = this._pixiSprites.get(entity.id);
      if (pixiSprite === undefined) {
        pixiSprite = new PixiSprite(Texture.EMPTY);
        this._pixiSprites.set(entity.id, pixiSprite);
        entity.once("destroy", () => this._removeSprite(entity.id));
      }

      if (this._texturePaths.get(entity.id) !== sprite.texturePath) {
        this._texturePaths.set(entity.id, sprite.texturePath);
        this._applyTexture(entity.id, pixiSprite, sprite.texturePath);
      }

      const container = this._containerFor(sprite.layer);
      if (pixiSprite.parent !== container) container.addChild(pixiSprite);

      pixiSprite.x = transform.x;
      pixiSprite.y = transform.y;
      pixiSprite.rotation = transform.rotation;
      pixiSprite.scale.set(transform.scaleX, transform.scaleY);
      pixiSprite.tint = sprite.tint;
      pixiSprite.alpha = sprite.alpha;
      pixiSprite.visible = sprite.visible;
      pixiSprite.anchor.set(sprite.anchorX, sprite.anchorY);
      pixiSprite.zIndex = sprite.depth;

      this._layers.addEntity(entity.id, sprite.layer, sprite.depth);
    }

    for (const id of this._pixiSprites.keys()) {
      if (!seen.has(id)) this._removeSprite(id);
    }
  }

  private _containerFor(layerName: string): Container {
    const container = this._render.getLayerContainer(layerName);
    if (!this._sortedLayers.has(layerName)) {
      container.sortableChildren = true;
      this._sortedLayers.add(layerName);
    }
    return container;
  }

  private _applyTexture(
    entityId: number,
    pixiSprite: PixiSprite,
    path: string,
  ): void {
    if (path === "") {
      pixiSprite.texture = Texture.WHITE;
      return;
    }
    const cached = this._textureCache.get(path);
    if (cached !== undefined) {
      pixiSprite.texture = cached;
      return;
    }
    this._loadTexture(path)
      .then((texture) => {
        this._textureCache.set(path, texture);
        // The entity may have been destroyed, or asked for a different
        // texture, by the time the load resolves; only apply if it's stale.
        if (this._texturePaths.get(entityId) === path) {
          pixiSprite.texture = texture;
        }
      })
      .catch((err: unknown) => {
        console.error(
          `[RenderPipeline] failed to load texture "${path}":`,
          err,
        );
      });
  }

  private _removeSprite(entityId: number): void {
    const pixiSprite = this._pixiSprites.get(entityId);
    if (pixiSprite === undefined) return;
    pixiSprite.parent?.removeChild(pixiSprite);
    pixiSprite.destroy();
    this._pixiSprites.delete(entityId);
    this._texturePaths.delete(entityId);
    this._layers.removeEntity(entityId);
  }

  // ─── Tilemaps ────────────────────────────────────────────────────────────

  /**
   * Build real tile sprites for `tilemap` and add them to `renderLayer`
   * (defaults to `"default"`). Pass an `AutoTileResolver` to resolve neighbour-
   * aware tile variants instead of drawing the raw tile indices. Safe to call
   * once per tilemap; call `unmountTilemap()` first to rebuild after edits.
   */
  mountTilemap(
    tilemap: TileLayerSource,
    renderLayer = "default",
    autoTile?: AutoTileResolver,
  ): void {
    if (this._mountedTilemaps.has(tilemap)) return;
    const container = new Container();
    const generation = ++this._tilemapGeneration;
    this._mountedTilemaps.set(tilemap, { container, generation });
    this._containerFor(renderLayer).addChild(container);
    void this._buildTilemapSprites(tilemap, container, generation, autoTile);
  }

  unmountTilemap(tilemap: TileLayerSource): void {
    const mounted = this._mountedTilemaps.get(tilemap);
    if (mounted === undefined) return;
    mounted.container.parent?.removeChild(mounted.container);
    mounted.container.destroy({ children: true });
    this._mountedTilemaps.delete(tilemap);
  }

  private async _buildTilemapSprites(
    tilemap: TileLayerSource,
    container: Container,
    generation: number,
    autoTile: AutoTileResolver | undefined,
  ): Promise<void> {
    const { tileset, rows, cols, tileWidth, tileHeight } = tilemap.data;
    let baseTexture: Texture;
    try {
      baseTexture = await this._loadTexture(tileset.imagePath);
    } catch (err) {
      console.error(
        `[RenderPipeline] failed to load tileset "${tileset.imagePath}":`,
        err,
      );
      return;
    }
    // Tilemap was unmounted (or remounted) before the tileset finished loading.
    if (this._mountedTilemaps.get(tilemap)?.generation !== generation) return;

    const spacing = tileset.spacing ?? 0;
    const margin = tileset.margin ?? 0;
    const frameCache = new Map<number, Texture>();

    const frameFor = (tileIndex: number): Texture => {
      let frame = frameCache.get(tileIndex);
      if (frame !== undefined) return frame;
      const sx =
        margin + (tileIndex % tileset.columns) * (tileset.tileWidth + spacing);
      const sy =
        margin +
        Math.floor(tileIndex / tileset.columns) *
          (tileset.tileHeight + spacing);
      frame = new Texture({
        source: baseTexture.source,
        frame: new Rectangle(sx, sy, tileset.tileWidth, tileset.tileHeight),
      });
      frameCache.set(tileIndex, frame);
      return frame;
    };

    for (const layer of tilemap.data.layers) {
      if (!layer.visible) continue;
      const tileAt = (c: number, r: number): number =>
        layer.cells[r]?.[c]?.tileIndex ?? -1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cell = layer.cells[row]?.[col];
          if (cell === undefined || cell.tileIndex < 0) continue;

          const tileIndex =
            autoTile !== undefined
              ? autoTile.resolve(col, row, cell.tileIndex, tileAt)
              : cell.tileIndex;

          const tileSprite = new PixiSprite(frameFor(tileIndex));
          tileSprite.x = col * tileWidth;
          tileSprite.y = row * tileHeight;
          tileSprite.alpha = layer.opacity;
          container.addChild(tileSprite);
        }
      }
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  destroy(): void {
    for (const tilemap of Array.from(this._mountedTilemaps.keys())) {
      this.unmountTilemap(tilemap);
    }
    for (const id of Array.from(this._pixiSprites.keys())) {
      this._removeSprite(id);
    }
    this._textureCache.clear();
    this._transitionOverlay?.destroy();
    this._transitionOverlay = null;
    this._render.destroy();
    this._layers.destroy();
  }
}
