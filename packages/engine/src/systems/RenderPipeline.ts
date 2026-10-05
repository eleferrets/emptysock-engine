// Registers pixi's advanced blend modes (incl. "subtract"); without it pixi silently renders "subtract"
// as normal — found by real-GPU verification (scripts/gpu-verify.mjs).
import "pixi.js/advanced-blend-modes";
import {
  BitmapFont,
  Cache,
  Container,
  Graphics,
  NineSliceSprite,
  Particle,
  ParticleContainer,
  PerspectiveMesh,
  Rectangle,
  RenderTexture,
  Sprite as PixiSprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import type { Renderer } from "pixi.js";
import { TextureStore, type TextureLoader } from "./TextureStore.js";
import type { FontRegistry } from "./FontRegistry.js";
import { toPixiBitmapFontData, type BitmapFontDef } from "./BitmapFontDef.js";
import {
  type CustomShaderFilter,
  buildShaderFilter,
  applyShaderUniforms,
} from "./CustomShaderFilter.js";
import {
  getShader,
  getShaderUniforms,
  getShaderVersion,
  type ParsedShaderUniform,
} from "./ShaderRegistry.js";
import type { Scene } from "../Scene.js";
import type { Entity } from "../Entity.js";
import type { SceneRenderer } from "../Game.js";
import { Sprite, resolveSpriteFramePath } from "../components/Sprite.js";
import { SpriteFlash } from "../components/SpriteFlash.js";
import { FlashFilterPool } from "./SpriteFlashSystem.js";
import { ColorOverlayFilter } from "pixi-filters";
import { Transform } from "../components/Transform.js";
import { Projection3D } from "../components/Projection3D.js";
import { RenderSystem, type RenderSystemOptions } from "./RenderSystem.js";
import { LayerSystem } from "./LayerSystem.js";
import type { PostProcessSystem } from "./PostProcessSystem.js";
import type { LightingSystem } from "./LightingSystem.js";
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

export type { TextureLoader };

export interface RenderPipelineOptions extends Omit<
  RenderSystemOptions,
  "layerSystem"
> {
  /** Supply a LayerSystem to share with other code; a fresh one is created otherwise. */
  layers?: LayerSystem;
  /** Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`. */
  textureLoader?: TextureLoader;
  /** Font registry consulted for bitmap fonts (`FontRegistry.registerBitmap`) when `draw_set_font`/`draw_text` runs. Usually `game.fonts`; can also be set later via `attachFonts()`. */
  fonts?: FontRegistry;
}

/** Per-scene bookkeeping for the sprites `RenderPipeline` is tracking on that scene's behalf. */
interface SceneTracking {
  /** entity eid -> its PixiJS sprite. */
  sprites: Map<number, PixiSprite>;
  /**
   * entity eid -> its `PerspectiveMesh`, for a `Transform`+`Sprite` entity
   * that also carries an *active* `Projection3D` — see `_syncOne()`'s doc
   * comment. Disjoint from `sprites`: an eid is tracked in exactly one of
   * the two maps at a time, never both.
   */
  meshes: Map<number, PerspectiveMesh>;
  /**
   * entity eid -> its `NineSliceSprite` (`mode` 1) or `TilingSprite`
   * (`mode` 2), for a `Sprite` with `sliceMode` 1/2 and `width`/`height > 0`.
   * Disjoint from `sprites` and `meshes`: an eid is in exactly one of the
   * three maps. A mode change tears the old node down and builds a new one.
   */
  sliced: Map<number, { mode: 1 | 2; node: NineSliceSprite | TilingSprite }>;
  /** entity eid -> the texturePath last applied, so we only reload on change. Shared by both `sprites` and `meshes` — an eid is only ever in one of those two maps at a time, so there's no ambiguity about which renderable a cached path belongs to. */
  texturePaths: Map<number, string>;
}

function createTracking(): SceneTracking {
  return {
    sprites: new Map(),
    meshes: new Map(),
    sliced: new Map(),
    texturePaths: new Map(),
  };
}

interface MountedTilemap {
  container: Container;
  generation: number;
}

/**
 * Built on the `defineComponent`/`Scene.each` object model, and `Game`'s
 * `SceneRenderer` shape. Uses
 * `RenderSystem` (the raw PixiJS wrapper) and `LayerSystem` (layer-level
 * ordering/visibility, via `RenderSystem`'s `getLayerContainer`/
 * `syncLayerVisibility`).
 *
 * **On PixiJS's native Render Layers, reversed
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
 *     bulk-iteration path, the engine design notes — no per-entity Proxy
 *     overhead), keeps a PixiJS sprite in sync with it, and places it on
 *     `layer`/`depth`.
 *  2. Does the same for each overlay `Scene`, but into a dedicated container
 *     appended to the stage *after* the main scene's layer containers — Pixi
 *     draws children in `addChild` order, so later-appended containers paint
 *     on top. Overlays are synced in the array's order, i.e. call order
 *, so the most recently `loadOverlay()`-ed scene
 *     ends up topmost.
 *  3. Renders the frame.
 *
 * **Multiple live scenes and entity id collisions**: every `Scene` owns its
 * The bitECS `World`, and each `World`'s entity ids independently start from
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

  /** Shared by the main scene and every overlay — see the class doc comment above. */
  private readonly _tracking = new Map<Scene, SceneTracking>();
  private _mainScene: Scene | null = null;
  private readonly _overlayContainers = new Map<Scene, Container>();
  private readonly _textures: TextureStore;
  private readonly _sortedLayers = new Set<string>();

  /**
   * Set via `attachPostProcess()`. When present, `renderFrame()` calls
   * `RenderSystem.syncPostProcessLayerFilters()` each frame so
   * `PostProcessSystem.setLayerFilter()`'s real pixi filters
   * (`BlurFilter`/`ColorMatrixFilter`/`pixi-filters`' `OutlineFilter`, per
   * the release notes Track 2) stay in sync with the layer containers this
   * pipeline owns. Not constructor-only, since a game may not have a
   * `PostProcessSystem` instance yet when the pipeline is constructed.
   */
  private _postProcess: PostProcessSystem | null = null;

  /** Set via `attachLighting()`. When present, `renderFrame()` calls `RenderSystem.syncLighting()` each frame for the main scene. */
  private _lighting: { system: LightingSystem; layerId: string } | null = null;

  /**
   * the release notes Track 4's real gap: `ParticleEmitter` is already a
   * pure, renderer-agnostic simulation (see `systems/ParticleSystem.ts`'s
   * The doc comment) with zero pixi dependency — it was never actually
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
    this._textures = new TextureStore(options.textureLoader);
    this._fonts = options.fonts ?? null;
  }

  private _fonts: FontRegistry | null;
  /** Installed pixi `BitmapFont`s, by font id — built once the def's atlas has loaded, rebuilt if the id is re-registered with a different def object. */
  private readonly _bitmapFonts = new Map<
    string,
    { def: BitmapFontDef; family: string; font: BitmapFont }
  >();

  /** Supplies (or clears, with `null`) the `FontRegistry` bitmap fonts are looked up in. */
  attachFonts(fonts: FontRegistry | null): void {
    this._fonts = fonts;
  }

  /**
   * The pixi `BitmapText` font family for a registered bitmap font id, or
   * `undefined` when the id has no bitmap def or its atlas is not loaded yet
   * (the load is kicked off and the caller falls back to ordinary Canvas
   * `Text` for this dispatch, the same "placeholder now, real next frame"
   * shape `_resolveTextureForDraw` uses for `draw_sprite`).
   */
  private _resolveBitmapFont(
    id: string,
  ): { family: string; def: BitmapFontDef } | undefined {
    const def = this._fonts?.getBitmap(id);
    if (def === undefined) return undefined;
    const existing = this._bitmapFonts.get(id);
    if (existing !== undefined && existing.def === def) return existing;
    const atlas = this._textures.get(def.atlasPath);
    if (atlas === undefined) {
      this._textures.load(def.atlasPath).catch((err: unknown) => {
        console.error(
          `[RenderPipeline] failed to load bitmap font atlas "${def.atlasPath}":`,
          err,
        );
      });
      return undefined;
    }
    if (existing !== undefined) Cache.remove(`${existing.family}-bitmap`);
    const family = `emptysock-bitmap:${id}`;
    const font = new BitmapFont({
      data: toPixiBitmapFontData(def, family),
      textures: [atlas],
    });
    Cache.set(`${family}-bitmap`, font);
    const entry = { def, family, font };
    this._bitmapFonts.set(id, entry);
    return entry;
  }

  /** The camera-independent overlay container UI/overlay content draws into — see `RenderSystem.guiStage`'s doc comment for why it's never affected by `CameraSystem`. */
  get guiLayer(): Container {
    return this._render.guiStage;
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
        ? await this._textures.load(texturePath)
        : Texture.WHITE;
    const container = new ParticleContainer({
      dynamicProperties: {
        position: true,
        rotation: true,
        scale: true,
        color: true,
      },
      // `part_type_blend` maps directly onto pixi's own
      // per-container `blendMode` — every particle in a `ParticleContainer`
      // shares one blend mode (they're batched together), which is exactly
      // the granularity `ParticleEmitterOptions.blendMode` already models.
      blendMode: emitter.options.blendMode === "add" ? "add" : "normal",
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
      const texture = this._particleTextures.get(emitter) ?? Texture.WHITE;
      // Reuse pixi `Particle` objects across frames (mutate fields in place)
      // instead of allocating one per live particle per frame; the container's
      // `particleChildren` is rewritten to the live prefix and flagged once
      // via `update()`.
      let pool = this._particlePool.get(container);
      if (pool === undefined) {
        pool = [];
        this._particlePool.set(container, pool);
      }
      const live = container.particleChildren;
      live.length = 0;
      let n = 0;
      for (const p of emitter.getParticles()) {
        if (!p.active) continue;
        let part = pool[n];
        if (part === undefined) {
          part = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 });
          pool.push(part);
        }
        part.texture = texture;
        part.x = p.x;
        part.y = p.y;
        part.scaleX = p.scale;
        part.scaleY = p.scale;
        part.rotation = p.rotation;
        part.tint = p.colour;
        part.alpha = p.alpha;
        live.push(part);
        n++;
      }
      container.update();
    }
  }

  private readonly _particlePool = new WeakMap<ParticleContainer, Particle[]>();

  /**
   * Constructs the real PixiJS renderer (WebGL by default — the engine design notes
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

  /**
   * Thin passthrough to `RenderSystem.renderMultiCamera()` — game code
   * (and the runtime) talks to `RenderPipeline`, never
   * the lower-level `RenderSystem` directly, so this is the real call site
   * for multi-view compositing. Does not itself call
   * `syncEntities()`/`renderFrame()` — call this *instead of*
   * `renderFrame()` for a frame that wants every active camera slot
   * composited, after the usual entity sync.
   */
  renderMultiCamera(
    viewports: Parameters<RenderSystem["renderMultiCamera"]>[0],
  ): void {
    this._render.renderMultiCamera(viewports);
  }

  resize(width: number, height: number): void {
    this._render.resize(width, height);
  }

  /**
   * Attach (or detach, with `null`) a `LightingSystem`. While attached,
   * `renderFrame()` rebuilds the lightmap for the main scene every frame
   * (`RenderSystem.syncLighting()`) over the camera's visible world rect
   * and applies it as a filter on `layerId` (default `"default"`).
   * Detaching removes the filter and frees the lightmap.
   */
  attachLighting(lighting: LightingSystem | null, layerId = "default"): void {
    if (this._lighting !== null && lighting === null) {
      this._render.clearLighting();
    }
    this._lighting = lighting === null ? null : { system: lighting, layerId };
  }

  /** World-space rect the camera currently shows (stage translate + uniform scale; rotation ignored). */
  private _visibleWorldRect(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const stage = this._render.stage;
    const scale = stage.scale.x !== 0 ? stage.scale.x : 1;
    const { width: w, height: h } = this._render.renderer;
    return {
      x: -stage.x / scale,
      y: -stage.y / scale,
      width: w / scale,
      height: h / scale,
    };
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
    if (this._lighting !== null) {
      this._render.syncLighting(
        this._lighting.system,
        main,
        this._lighting.layerId,
        this._visibleWorldRect(),
      );
    }
    this._render.render();
  }

  /**
   * Paints the scene-transition overlay described by `postProcess`'s
   * `transitionEffect`/`transitionProgress`/`transitionColour` on top of
   * the stage — an overlay-based approach (a single colour rect, never two
   * live scenes rendered simultaneously). the release notes
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
      this._syncOne(tracking, entity, transform, sprite, (layer) =>
        this._containerFor(layer),
      );
    });
    this._pruneUnseen(tracking, seen);
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
      for (const id of Array.from(tracking.meshes.keys())) {
        this._removeMesh(tracking, id);
      }
      for (const id of Array.from(tracking.sliced.keys())) {
        this._removeSliced(tracking, id);
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
      this._syncOne(tracking, entity, transform, sprite, () => container);
    });
    this._pruneUnseen(tracking, seen);
  }

  /**
   * Removes tracking (and destroys the renderable) for any eid this frame's
   * `scene.each()` pass didn't see — covers both `sprites` and `meshes`,
   * since an entity can move between the two across frames (its
   * `Projection3D.active` flag flipping) and either map could hold a stale
   * entry for a destroyed entity.
   */
  private _pruneUnseen(tracking: SceneTracking, seen: Set<number>): void {
    for (const id of [...tracking.sprites.keys()]) {
      if (!seen.has(id)) this._removeSprite(tracking, id);
    }
    for (const id of [...tracking.meshes.keys()]) {
      if (!seen.has(id)) this._removeMesh(tracking, id);
    }
    for (const id of [...tracking.sliced.keys()]) {
      if (!seen.has(id)) this._removeSliced(tracking, id);
    }
  }

  /**
   * Per-`(Transform, Sprite)` entity sync. An entity with no `Projection3D`
   * component, or one whose `Projection3D.active` is `false` (the default),
   * renders exactly as before this method learned about `Projection3D` at
   * all — a plain `PixiSprite` positioned from `Transform`. An entity with
   * an *active* `Projection3D` instead renders through `_syncProjected()` —
   * a real pixi core `PerspectiveMesh` whose four corners are copied
   * straight from `Projection3D.x0..y3` (see that component's doc comment
   * for why this copy needs no reinterpretation: both sides already agree
   * on "clockwise from top-left"). Those corners are the projection layer's
   * derived *result* — already-absolute positions (a `d3d_transform_set_*`
   * call bakes in translation itself) — so a projected entity's `Transform`
   * is deliberately not applied on top of them; applying both would
   * double-position the mesh. Whichever branch didn't run this call has its
   * stale tracked renderable (if any) torn down, cheaply — `_removeSprite`/
   * `_removeMesh` are no-ops when nothing is tracked for that eid, which is
   * the overwhelmingly common case (an entity practically never flips
   * `Projection3D.active` every frame).
   */
  private _syncOne(
    tracking: SceneTracking,
    entity: Entity,
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
      frameCount: number;
      currentFrame: number;
      width: number;
      height: number;
      sliceMode: number;
      sliceLeft: number;
      sliceRight: number;
      sliceTop: number;
      sliceBottom: number;
      shader?: string;
    },
    containerFor: (layer: string) => Container,
  ): void {
    const eid = entity.eid;
    const projection = entity.has(Projection3D)
      ? entity.get(Projection3D)
      : undefined;
    // Multi-frame sprites resolve `texturePath`'s `"{n}"` template against
    // the entity's current frame — `resolveSpriteFramePath` is a no-op for
    // an ordinary `frameCount <= 1` sprite (see its own doc comment), so
    // this is byte-for-byte the old single-path behaviour in that case.
    const framePath = resolveSpriteFramePath(sprite);

    if (projection !== undefined && projection.active) {
      this._removeSprite(tracking, eid);
      this._removeSliced(tracking, eid);
      this._syncProjected(
        tracking,
        eid,
        sprite,
        framePath,
        projection,
        containerFor(sprite.layer),
      );
      return;
    }
    this._removeMesh(tracking, eid);

    const sliceMode =
      (sprite.sliceMode === 1 || sprite.sliceMode === 2) &&
      sprite.width > 0 &&
      sprite.height > 0
        ? sprite.sliceMode
        : 0;
    if (sliceMode !== 0) {
      this._removeSprite(tracking, eid);
      this._syncSliced(
        tracking,
        eid,
        sliceMode,
        transform,
        sprite,
        framePath,
        containerFor(sprite.layer),
      );
      return;
    }
    this._removeSliced(tracking, eid);

    let pixiSprite = tracking.sprites.get(eid);
    if (pixiSprite === undefined) {
      pixiSprite = new PixiSprite(Texture.EMPTY);
      tracking.sprites.set(eid, pixiSprite);
    }

    if (tracking.texturePaths.get(eid) !== framePath) {
      tracking.texturePaths.set(eid, framePath);
      this._applyTexture(tracking, eid, pixiSprite, framePath);
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
    this._resolveSpriteFlash(pixiSprite, entity);
    this._applySpriteShader(pixiSprite, sprite.shader);
  }

  private readonly _flashPool = new FlashFilterPool();
  private readonly _flashFilters = new WeakMap<
    PixiSprite,
    ColorOverlayFilter
  >();

  /** Flash filters currently attached (pool checked out). */
  get activeFlashFilterCount(): number {
    return this._flashPool.liveCount;
  }

  /**
   * One white silhouette texture per source texture, built on first flash.
   * A flash is then a second, batched sprite over the original (tinted the
   * flash colour at `amount` alpha), which costs a quad instead of the extra
   * render pass a filter needs per sprite.
   */
  private readonly _silhouettes = new WeakMap<Texture, Texture>();
  private readonly _flashOverlays = new WeakMap<PixiSprite, PixiSprite>();
  private readonly _overlayPool: PixiSprite[] = [];
  private _liveOverlays = 0;

  /** Flash overlays currently attached. */
  get activeFlashOverlayCount(): number {
    return this._liveOverlays;
  }

  /** The white silhouette of `texture` (alpha kept), or `undefined` while it cannot be built. */
  private _silhouetteOf(texture: Texture): Texture | undefined {
    const cached = this._silhouettes.get(texture);
    if (cached !== undefined) return cached;
    if (
      !this._render.hasRenderer ||
      texture === Texture.EMPTY ||
      texture === Texture.WHITE ||
      texture.orig.width <= 0 ||
      texture.orig.height <= 0
    )
      return undefined;
    const target = RenderTexture.create({
      width: texture.orig.width,
      height: texture.orig.height,
      resolution: texture.source.resolution,
    });
    const source = new PixiSprite(texture);
    const filter = new ColorOverlayFilter();
    filter.color = 0xffffff;
    filter.alpha = 1;
    source.filters = [filter];
    this._render.renderer.render({ container: source, target, clear: true });
    source.destroy();
    filter.destroy();
    this._silhouettes.set(texture, target);
    return target;
  }

  private _releaseFlashOverlay(pixiSprite: PixiSprite): void {
    const overlay = this._flashOverlays.get(pixiSprite);
    if (overlay === undefined) return;
    this._flashOverlays.delete(pixiSprite);
    pixiSprite.removeChild(overlay);
    this._liveOverlays--;
    this._overlayPool.push(overlay);
  }

  /**
   * While the entity's `SpriteFlash.amount` is above 0 the sprite shows a
   * silhouette overlay; the pooled `ColorOverlayFilter` remains the fallback
   * for a texture whose silhouette cannot be built (no renderer yet, a
   * texture still loading). `_applySpriteShader` attaches/detaches the filter.
   */
  private _resolveSpriteFlash(
    pixiSprite: PixiSprite,
    entity: { has(c: unknown): boolean; get(c: never): unknown },
  ): void {
    const flash = entity.has(SpriteFlash)
      ? (entity.get(SpriteFlash as never) as { color: number; amount: number })
      : undefined;
    const held = this._flashFilters.get(pixiSprite);
    if (flash === undefined || !(flash.amount > 0)) {
      this._releaseFlashOverlay(pixiSprite);
      if (held !== undefined) {
        this._flashFilters.delete(pixiSprite);
        this._flashPool.release(held);
      }
      return;
    }
    const silhouette = this._silhouetteOf(pixiSprite.texture);
    if (silhouette !== undefined) {
      if (held !== undefined) {
        this._flashFilters.delete(pixiSprite);
        this._flashPool.release(held);
      }
      let overlay = this._flashOverlays.get(pixiSprite);
      if (overlay === undefined) {
        overlay = this._overlayPool.pop() ?? new PixiSprite(silhouette);
        this._flashOverlays.set(pixiSprite, overlay);
        pixiSprite.addChild(overlay);
        this._liveOverlays++;
      }
      if (overlay.texture !== silhouette) overlay.texture = silhouette;
      overlay.anchor.copyFrom(pixiSprite.anchor);
      overlay.tint = flash.color;
      overlay.alpha = flash.amount;
      return;
    }
    this._releaseFlashOverlay(pixiSprite);
    if (held !== undefined) {
      this._flashPool.configure(held, flash.color, flash.amount);
      return;
    }
    const f = this._flashPool.acquire(flash.color, flash.amount);
    this._flashFilters.set(pixiSprite, f);
  }

  /** Shared `CustomShaderFilter` per registered shader id, built lazily on first use. */
  private readonly _shaderFilters = new Map<
    string,
    {
      filter: CustomShaderFilter;
      uniforms: ParsedShaderUniform[];
      appliedVersion: number;
      source: object;
    }
  >();

  /**
   * The one live Filter for a registered shader id (`undefined` when the id
   * isn't registered), shared by every entity/draw call using that shader —
   * never allocated per frame. Re-registering a shader rebuilds it; uniform
   * writes (`setShaderUniform`) are copied into the Filter here, and only
   * when the registry's version for that shader changed.
   *
   * GPU compilation of the generated program is not verified headless: the
   * tests cover the wiring (which Filter lands on which sprite), not pixels.
   */
  resolveShaderFilter(id: string): CustomShaderFilter | undefined {
    const source = getShader(id);
    if (source === undefined) return undefined;
    const version = getShaderVersion(id);
    let entry = this._shaderFilters.get(id);
    const registration = getShaderUniforms(id);
    if (entry === undefined || entry.source !== source) {
      const built = buildShaderFilter(id);
      if (built === undefined) return undefined;
      entry = {
        filter: built.filter,
        uniforms: built.uniforms,
        appliedVersion: -1,
        source,
      };
      this._shaderFilters.set(id, entry);
      this._render.warnIfGlOnlyFilter(built.filter);
    }
    if (entry.appliedVersion !== version && registration !== undefined) {
      entry.appliedVersion = applyShaderUniforms(
        entry.filter,
        entry.uniforms,
        id,
      );
    }
    return entry.filter;
  }

  /** Sets a tracked sprite's `.filters` to `[sharedShader?, flash?]`, or clears it — no write at all when already correct, so steady state allocates nothing. */
  private _applySpriteShader(
    pixiSprite: PixiSprite,
    shaderId: string | undefined,
  ): void {
    const shader =
      shaderId !== undefined && shaderId !== ""
        ? this.resolveShaderFilter(shaderId)
        : undefined;
    const flash = this._flashFilters.get(pixiSprite);
    const current = pixiSprite.filters as readonly unknown[] | null | undefined;
    const want: unknown[] = [];
    if (shader !== undefined) want.push(shader);
    if (flash !== undefined) want.push(flash);
    const have = current ?? [];
    if (have.length === want.length && want.every((f, i) => have[i] === f)) {
      return;
    }
    pixiSprite.filters = want.length > 0 ? (want as never) : null;
  }

  /**
   * `_syncOne()`'s `Projection3D`-active branch — a real `PerspectiveMesh`
   * per entity, corners copied straight from the component, texture/tint/
   * alpha/visibility/depth kept in sync the same way `_syncOne()` keeps a
   * plain `PixiSprite` in sync. `verticesX`/`verticesY` are left at
   * `PerspectiveMesh.defaultOptions`'s own 10x10 grid — no per-entity
   * quality knob exists on `Projection3D` today.
   */
  private _syncProjected(
    tracking: SceneTracking,
    eid: number,
    sprite: {
      texturePath: string;
      tint: number;
      alpha: number;
      layer: string;
      depth: number;
      visible: boolean;
    },
    framePath: string,
    projection: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x3: number;
      y3: number;
    },
    container: Container,
  ): void {
    let mesh = tracking.meshes.get(eid);
    if (mesh === undefined) {
      mesh = new PerspectiveMesh({ texture: Texture.EMPTY });
      tracking.meshes.set(eid, mesh);
    }

    if (tracking.texturePaths.get(eid) !== framePath) {
      tracking.texturePaths.set(eid, framePath);
      this._applyTexture(tracking, eid, mesh, framePath);
    }

    if (mesh.parent !== container) container.addChild(mesh);

    mesh.setCorners(
      projection.x0,
      projection.y0,
      projection.x1,
      projection.y1,
      projection.x2,
      projection.y2,
      projection.x3,
      projection.y3,
    );
    mesh.tint = sprite.tint;
    mesh.alpha = sprite.alpha;
    mesh.visible = sprite.visible;
    mesh.zIndex = sprite.depth;
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
      baseTexture = await this._textures.load(tileset.imagePath);
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

  /**
   * Synchronous texture lookup for `draw_sprite` (`PixiDrawTarget.
   * sprite()`) — unlike `_applyTexture` above, there is no live tracked
   * `PixiSprite`/`PerspectiveMesh` to update once an async load resolves:
   * a `draw_sprite` call creates a brand-new `Sprite` fresh every dispatch
   * (the semantic — it's drawn this frame, not a persistent object),
   * so there's nothing to retroactively re-texture. Returns the cached
   * texture if already loaded, otherwise kicks off the same shared
   * `_loadTexture`/`_textureCache` load-and-cache path as `_applyTexture`
   * (so a *later* `draw_sprite` call for the same path is cache-hit) and
   * returns `Texture.WHITE` for this frame only — the same "visible
   * placeholder, not a blank hole" fallback `_applyTexture` already uses
   * for an empty path.
   */
  private _resolveTextureForDraw(templatePath: string): Texture {
    if (templatePath === "") return Texture.WHITE;
    // A multi-frame sprite's path is a `frame_{n}.png` template; `draw_sprite`'s
    // subimage is not modelled, so it draws frame 0.
    const path = templatePath.replace("{n}", "0");
    const cached = this._textures.get(path);
    if (cached !== undefined) return cached;
    this._textures
      .load(path)
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error(
          `[RenderPipeline] failed to load texture "${path}" for draw_sprite:`,
          err,
        );
      });
    return Texture.WHITE;
  }

  /**
   * Shared texture-apply path for both `PixiSprite` and `PerspectiveMesh` —
   * both expose a settable `.texture`, so `target` takes that minimal
   * structural shape rather than one concrete pixi class.
   */
  private _applyTexture(
    tracking: SceneTracking,
    eid: number,
    target: { texture: Texture },
    path: string,
  ): void {
    if (path === "") {
      target.texture = Texture.WHITE;
      return;
    }
    const cached = this._textures.get(path);
    if (cached !== undefined) {
      target.texture = cached;
      return;
    }
    this._textures
      .load(path)
      .then((texture) => {
        // The entity may have lost its Sprite, been destroyed, or asked for
        // a different texture, by the time the load resolves; only apply if
        // still current for this (tracking, eid) pair.
        if (tracking.texturePaths.get(eid) === path) {
          target.texture = texture;
        }
      })
      .catch((err: unknown) => {
        console.error(
          `[RenderPipeline] failed to load texture "${path}":`,
          err,
        );
      });
  }

  /**
   * `_syncOne()`'s `sliceMode` 1/2 branch. Mode 1 is a pixi core
   * `NineSliceSprite` (corners fixed at the `slice*` guide sizes), mode 2 a
   * `TilingSprite` (texture repeated at native scale, clipped to the box).
   * Both are sized to `Sprite.width` x `Sprite.height` in local space and
   * then scaled by `Transform.scale*`, so a scaled entity grows the whole
   * box like a plain sprite would. Anchor maps to `anchor` (tiling) or
   * `pivot` (nine-slice, which has no anchor in pixi v8).
   */
  private _syncSliced(
    tracking: SceneTracking,
    eid: number,
    mode: 1 | 2,
    transform: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    },
    sprite: {
      tint: number;
      alpha: number;
      anchorX: number;
      anchorY: number;
      depth: number;
      visible: boolean;
      width: number;
      height: number;
      sliceLeft: number;
      sliceRight: number;
      sliceTop: number;
      sliceBottom: number;
    },
    framePath: string,
    container: Container,
  ): void {
    let entry = tracking.sliced.get(eid);
    if (entry !== undefined && entry.mode !== mode) {
      this._removeSliced(tracking, eid);
      entry = undefined;
    }
    if (entry === undefined) {
      const node =
        mode === 1
          ? new NineSliceSprite({ texture: Texture.EMPTY })
          : new TilingSprite({ texture: Texture.EMPTY });
      entry = { mode, node };
      tracking.sliced.set(eid, entry);
    }
    const node = entry.node;

    if (tracking.texturePaths.get(eid) !== framePath) {
      tracking.texturePaths.set(eid, framePath);
      this._applyTexture(tracking, eid, node, framePath);
    }
    if (node.parent !== container) container.addChild(node);

    if (node instanceof NineSliceSprite) {
      node.leftWidth = sprite.sliceLeft;
      node.rightWidth = sprite.sliceRight;
      node.topHeight = sprite.sliceTop;
      node.bottomHeight = sprite.sliceBottom;
      node.width = sprite.width;
      node.height = sprite.height;
      node.pivot.set(
        sprite.width * sprite.anchorX,
        sprite.height * sprite.anchorY,
      );
    } else {
      node.width = sprite.width;
      node.height = sprite.height;
      node.anchor.set(sprite.anchorX, sprite.anchorY);
    }
    node.x = transform.x;
    node.y = transform.y;
    node.rotation = transform.rotation;
    node.scale.set(transform.scaleX, transform.scaleY);
    node.tint = sprite.tint;
    node.alpha = sprite.alpha;
    node.visible = sprite.visible;
    node.zIndex = sprite.depth;
  }

  private _removeSliced(tracking: SceneTracking, eid: number): void {
    const entry = tracking.sliced.get(eid);
    if (entry === undefined) return;
    entry.node.parent?.removeChild(entry.node);
    entry.node.destroy();
    tracking.sliced.delete(eid);
    tracking.texturePaths.delete(eid);
  }

  private _removeSprite(tracking: SceneTracking, eid: number): void {
    const pixiSprite = tracking.sprites.get(eid);
    if (pixiSprite === undefined) return;
    this._releaseFlashOverlay(pixiSprite);
    const held = this._flashFilters.get(pixiSprite);
    if (held !== undefined) {
      this._flashFilters.delete(pixiSprite);
      this._flashPool.release(held);
    }
    pixiSprite.parent?.removeChild(pixiSprite);
    pixiSprite.destroy();
    tracking.sprites.delete(eid);
    tracking.texturePaths.delete(eid);
  }

  private _removeMesh(tracking: SceneTracking, eid: number): void {
    const mesh = tracking.meshes.get(eid);
    if (mesh === undefined) return;
    mesh.parent?.removeChild(mesh);
    mesh.destroy();
    tracking.meshes.delete(eid);
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
      for (const id of Array.from(tracking.meshes.keys())) {
        this._removeMesh(tracking, id);
      }
      for (const id of Array.from(tracking.sliced.keys())) {
        this._removeSliced(tracking, id);
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
    this._textures.clear();
    for (const { family } of this._bitmapFonts.values()) {
      Cache.remove(`${family}-bitmap`);
    }
    this._bitmapFonts.clear();
    for (const { filter } of this._shaderFilters.values()) filter.destroy();
    this._shaderFilters.clear();
    this._transitionOverlay?.destroy();
    this._transitionOverlay = null;
    this._render.destroy();
    this._layers.destroy();
  }
}
