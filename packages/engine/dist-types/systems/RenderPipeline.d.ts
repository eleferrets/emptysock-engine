import { Container, Graphics, Texture } from "pixi.js";
import type { Renderer } from "pixi.js";
import { type TextureLoader } from "./TextureStore.js";
import type { FontRegistry } from "./FontRegistry.js";
import { type BitmapFontDef } from "./BitmapFontDef.js";
import { type CustomShaderFilter } from "./CustomShaderFilter.js";
import type { Scene } from "../Scene.js";
import type { SceneRenderer } from "../Game.js";
import { RenderSystem, type RenderSystemOptions } from "./RenderSystem.js";
import { LayerSystem } from "./LayerSystem.js";
import type { PostProcessSystem } from "./PostProcessSystem.js";
import type { ParticleEmitter } from "./ParticleSystem.js";
import type { GmlBehaviorSystem } from "./GmlBehaviorSystem.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlDrawTarget } from "../compat/gml.js";
import type { GmlSurfaceBackend } from "../compat/gmlSurfaces.js";
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
/**
 * The real `GmlDrawTarget` implementation (`compat/gml.ts`'s structural
 * interface) — a pixi `Graphics` wrapper, rebuilt from scratch on every
 * `onDraw`/`onDrawGui` call. Construction itself clears the previous call's
 * vector drawing and removes any `Text` children a previous `draw_text` call
 * added (pixi's `Graphics` has no text primitive of its own, so `draw_text`
 * appends a real `Text` child instead — removed here rather than left to
 * accumulate, since a `Graphics` object persists across frames for a given
 * entity while its drawing content does not).
 */
declare class PixiGmlDrawTarget implements GmlDrawTarget {
  private readonly _graphics;
  private readonly _resolveTexture;
  private readonly _resolveShader;
  private readonly _resolveBitmapFont;
  private readonly _resolveSurface;
  private _color;
  /** Persistent draw-state font/alignment/alpha — GameMaker's `draw_set_*` calls mutate these until changed again, applied to the next `text()`/sprite draw call. Reset to defaults on every construction (every `onDraw`/`onDrawGui` dispatch), matching this class's own "rebuilt fresh every call, no cross-frame leakage" doc comment above. */
  private _fontFamily;
  private _halign;
  private _valign;
  private _alpha;
  constructor(
    _graphics: Graphics,
    _resolveTexture: (path: string) => Texture,
    _resolveShader?: (id: string) => CustomShaderFilter | undefined,
    _resolveBitmapFont?: (id: string) =>
      | {
          family: string;
          def: BitmapFontDef;
        }
      | undefined,
    _resolveSurface?: (id: number) => Texture | undefined,
  );
  /** Where draw calls currently land: the base `Graphics`, or the latest blend-mode segment child. */
  private _g;
  private _blend;
  /** Set by `clear()`: colour/alpha the owning surface backend clears its texture to before replaying this target's content. */
  pendingClear:
    | {
        colour: number;
        alpha: number;
      }
    | undefined;
  /**
   * `gpu_set_blendmode`: a pixi `Graphics` has one blend mode, so a change
   * starts a new child `Graphics` segment (in draw order) with that mode;
   * sprites/text added afterwards are its children and inherit it.
   */
  setBlendMode(mode: number): void;
  drawSurface(surfaceId: number, x: number, y: number): void;
  clear(colour: number, alpha: number): void;
  ellipse(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    outline: boolean,
  ): void;
  triangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    outline: boolean,
  ): void;
  setColor(hex: number): void;
  setFont(fontId: string): void;
  setHalign(align: number): void;
  setValign(align: number): void;
  setAlpha(alpha: number): void;
  /** `shader_set`/`shader_reset` — every sprite-shaped draw call made while a shader is active gets that shader's shared Filter (vector shapes/text drawn on the `Graphics` itself are not filtered). */
  setShader(shaderId: string | null): void;
  private _shader;
  private _shade;
  rect(x1: number, y1: number, x2: number, y2: number, outline: boolean): void;
  circle(x: number, y: number, r: number, outline: boolean): void;
  text(x: number, y: number, text: string): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  sprite(texturePath: string, x: number, y: number): void;
  spriteExt(
    texturePath: string,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotationDeg: number,
    colour: number,
    alpha: number,
  ): void;
  /** Crops a fresh `Texture` view onto the base texture's `(left, top, width, height)` source-pixel rectangle — real pixi `Texture`/`Rectangle` API, not an approximation. A crop rect that falls outside the base texture's own bounds is a real pixi runtime error, so callers should keep `left`/`top`/`width`/`height` inside the sprite's actual pixel dimensions, same as GameMaker's own function requires. */
  private _cropTexture;
  spritePart(
    texturePath: string,
    left: number,
    top: number,
    width: number,
    height: number,
    x: number,
    y: number,
  ): void;
  spritePartExt(
    texturePath: string,
    left: number,
    top: number,
    width: number,
    height: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    colour: number,
    alpha: number,
  ): void;
}
/**
 * Pixi implementation of `GmlSurfaceBackend`: one `RenderTexture` per GMS2
 * surface. `beginTarget` hands out a `PixiGmlDrawTarget` over a scratch
 * `Graphics`; `endTarget` renders it into the surface texture (accumulating,
 * unless `draw_clear` was called, in which case the texture is cleared to that
 * colour first). GPU output is not verifiable headless; tests check wiring.
 */
declare class PixiSurfaceBackend implements GmlSurfaceBackend {
  private readonly _renderer;
  private readonly _makeTarget;
  private _next;
  private readonly _surfaces;
  private readonly _open;
  constructor(
    _renderer: () => Renderer,
    _makeTarget: (
      graphics: Graphics,
      resolveSurface: (id: number) => Texture | undefined,
    ) => PixiGmlDrawTarget,
  );
  create(width: number, height: number): number;
  exists(id: number): boolean;
  free(id: number): void;
  width(id: number): number;
  height(id: number): number;
  /** The texture `draw_surface` samples; undefined for an unknown/freed surface. */
  texture(id: number): Texture | undefined;
  beginTarget(id: number): GmlDrawTarget | undefined;
  endTarget(id: number): void;
  destroy(): void;
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
  /** Font registry consulted for bitmap fonts (`FontRegistry.registerBitmap`) when GML `draw_set_font`/`draw_text` runs. Usually `game.fonts`; can also be set later via `attachFonts()`. */
  fonts?: FontRegistry;
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
export declare class RenderPipeline implements SceneRenderer {
  private readonly _render;
  private readonly _layers;
  /** Shared by the main scene and every overlay — see the class doc comment above. */
  private readonly _tracking;
  private _mainScene;
  private readonly _overlayContainers;
  private readonly _textures;
  private readonly _sortedLayers;
  /**
   * Set via `attachPostProcess()`. When present, `renderFrame()` calls
   * `RenderSystem.syncPostProcessLayerFilters()` each frame so
   * `PostProcessSystem.setLayerFilter()`'s real pixi filters
   * (`BlurFilter`/`ColorMatrixFilter`/`pixi-filters`' `OutlineFilter`, per
   * RELEASE_PASS.md Track 2) stay in sync with the layer containers this
   * pipeline owns. Not constructor-only, since a game may not have a
   * `PostProcessSystem` instance yet when the pipeline is constructed.
   */
  private _postProcess;
  /**
   * Set via `attachGmlBehaviors()`. When present, `renderFrame()` dispatches
   * the main scene's `GmlBehaviorState` entities' `onDraw`/`onDrawGui` once
   * per frame — see `_renderGmlDraw()`'s doc comment for the real mechanism
   * (a genuine second render pass, not a per-sprite special case).
   */
  private _gmlBehaviors;
  private _gmlCtx;
  /** Per-entity pixi `Graphics`, rebuilt (cleared + redrawn) every call — one map per draw kind, keyed by eid, scoped to whichever `Scene` is currently the main scene (mirrors `_tracking`'s per-`Scene` scoping; GML Draw/Draw GUI dispatch only ever covers the main scene today). */
  private readonly _gmlDrawGraphics;
  private readonly _gmlDrawGuiGraphics;
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
  private readonly _particleContainers;
  private readonly _particleTextures;
  /** Tilemap tile sprites, mounted via `mountTilemap()` — see that method's doc comment. */
  private readonly _mountedTilemaps;
  private _tilemapGeneration;
  /** Full-screen graphics used to paint the scene-transition overlay, created lazily. */
  private _transitionOverlay;
  constructor(options?: RenderPipelineOptions);
  private _fonts;
  /** Installed pixi `BitmapFont`s, by font id — built once the def's atlas has loaded, rebuilt if the id is re-registered with a different def object. */
  private readonly _bitmapFonts;
  /** Supplies (or clears, with `null`) the `FontRegistry` bitmap fonts are looked up in. */
  attachFonts(fonts: FontRegistry | null): void;
  /**
   * The pixi `BitmapText` font family for a registered bitmap font id, or
   * `undefined` when the id has no bitmap def or its atlas is not loaded yet
   * (the load is kicked off and the caller falls back to ordinary Canvas
   * `Text` for this dispatch, the same "placeholder now, real next frame"
   * shape `_resolveTextureForDraw` uses for `draw_sprite`).
   */
  private _resolveBitmapFont;
  /**
   * Attach (or detach, with `null`) a `GmlBehaviorSystem` and the
   * `GmlActionContext` its dispatch calls should receive. `ctx.drawTarget`
   * is overwritten per-call by `_renderGmlDraw()` — whatever `drawTarget` is
   * set on the `ctx` passed here is ignored.
   */
  attachGmlBehaviors(
    system: GmlBehaviorSystem | null,
    ctx: GmlActionContext | null,
  ): void;
  /** The camera-independent overlay container `GmlBehaviorSystem`'s Draw GUI dispatch draws into — see `RenderSystem.guiStage`'s doc comment for why it's never affected by `CameraSystem`. */
  get guiLayer(): Container;
  /** Attach (or detach, with `null`) the `PostProcessSystem` whose layer filters `renderFrame()` should keep synced onto this pipeline's layer containers. */
  attachPostProcess(postProcess: PostProcessSystem | null): void;
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
  mountParticles(emitter: ParticleEmitter, layerName?: string): Promise<void>;
  /** Detaches and destroys `emitter`'s mounted `ParticleContainer`. Safe to call on an emitter that was never mounted (a no-op). */
  unmountParticles(emitter: ParticleEmitter): void;
  private _syncParticles;
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
  init(options?: RenderPipelineOptions): Promise<void>;
  /** The engine's LayerSystem — call `defineLayer()` on it for custom draw order. */
  get layers(): LayerSystem;
  get renderer(): Renderer;
  get stage(): Container;
  get canvas(): HTMLCanvasElement;
  /**
   * Thin passthrough to `RenderSystem.renderMultiCamera()` — game code
   * (and `GmsProjectRuntime`, once wired) talks to `RenderPipeline`, never
   * the lower-level `RenderSystem` directly, so this is the real call site
   * for GameMaker-style multi-view compositing. Does not itself call
   * `syncEntities()`/`renderFrame()` — call this *instead of*
   * `renderFrame()` for a frame that wants every active camera slot
   * composited, after the usual entity sync.
   */
  renderMultiCamera(
    viewports: Parameters<RenderSystem["renderMultiCamera"]>[0],
  ): void;
  resize(width: number, height: number): void;
  /**
   * `Game.update()` step 7's entry point (via `Game.attachRenderer(this)` —
   * this method is what makes `RenderPipeline` satisfy `SceneRenderer`
   * structurally). Syncs the main scene, then every overlay in call order,
   * releases tracking for any overlay no longer present in `overlays`, and
   * renders once.
   */
  renderFrame(main: Scene, overlays?: readonly Scene[]): void;
  /**
   * Runs `GmlBehaviorSystem.renderDraw()`/`renderDrawGui()` for the main
   * scene, once per frame — a genuine second (well, third counting the
   * sprite sync) pass through `renderFrame()`, not a conditional bolted into
   * `_syncOne()`'s per-sprite loop. It has to be a separate pass because the
   * two draw kinds target structurally different containers: `onDraw`'s
   * `Graphics` are parented under the `"foreground"` layer container (a
   * child of `RenderSystem.stage`, so `CameraSystem`'s pan/zoom/rotate
   * reaches it exactly like any world sprite), while `onDrawGui`'s are
   * parented under `RenderSystem.guiStage` (a sibling of `stage`, never a
   * descendant — see that getter's doc comment for why that alone is what
   * gives Draw GUI its camera independence, with no per-call camera check
   * anywhere in this method). A per-sprite special case in `_syncOne()`
   * could not express "draw into a different container tree" at all, since
   * that method only ever writes to one sprite's existing container.
   *
   * Each call's `Graphics` are cleared and redrawn from scratch (never
   * diffed) — the same rebuild-every-frame tradeoff CLAUDE.md's
   * "ParticleEmitter renders through a real pixi ParticleContainer" entry
   * already accepts for particles. `_gmlDrawGraphics`/`_gmlDrawGuiGraphics`
   * prune any entity that didn't draw this frame (destroyed, or its
   * behavior module has no `onDraw`/`onDrawGui` this call), so a
   * `GmlBehaviorState` entity that stops drawing doesn't leave a stale
   * `Graphics` node in the tree.
   */
  private _renderGmlDraw;
  private _acquireGmlGraphics;
  private _newDrawTarget;
  private _surfaceBackend;
  /** GMS2 surface backend (`surface_create`/`surface_set_target`/`draw_surface`, `compat/gmlSurfaces.ts`); wired into `GmlActionContext.surfaces` by `GmsProjectRuntime`. */
  get surfaces(): PixiSurfaceBackend;
  private _pruneGmlGraphics;
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
  renderTransitionOverlay(postProcess: PostProcessSystem): void;
  private _ensureTransitionOverlay;
  /** Sync the main scene's PixiJS sprites without rendering. Exposed for tests/custom loops. */
  syncEntities(scene: Scene): void;
  private _syncMain;
  /** Fully tear down the current main scene's tracking — same per-sprite teardown `releaseOverlay` uses. */
  private _releaseMain;
  private _syncOverlay;
  /**
   * Removes tracking (and destroys the renderable) for any eid this frame's
   * `scene.each()` pass didn't see — covers both `sprites` and `meshes`,
   * since an entity can move between the two across frames (its
   * `Projection3D.active` flag flipping) and either map could hold a stale
   * entry for a destroyed entity.
   */
  private _pruneUnseen;
  /**
   * Per-`(Transform, Sprite)` entity sync. An entity with no `Projection3D`
   * component, or one whose `Projection3D.active` is `false` (the default),
   * renders exactly as before this method learned about `Projection3D` at
   * all — a plain `PixiSprite` positioned from `Transform`. An entity with
   * an *active* `Projection3D` instead renders through `_syncProjected()` —
   * a real pixi core `PerspectiveMesh` whose four corners are copied
   * straight from `Projection3D.x0..y3` (see that component's doc comment
   * for why this copy needs no reinterpretation: both sides already agree
   * on "clockwise from top-left"). Those corners are `gmlProjection.ts`'s
   * derived *result* — already-absolute positions (a `d3d_transform_set_*`
   * call bakes in translation itself) — so a projected entity's `Transform`
   * is deliberately not applied on top of them; applying both would
   * double-position the mesh. Whichever branch didn't run this call has its
   * stale tracked renderable (if any) torn down, cheaply — `_removeSprite`/
   * `_removeMesh` are no-ops when nothing is tracked for that eid, which is
   * the overwhelmingly common case (an entity practically never flips
   * `Projection3D.active` every frame).
   */
  private _syncOne;
  /** Shared `CustomShaderFilter` per registered shader id, built lazily on first use. */
  private readonly _shaderFilters;
  /**
   * The one live Filter for a registered shader id (`undefined` when the id
   * isn't registered), shared by every entity/draw call using that shader —
   * never allocated per frame. Re-registering a shader rebuilds it; uniform
   * writes (`setGmlShaderUniform`) are copied into the Filter here, and only
   * when the registry's version for that shader changed.
   *
   * GPU compilation of the generated program is not verified headless: the
   * tests cover the wiring (which Filter lands on which sprite), not pixels.
   */
  resolveShaderFilter(id: string): CustomShaderFilter | undefined;
  /** Sets a tracked sprite's `.filters` to `[sharedFilter]`, or clears it — no write at all when already correct, so steady state allocates nothing. */
  private _applySpriteShader;
  /**
   * `_syncOne()`'s `Projection3D`-active branch — a real `PerspectiveMesh`
   * per entity, corners copied straight from the component, texture/tint/
   * alpha/visibility/depth kept in sync the same way `_syncOne()` keeps a
   * plain `PixiSprite` in sync. `verticesX`/`verticesY` are left at
   * `PerspectiveMesh.defaultOptions`'s own 10x10 grid — no per-entity
   * quality knob exists on `Projection3D` today.
   */
  private _syncProjected;
  /**
   * Build real tile sprites for `tilemap` and add them to `renderLayer`
   * (defaults to `"default"`). Pass an `AutoTileResolver` to resolve
   * neighbour-aware tile variants instead of drawing the raw tile indices.
   * Safe to call once per tilemap; call `unmountTilemap()` first to rebuild
   * after edits.
   */
  mountTilemap(
    tilemap: TileLayerSource,
    renderLayer?: string,
    autoTile?: AutoTileResolver,
  ): void;
  unmountTilemap(tilemap: TileLayerSource): void;
  private _buildTilemapSprites;
  private _containerFor;
  private _overlayContainer;
  /**
   * Synchronous texture lookup for `draw_sprite` (`PixiGmlDrawTarget.
   * sprite()`) — unlike `_applyTexture` above, there is no live tracked
   * `PixiSprite`/`PerspectiveMesh` to update once an async load resolves:
   * a `draw_sprite` call creates a brand-new `Sprite` fresh every dispatch
   * (GML's own semantic — it's drawn this frame, not a persistent object),
   * so there's nothing to retroactively re-texture. Returns the cached
   * texture if already loaded, otherwise kicks off the same shared
   * `_loadTexture`/`_textureCache` load-and-cache path as `_applyTexture`
   * (so a *later* `draw_sprite` call for the same path is cache-hit) and
   * returns `Texture.WHITE` for this frame only — the same "visible
   * placeholder, not a blank hole" fallback `_applyTexture` already uses
   * for an empty path.
   */
  private _resolveTextureForDraw;
  /**
   * Shared texture-apply path for both `PixiSprite` and `PerspectiveMesh` —
   * both expose a settable `.texture`, so `target` takes that minimal
   * structural shape rather than one concrete pixi class.
   */
  private _applyTexture;
  /**
   * `_syncOne()`'s `sliceMode` 1/2 branch. Mode 1 is a pixi core
   * `NineSliceSprite` (corners fixed at the `slice*` guide sizes), mode 2 a
   * `TilingSprite` (texture repeated at native scale, clipped to the box).
   * Both are sized to `Sprite.width` x `Sprite.height` in local space and
   * then scaled by `Transform.scale*`, so a scaled entity grows the whole
   * box like a plain sprite would. Anchor maps to `anchor` (tiling) or
   * `pivot` (nine-slice, which has no anchor in pixi v8).
   */
  private _syncSliced;
  private _removeSliced;
  private _removeSprite;
  private _removeMesh;
  /**
   * Drop tracking (and destroy sprites) for any overlay scene not present in
   * `active` — called every `renderFrame()` with the caller's current
   * overlay list, so an unloaded overlay's leftover sprites don't linger
   * until the next mismatched sync. `Game.unloadOverlay()` doesn't need to
   * know this class exists at all; this runs the cleanup lazily on the very
   * next `renderFrame()` after the overlay stops appearing in `overlays`.
   */
  private _pruneOverlays;
  /** Explicitly release an overlay's tracking/container — safe to call even if `renderFrame` would have pruned it anyway. */
  releaseOverlay(scene: Scene): void;
  destroy(): void;
}
