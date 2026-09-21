import { Assets, Container, Sprite as PixiSprite, Texture } from "pixi.js";
import type { Renderer } from "pixi.js";
import type { Scene } from "../Scene.js";
import type { SceneRenderer } from "../Game.js";
import { Sprite } from "../components/Sprite.js";
import { Transform } from "../components/Transform.js";
import {
  RenderSystem,
  type RenderSystemOptions,
} from "../../systems/RenderSystem.js";
import { LayerSystem } from "../../systems/LayerSystem.js";

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

/**
 * v2 port of `../../systems/RenderPipeline.ts` onto the `defineComponent`/
 * `Scene.each` object model, and `Game`'s `SceneRenderer` shape (ENGINE_DESIGN.md
 * §4 step 7 / §12.3). Reuses v1's `RenderSystem` (the raw PixiJS wrapper) and
 * `LayerSystem` (draw order) unchanged — neither imports v1's `core/Entity.ts`/
 * `Scene.ts`, so there was nothing v2-incompatible about them to begin with.
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
 * Tracking sprites in one flat `Map<number, PixiSprite>` (what v1's single-
 * scene `RenderPipeline` did, and all it ever needed to do) would silently
 * alias an overlay's entity 3 onto the main scene's. This class instead keys
 * its sprite/texture-path tracking per `Scene` (`Map<Scene, SceneTracking>`)
 * — one level of scoping up from `ComponentRegistry`'s per-`World` scoping
 * and `PhysicsBody`'s per-`World` callback side-table (`v2/components/PhysicsBody.ts`),
 * but the same underlying idea: never index directly by a raw entity id
 * without first scoping by which scene's world it belongs to.
 */
export class RenderPipeline implements SceneRenderer {
  private readonly _render: RenderSystem = new RenderSystem();
  private readonly _layers: LayerSystem;
  private readonly _loadTexture: TextureLoader;

  private readonly _mainTracking: SceneTracking = createTracking();
  private readonly _overlayTracking = new Map<Scene, SceneTracking>();
  private readonly _overlayContainers = new Map<Scene, Container>();
  private readonly _textureCache = new Map<string, Texture>();
  private readonly _sortedLayers = new Set<string>();

  constructor(options: RenderPipelineOptions = {}) {
    this._layers = options.layers ?? new LayerSystem();
    this._loadTexture = options.textureLoader ?? defaultTextureLoader;
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
   * all — see `Game.attachRenderer`/`v2/Game.ts` step 7 — so game code
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
    this._render.render();
  }

  /** Sync the main scene's PixiJS sprites without rendering. Exposed for tests/custom loops. */
  syncEntities(scene: Scene): void {
    this._syncMain(scene);
  }

  private _syncMain(scene: Scene): void {
    const seen = new Set<number>();
    scene.each(Transform, Sprite, (transform, sprite, entity) => {
      seen.add(entity.eid);
      this._syncOne(
        this._mainTracking,
        entity.eid,
        transform,
        sprite,
        (layer) => this._containerFor(layer),
      );
      // Main-scene sprites go through the named `LayerSystem` (v1 parity —
      // `layers.getEntityLayer()`/`getEntityDepth()` stay meaningful for
      // whatever else reads them, e.g. an IDE picking tool). Overlay sprites
      // deliberately skip this: `LayerSystem`'s placement map is keyed by
      // raw entity id with no scene scoping (`Map<number, EntityPlacement>`
      // in `LayerSystem.ts`), so feeding it overlay eids too would reproduce
      // the exact cross-scene id collision this class exists to avoid — each
      // overlay instead gets its own flat, self-sorting container (see
      // `_overlayContainer`), which is enough since an overlay doesn't need
      // named cross-container layers, only draw order within itself.
      this._layers.addEntity(entity.eid, sprite.layer, sprite.depth);
    });
    for (const id of this._mainTracking.sprites.keys()) {
      if (!seen.has(id)) this._removeMainSprite(id);
    }
  }

  private _syncOverlay(scene: Scene): void {
    let tracking = this._overlayTracking.get(scene);
    if (tracking === undefined) {
      tracking = createTracking();
      this._overlayTracking.set(scene, tracking);
    }
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

  /** Same as `_removeSprite`, plus the `LayerSystem` bookkeeping only the main scene uses. */
  private _removeMainSprite(eid: number): void {
    this._removeSprite(this._mainTracking, eid);
    this._layers.removeEntity(eid);
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
    const tracking = this._overlayTracking.get(scene);
    if (tracking !== undefined) {
      for (const id of Array.from(tracking.sprites.keys())) {
        this._removeSprite(tracking, id);
      }
      this._overlayTracking.delete(scene);
    }
    const container = this._overlayContainers.get(scene);
    if (container !== undefined) {
      container.parent?.removeChild(container);
      container.destroy({ children: true });
      this._overlayContainers.delete(scene);
    }
  }

  destroy(): void {
    for (const id of Array.from(this._mainTracking.sprites.keys())) {
      this._removeMainSprite(id);
    }
    for (const scene of Array.from(this._overlayContainers.keys())) {
      this.releaseOverlay(scene);
    }
    this._textureCache.clear();
    this._render.destroy();
    this._layers.destroy();
  }
}
