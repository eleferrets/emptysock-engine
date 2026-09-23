import {
  Assets,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite as PixiSprite,
  Texture,
} from "pixi.js";
import type { Renderer } from "pixi.js";
import type { Scene } from "../Scene.js";
import type { SceneRenderer } from "../Game.js";
import { Sprite } from "../components/Sprite.js";
import { Transform } from "../components/Transform.js";
import { RenderSystem, type RenderSystemOptions } from "./RenderSystem.js";
import { LayerSystem } from "./LayerSystem.js";
import type { PostProcessSystem } from "./PostProcessSystem.js";
import type { ParticleEmitter } from "./ParticleSystem.js";
import { getOrCreateMapEntry } from "../internal/scoped.js";

/**
 * The minimal shape `mountTilemap()` needs from an auto-tile resolver — just
 * the one `resolve()` method it actually calls. `@emptysock/tilemap`'s
 * `AutoTileSystem` satisfies this without either package importing the
 * other, the same "engine depends on the interface, never a concrete
 * implementation" pattern as `TileLayerSource`/`Tilemap` below.
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
 * The subset of `@emptysock/tilemap`'s `Tilemap` shape that `RenderPipeline`
 * actually reads. `RenderPipeline` lives in the core engine and must not
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

/** Per-scene bookkeeping for the sprites `RenderPipeline` is tracking on that scene's behalf. */
interface SceneTracking {
  /** entity eid -> its PixiJS sprite. */
  sprites: Map<number, PixiSprite>;
  /** entity eid -> the texturePath last applied, so we only reload on change. */
  texturePaths: Map<number, string>;
}

function createTracking(): SceneTracking {
  return { sprites: new Map(), texturePaths: new Map() };
}

interface MountedTilemap {
  container: Container;
  generation: number;
}

/**
 * Built on the `defineComponent`/`Scene.each` object model, and `Game`'s
 * `SceneRenderer` shape (ENGINE_DESIGN.md §4 step 7 / §12.3). Uses
 * `RenderSystem` (the raw PixiJS wrapper) and `LayerSystem` (layer-level
 * ordering/visibility, via `RenderSystem`'s `getLayerContainer`/
 * `syncLayerVisibility`).
 *
 * **On PixiJS's native Render Layers (RELEASE_PASS.md Track 2), reversed
 * after auditing the actual code:** the original plan called for rebuilding
 * `LayerSystem` on PixiJS v8.7+'s `RenderLayer` API instead of the current
 * per-layer-`Container` approach. Auditing `RenderSystem.ts` first shows why
 * that doesn't help here: `RenderLayer.attach()` requires the attached
 * object to already have a real `Container` parent elsewhere for
 * transforms, and throws on `addChild()` itself — but this renderer already
 * writes sprites' `x`/`y` in absolute coordinates directly onto the sprite
 * (no nested world-transform hierarchy `RenderLayer` would decouple draw
 * order from), and `getLayerContainer(name)`'s callers already do
 * `container.addChild(pixiSprite)` directly. Swapping to `RenderLayer`
 * would mean reworking `RenderSystem`'s shared public API for a decoupling
 * this flat architecture has no actual use for. The one real bug the
 * original plan was chasing — `LayerSystem`'s per-entity placement map
 * (`addEntity`/`removeEntity`/`getEntityLayer`/`getEntityDepth`) being
 * raw-eid-keyed with no scene scoping — turned out to have zero real
 * readers anywhere in the codebase (confirmed by grep:
 * `getEntityLayer`/`getEntityDepth`/`getEntitiesOnLayer` are called
 * nowhere) — it was writing per-frame bookkeeping data that got read by
 * nothing, not a scoping bug actively corrupting real behavior. This class
 * no longer calls `addEntity`/`removeEntity` at all (dead write removed);
 * the layer-*level* concepts `LayerSystem` still provides (name →
 * index/visibility) remain real and unchanged, since `RenderSystem`
 * genuinely needs those for stage ordering and `syncLayerVisibility()`.
 *
 * On `renderFrame(main, overlays)` it:
 *
 *  1. Walks `main` for every `Transform`+`Sprite` entity via `scene.each` (the
 *     bulk-iteration path, ENGINE_DESIGN.md §21 — no per-entity Proxy
 *     overhead), keeps a PixiJS sprite in sync with it, and places it on
 *     `layer`/`depth`.
 *  2. Does the same for each overlay `Scene`, but into a dedicated container
 *     appended to the stage *after* the main scene's layer containers — Pixi
 *     draws children in `addChild` order, so later-appended containers paint
 *     on top. Overlays are synced in the array's order, i.e. call order
 *     (ENGINE_DESIGN.md §12.3), so the most recently `loadOverlay()`-ed scene
 *     ends up topmost.
 *  3. Renders the frame.
 *
 * **Multiple live scenes and entity id collisions**: every `Scene` owns its
 * own bitECS `World`, and each `World`'s entity ids independently start from
 * 0 (see `Scene.ts`). A `Game` with a main scene plus one or more overlays
 * therefore has several *different* entities that all report `eid === 3`.
 * Tracking sprites in one flat `Map<number, PixiSprite>` would silently
 * alias an overlay's entity 3 onto the main scene's. This class instead keys
 * its sprite/texture-path tracking per `Scene` (`Map<Scene, SceneTracking>`)
 * — one level of scoping up from `ComponentRegistry`'s per-`World` scoping
 * and `PhysicsBody`'s per-`World` callback side-table (`ecs/components/PhysicsBody.ts`),
 * but the same underlying idea: never index directly by a raw entity id
 * without first scoping by which scene's world it belongs to.
 *
 * That per-`Scene` scoping covers the *main* scene too, not just overlays:
 * `Game.unloadScene()`/`loadScene()` swap in a brand new `Scene` (a new
 * bitECS `World`, entity ids starting at 0 again), so a single flat
 * `_mainTracking` object reused across that swap would alias the old
 * scene's leftover Pixi sprites onto the new scene's same-numbered
 * entities, and leave the old sprites themselves never destroyed. `_syncMain`
 * tracks which `Scene` its tracking currently belongs to (`_mainScene`) and,
 * the moment a *different* `Scene` object is passed in, fully disposes the
 * previous one's tracking (`_releaseMain`, sharing the exact same per-sprite
 * teardown `releaseOverlay`/`_pruneOverlays` already use for overlays)
 * before starting fresh — main-scene tracking and overlay tracking now share
 * one underlying `Map<Scene, SceneTracking>`.
 */
export class RenderPipeline implements SceneRenderer {
  private readonly _render: RenderSystem = new RenderSystem();
  private readonly _layers: LayerSystem;
  private readonly _loadTexture: TextureLoader;

  /** Shared by the main scene and every overlay — see the class doc comment above. */
  private readonly _tracking = new Map<Scene, SceneTracking>();
  private _mainScene: Scene | null = null;
  private readonly _overlayContainers = new Map<Scene, Container>();
  private readonly _textureCache = new Map<string, Texture>();
  private readonly _sortedLayers = new Set<string>();

  /**
   * Set via `attachPostProcess()`. When present, `renderFrame()` calls
   * `RenderSystem.syncPostProcessLayerFilters()` each frame so
   * `PostProcessSystem.setLayerFilter()`'s real pixi filters
   * (`BlurFilter`/`ColorMatrixFilter`/`pixi-filters`' `OutlineFilter`, per
   * RELEASE_PASS.md Track 2) stay in sync with the layer containers this
   * pipeline owns. Not constructor-only, since a game may not have a
   * `PostProcessSystem` instance yet when the pipeline is constructed.
   */
  private _postProcess: PostProcessSystem | null = null;

  /**
   * RELEASE_PASS.md Track 4's real gap: `ParticleEmitter` is already a
   * pure, renderer-agnostic simulation (see `systems/ParticleSystem.ts`'s
   * own doc comment) with zero pixi dependency — it was never actually
   * wired into gameplay rendering, only the IDE's canvas-based preview
   * editor. `mountParticles()`/`unmountParticles()` are that missing wire:
   * one pixi core `ParticleContainer` per mounted emitter (no new
   * dependency — `ParticleContainer`/`Particle` are core pixi.js exports),
   * resynced every `renderFrame()` from `ParticleEmitter.getParticles()`.
   */
  private readonly _particleContainers = new Map<
    ParticleEmitter,
    ParticleContainer
  >();
  private readonly _particleTextures = new Map<ParticleEmitter, Texture>();

  /** Tilemap tile sprites, mounted via `mountTilemap()` — see that method's doc comment. */
  private readonly _mountedTilemaps = new Map<
    TileLayerSource,
    MountedTilemap
  >();
  private _tilemapGeneration = 0;

  /** Full-screen graphics used to paint the scene-transition overlay, created lazily. */
  private _transitionOverlay: Graphics | null = null;

  constructor(options: RenderPipelineOptions = {}) {
    this._layers = options.layers ?? new LayerSystem();
    this._loadTexture = options.textureLoader ?? defaultTextureLoader;
  }

  /** Attach (or detach, with `null`) the `PostProcessSystem` whose layer filters `renderFrame()` should keep synced onto this pipeline's layer containers. */
  attachPostProcess(postProcess: PostProcessSystem | null): void {
    this._postProcess = postProcess;
  }

  /**
   * Mounts `emitter`'s particles into a real pixi `ParticleContainer` on
   * layer `layerName`, resynced every `renderFrame()`. Loads the emitter's
   * `options.texture` path through this pipeline's own texture loader (the
   * same cache-and-load path sprites use) — an emitter with no texture set
   * falls back to `Texture.WHITE`, a plain filled square, so an emitter
   * mounted before its real texture is ready still renders something
   * visible rather than nothing. Awaiting this before the emitter starts
   * producing particles is recommended but not required — particles that
   * exist before the texture resolves simply aren't drawn yet.
   */
  async mountParticles(
    emitter: ParticleEmitter,
    layerName = "default",
  ): Promise<void> {
    if (this._particleContainers.has(emitter)) return;
    const texturePath = emitter.options.texture;
    const texture =
      texturePath.length > 0
        ? await this._loadTexture(texturePath)
        : Texture.WHITE;
    const container = new ParticleContainer({
      dynamicProperties: {
        position: true,
        rotation: true,
        scale: true,
        color: true,
      },
    });
    this._render.getLayerContainer(layerName).addChild(container);
    this._particleContainers.set(emitter, container);
    this._particleTextures.set(emitter, texture);
  }

  /** Detaches and destroys `emitter`'s mounted `ParticleContainer`. Safe to call on an emitter that was never mounted (a no-op). */
  unmountParticles(emitter: ParticleEmitter): void {
    const container = this._particleContainers.get(emitter);
    if (container === undefined) return;
    container.destroy({ children: true });
    this._particleContainers.delete(emitter);
    this._particleTextures.delete(emitter);
  }

  private _syncParticles(): void {
    for (const [emitter, container] of this._particleContainers) {
      container.removeParticles();
      const texture = this._particleTextures.get(emitter) ?? Texture.WHITE;
      for (const p of emitter.getParticles()) {
        if (!p.active) continue;
        container.addParticle(
          new Particle({
            texture,
            x: p.x,
            y: p.y,
            scaleX: p.scale,
            scaleY: p.scale,
            rotation: p.rotation,
            anchorX: 0.5,
            anchorY: 0.5,
            tint: p.colour,
            alpha: p.alpha,
          }),
        );
      }
    }
  }

  /**
   * Constructs the real PixiJS renderer (WebGL by default — ENGINE_DESIGN.md
   * §18's audit finding: "Pixi's own guidance is still to prefer WebGL for
   * production"; `RenderSystem.init()` already passes
   * `preference: ["webgpu", "webgl"]` to `autoDetectRenderer`, i.e. it tries
   * WebGPU first and falls back, so WebGPU stays available as an explicit
   * opt-in on hosts that force it — nothing here changes that). Needs a real
   * DOM/canvas environment; never call this under the headless testing
   * harness (`createHeadlessGame()` never attaches a `RenderPipeline` at
   * all — see `Game.attachRenderer`/`ecs/Game.ts` step 7 — so game code
   * driven purely through `testing/index.ts` never reaches this call).
   */
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

  /**
   * `Game.update()` step 7's entry point (via `Game.attachRenderer(this)` —
   * this method is what makes `RenderPipeline` satisfy `SceneRenderer`
   * structurally). Syncs the main scene, then every overlay in call order,
   * releases tracking for any overlay no longer present in `overlays`, and
   * renders once.
   */
  renderFrame(main: Scene, overlays: readonly Scene[] = []): void {
    this._syncMain(main);
    for (const overlay of overlays) this._syncOverlay(overlay);
    this._pruneOverlays(overlays);
    if (this._postProcess !== null) {
      this._render.syncPostProcessLayerFilters(this._postProcess);
      this.renderTransitionOverlay(this._postProcess);
    }
    this._syncParticles();
    this._render.render();
  }

  /**
   * Paints the scene-transition overlay described by `postProcess`'s
   * `transitionEffect`/`transitionProgress`/`transitionColour` on top of
   * the stage — an overlay-based approach (a single colour rect, never two
   * live scenes rendered simultaneously). RELEASE_PASS.md
   * Track 6 / ground rule 11 confirmed a true two-scene crossfade is
   * technically buildable (`renderer.render({ target: renderTexture,
   * container })`, pixi v8's real object-form API) but deliberately did
   * **not** build it in this pass: it's a genuine two-full-render-pass-per-
   * frame cost during the transition window with no documented perf number
   * from pixi's own docs, and the honest way to decide "default-on vs.
   * opt-in" is profiling on real target devices (including lower-end
   * tablets, per the mobile/tablet scope) — not something a headless CI
   * sandbox can do. Shipping an unvalidated perf-risk rendering path
   * without being able to verify its cost would be worse than keeping the
   * proven, cheap overlay approach. Revisit once real device profiling is
   * actually possible.
   */
  renderTransitionOverlay(postProcess: PostProcessSystem): void {
    if (!postProcess.transitionActive) {
      if (this._transitionOverlay !== null)
        this._transitionOverlay.visible = false;
      return;
    }

    const overlay = this._ensureTransitionOverlay();
    overlay.visible = true;
    overlay.clear();

    const w = this._render.canvas.width;
    const h = this._render.canvas.height;
    const colour = postProcess.transitionColour;
    const progress = postProcess.transitionProgress;

    switch (postProcess.transitionEffect) {
      case "fade": {
        const alpha =
          progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5;
        overlay.rect(0, 0, w, h).fill({ color: colour, alpha });
        break;
      }
      case "wipe": {
        const width = w * progress;
        overlay.rect(0, 0, width, h).fill({ color: colour, alpha: 1 });
        break;
      }
      case "slide": {
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

  /** Sync the main scene's PixiJS sprites without rendering. Exposed for tests/custom loops. */
  syncEntities(scene: Scene): void {
    this._syncMain(scene);
  }

  private _syncMain(scene: Scene): void {
    // A different `Scene` object than last call means `Game.loadScene()`
    // swapped in a fresh scene/world — the previous one's tracked sprites
    // must be fully torn down now, not merged into or overwritten by the
    // new scene's same-numbered entities. See the class doc comment.
    if (this._mainScene !== null && this._mainScene !== scene) {
      this._releaseMain();
    }
    this._mainScene = scene;

    const tracking = getOrCreateMapEntry(this._tracking, scene, createTracking);
    const seen = new Set<number>();
    scene.each(Transform, Sprite, (transform, sprite, entity) => {
      seen.add(entity.eid);
      this._syncOne(tracking, entity.eid, transform, sprite, (layer) =>
        this._containerFor(layer),
      );
    });
    for (const id of tracking.sprites.keys()) {
      if (!seen.has(id)) this._removeSprite(tracking, id);
    }
  }

  /** Fully tear down the current main scene's tracking — same per-sprite teardown `releaseOverlay` uses. */
  private _releaseMain(): void {
    const scene = this._mainScene;
    if (scene === null) return;
    const tracking = this._tracking.get(scene);
    if (tracking !== undefined) {
      for (const id of Array.from(tracking.sprites.keys())) {
        this._removeSprite(tracking, id);
      }
      this._tracking.delete(scene);
    }
    this._mainScene = null;
  }

  private _syncOverlay(scene: Scene): void {
    const tracking = getOrCreateMapEntry(this._tracking, scene, createTracking);
    const container = this._overlayContainer(scene);

    const seen = new Set<number>();
    scene.each(Transform, Sprite, (transform, sprite, entity) => {
      seen.add(entity.eid);
      this._syncOne(tracking, entity.eid, transform, sprite, () => container);
    });
    for (const id of tracking.sprites.keys()) {
      if (!seen.has(id)) this._removeSprite(tracking, id);
    }
  }

  private _syncOne(
    tracking: SceneTracking,
    eid: number,
    transform: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    },
    sprite: {
      texturePath: string;
      tint: number;
      alpha: number;
      anchorX: number;
      anchorY: number;
      layer: string;
      depth: number;
      visible: boolean;
    },
    containerFor: (layer: string) => Container,
  ): void {
    let pixiSprite = tracking.sprites.get(eid);
    if (pixiSprite === undefined) {
      pixiSprite = new PixiSprite(Texture.EMPTY);
      tracking.sprites.set(eid, pixiSprite);
    }

    if (tracking.texturePaths.get(eid) !== sprite.texturePath) {
      tracking.texturePaths.set(eid, sprite.texturePath);
      this._applyTexture(tracking, eid, pixiSprite, sprite.texturePath);
    }

    const container = containerFor(sprite.layer);
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
  }

  // ─── Tilemaps ────────────────────────────────────────────────────────────

  /**
   * Build real tile sprites for `tilemap` and add them to `renderLayer`
   * (defaults to `"default"`). Pass an `AutoTileResolver` to resolve
   * neighbour-aware tile variants instead of drawing the raw tile indices.
   * Safe to call once per tilemap; call `unmountTilemap()` first to rebuild
   * after edits.
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

  private _containerFor(layerName: string): Container {
    const container = this._render.getLayerContainer(layerName);
    if (!this._sortedLayers.has(layerName)) {
      container.sortableChildren = true;
      this._sortedLayers.add(layerName);
    }
    return container;
  }

  private _overlayContainer(scene: Scene): Container {
    let container = this._overlayContainers.get(scene);
    if (container === undefined) {
      container = new Container();
      container.sortableChildren = true;
      this._overlayContainers.set(scene, container);
      // Appended after every existing stage child (the main scene's layer
      // containers included), so Pixi paints it last — on top.
      this._render.stage.addChild(container);
    }
    return container;
  }

  private _applyTexture(
    tracking: SceneTracking,
    eid: number,
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
        // The entity may have lost its Sprite, been destroyed, or asked for
        // a different texture, by the time the load resolves; only apply if
        // still current for this (tracking, eid) pair.
        if (tracking.texturePaths.get(eid) === path) {
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

  private _removeSprite(tracking: SceneTracking, eid: number): void {
    const pixiSprite = tracking.sprites.get(eid);
    if (pixiSprite === undefined) return;
    pixiSprite.parent?.removeChild(pixiSprite);
    pixiSprite.destroy();
    tracking.sprites.delete(eid);
    tracking.texturePaths.delete(eid);
  }

  /**
   * Drop tracking (and destroy sprites) for any overlay scene not present in
   * `active` — called every `renderFrame()` with the caller's current
   * overlay list, so an unloaded overlay's leftover sprites don't linger
   * until the next mismatched sync. `Game.unloadOverlay()` doesn't need to
   * know this class exists at all; this runs the cleanup lazily on the very
   * next `renderFrame()` after the overlay stops appearing in `overlays`.
   */
  private _pruneOverlays(active: readonly Scene[]): void {
    if (this._overlayContainers.size === 0) return;
    const activeSet = new Set(active);
    for (const scene of Array.from(this._overlayContainers.keys())) {
      if (!activeSet.has(scene)) this.releaseOverlay(scene);
    }
  }

  /** Explicitly release an overlay's tracking/container — safe to call even if `renderFrame` would have pruned it anyway. */
  releaseOverlay(scene: Scene): void {
    const tracking = this._tracking.get(scene);
    if (tracking !== undefined) {
      for (const id of Array.from(tracking.sprites.keys())) {
        this._removeSprite(tracking, id);
      }
      this._tracking.delete(scene);
    }
    const container = this._overlayContainers.get(scene);
    if (container !== undefined) {
      container.parent?.removeChild(container);
      container.destroy({ children: true });
      this._overlayContainers.delete(scene);
    }
  }

  destroy(): void {
    this._releaseMain();
    for (const scene of Array.from(this._overlayContainers.keys())) {
      this.releaseOverlay(scene);
    }
    for (const emitter of Array.from(this._particleContainers.keys())) {
      this.unmountParticles(emitter);
    }
    for (const tilemap of Array.from(this._mountedTilemaps.keys())) {
      this.unmountTilemap(tilemap);
    }
    this._textureCache.clear();
    this._transitionOverlay?.destroy();
    this._transitionOverlay = null;
    this._render.destroy();
    this._layers.destroy();
  }
}
