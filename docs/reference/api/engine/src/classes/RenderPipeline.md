[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderPipeline

# Class: RenderPipeline

Defined in: engine/src/systems/RenderPipeline.ts:220

Built on the `defineComponent`/`Scene.each` object model, and `Game`'s
`SceneRenderer` shape. Uses
`RenderSystem` (the raw PixiJS wrapper) and `LayerSystem` (layer-level
ordering/visibility, via `RenderSystem`'s `getLayerContainer`/
`syncLayerVisibility`).

**On PixiJS's native Render Layers, reversed
after auditing the actual code:** the original plan called for rebuilding
`LayerSystem` on PixiJS v8.7+'s `RenderLayer` API instead of the current
per-layer-`Container` approach. Auditing `RenderSystem.ts` first shows why
that doesn't help here: `RenderLayer.attach()` requires the attached
object to already have a real `Container` parent elsewhere for
transforms, and throws on `addChild()` itself — but this renderer already
writes sprites' `x`/`y` in absolute coordinates directly onto the sprite
(no nested world-transform hierarchy `RenderLayer` would decouple draw
order from), and `getLayerContainer(name)`'s callers already do
`container.addChild(pixiSprite)` directly. Swapping to `RenderLayer`
would mean reworking `RenderSystem`'s shared public API for a decoupling
this flat architecture has no actual use for. The one real bug the
original plan was chasing — `LayerSystem`'s per-entity placement map
(`addEntity`/`removeEntity`/`getEntityLayer`/`getEntityDepth`) being
raw-eid-keyed with no scene scoping — turned out to have zero real
readers anywhere in the codebase (confirmed by grep:
`getEntityLayer`/`getEntityDepth`/`getEntitiesOnLayer` are called
nowhere) — it was writing per-frame bookkeeping data that got read by
nothing, not a scoping bug actively corrupting real behavior. This class
no longer calls `addEntity`/`removeEntity` at all (dead write removed);
the layer-*level* concepts `LayerSystem` still provides (name →
index/visibility) remain real and unchanged, since `RenderSystem`
genuinely needs those for stage ordering and `syncLayerVisibility()`.

On `renderFrame(main, overlays)` it:

 1. Walks `main` for every `Transform`+`Sprite` entity via `scene.each` (the
    bulk-iteration path, the engine design notes — no per-entity Proxy
    overhead), keeps a PixiJS sprite in sync with it, and places it on
    `layer`/`depth`.
 2. Does the same for each overlay `Scene`, but into a dedicated container
    appended to the stage *after* the main scene's layer containers — Pixi
    draws children in `addChild` order, so later-appended containers paint
    on top. Overlays are synced in the array's order, i.e. call order
, so the most recently `loadOverlay()`-ed scene
    ends up topmost.
 3. Renders the frame.

**Multiple live scenes and entity id collisions**: every `Scene` owns its
The bitECS `World`, and each `World`'s entity ids independently start from
0 (see `Scene.ts`). A `Game` with a main scene plus one or more overlays
therefore has several *different* entities that all report `eid === 3`.
Tracking sprites in one flat `Map<number, PixiSprite>` would silently
alias an overlay's entity 3 onto the main scene's. This class instead keys
its sprite/texture-path tracking per `Scene` (`Map<Scene, SceneTracking>`)
— one level of scoping up from `ComponentRegistry`'s per-`World` scoping
and `PhysicsBody`'s per-`World` callback side-table (`ecs/components/PhysicsBody.ts`),
but the same underlying idea: never index directly by a raw entity id
without first scoping by which scene's world it belongs to.

That per-`Scene` scoping covers the *main* scene too, not just overlays:
`Game.unloadScene()`/`loadScene()` swap in a brand new `Scene` (a new
bitECS `World`, entity ids starting at 0 again), so a single flat
`_mainTracking` object reused across that swap would alias the old
scene's leftover Pixi sprites onto the new scene's same-numbered
entities, and leave the old sprites themselves never destroyed. `_syncMain`
tracks which `Scene` its tracking currently belongs to (`_mainScene`) and,
the moment a *different* `Scene` object is passed in, fully disposes the
previous one's tracking (`_releaseMain`, sharing the exact same per-sprite
teardown `releaseOverlay`/`_pruneOverlays` already use for overlays)
before starting fresh — main-scene tracking and overlay tracking now share
one underlying `Map<Scene, SceneTracking>`.

## Implements

- [`SceneRenderer`](../interfaces/SceneRenderer.md)

## Constructors

### Constructor

> **new RenderPipeline**(`options?`): `RenderPipeline`

Defined in: engine/src/systems/RenderPipeline.ts:271

#### Parameters

##### options?

[`RenderPipelineOptions`](../interfaces/RenderPipelineOptions.md) = `{}`

#### Returns

`RenderPipeline`

## Accessors

### activeFlashFilterCount

#### Get Signature

> **get** **activeFlashFilterCount**(): `number`

Defined in: engine/src/systems/RenderPipeline.ts:808

Flash filters currently attached (pool checked out).

##### Returns

`number`

***

### activeFlashOverlayCount

#### Get Signature

> **get** **activeFlashOverlayCount**(): `number`

Defined in: engine/src/systems/RenderPipeline.ts:824

Flash overlays currently attached.

##### Returns

`number`

***

### canvas

#### Get Signature

> **get** **canvas**(): `HTMLCanvasElement`

Defined in: engine/src/systems/RenderPipeline.ts:451

##### Returns

`HTMLCanvasElement`

***

### guiLayer

#### Get Signature

> **get** **guiLayer**(): `Container`

Defined in: engine/src/systems/RenderPipeline.ts:326

The camera-independent overlay container UI/overlay content draws into — see `RenderSystem.guiStage`'s doc comment for why it's never affected by `CameraSystem`.

##### Returns

`Container`

***

### layers

#### Get Signature

> **get** **layers**(): [`LayerSystem`](LayerSystem.md)

Defined in: engine/src/systems/RenderPipeline.ts:439

The engine's LayerSystem — call `defineLayer()` on it for custom draw order.

##### Returns

[`LayerSystem`](LayerSystem.md)

***

### renderer

#### Get Signature

> **get** **renderer**(): `Renderer`

Defined in: engine/src/systems/RenderPipeline.ts:443

##### Returns

`Renderer`

***

### stage

#### Get Signature

> **get** **stage**(): `Container`

Defined in: engine/src/systems/RenderPipeline.ts:447

##### Returns

`Container`

## Methods

### attachFonts()

> **attachFonts**(`fonts`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:285

Supplies (or clears, with `null`) the `FontRegistry` bitmap fonts are looked up in.

#### Parameters

##### fonts

[`FontRegistry`](FontRegistry.md) \| `null`

#### Returns

`void`

***

### attachLighting()

> **attachLighting**(`lighting`, `layerId?`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:481

Attach (or detach, with `null`) a `LightingSystem`. While attached,
`renderFrame()` rebuilds the lightmap for the main scene every frame
(`RenderSystem.syncLighting()`) over the camera's visible world rect
and applies it as a filter on `layerId` (default `"default"`).
Detaching removes the filter and frees the lightmap.

#### Parameters

##### lighting

[`LightingSystem`](LightingSystem.md) \| `null`

##### layerId?

`string` = `"default"`

#### Returns

`void`

***

### attachPostProcess()

> **attachPostProcess**(`postProcess`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:331

Attach (or detach, with `null`) the `PostProcessSystem` whose layer filters `renderFrame()` should keep synced onto this pipeline's layer containers.

#### Parameters

##### postProcess

[`PostProcessSystem`](PostProcessSystem.md) \| `null`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/RenderPipeline.ts:1392

#### Returns

`void`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: engine/src/systems/RenderPipeline.ts:434

Constructs the real PixiJS renderer (WebGL by default — the engine design notes
§18's audit finding: "Pixi's own guidance is still to prefer WebGL for
production"; `RenderSystem.init()` already passes
`preference: ["webgpu", "webgl"]` to `autoDetectRenderer`, i.e. it tries
WebGPU first and falls back, so WebGPU stays available as an explicit
opt-in on hosts that force it — nothing here changes that). Needs a real
DOM/canvas environment; never call this under the headless testing
harness (`createHeadlessGame()` never attaches a `RenderPipeline` at
all — see `Game.attachRenderer`/`ecs/Game.ts` step 7 — so game code
driven purely through `testing/index.ts` never reaches this call).

#### Parameters

##### options?

[`RenderPipelineOptions`](../interfaces/RenderPipelineOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### mountParticles()

> **mountParticles**(`emitter`, `layerName?`): `Promise`\<`void`\>

Defined in: engine/src/systems/RenderPipeline.ts:346

Mounts `emitter`'s particles into a real pixi `ParticleContainer` on
layer `layerName`, resynced every `renderFrame()`. Loads the emitter's
`options.texture` path through this pipeline's own texture loader (the
same cache-and-load path sprites use) — an emitter with no texture set
falls back to `Texture.WHITE`, a plain filled square, so an emitter
mounted before its real texture is ready still renders something
visible rather than nothing. Awaiting this before the emitter starts
producing particles is recommended but not required — particles that
exist before the texture resolves simply aren't drawn yet.

#### Parameters

##### emitter

[`ParticleEmitter`](ParticleEmitter.md)

##### layerName?

`string` = `"default"`

#### Returns

`Promise`\<`void`\>

***

### mountTilemap()

> **mountTilemap**(`tilemap`, `renderLayer?`, `autoTile?`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:1056

Build real tile sprites for `tilemap` and add them to `renderLayer`
(defaults to `"default"`). Pass an `AutoTileResolver` to resolve
neighbour-aware tile variants instead of drawing the raw tile indices.
Safe to call once per tilemap; call `unmountTilemap()` first to rebuild
after edits.

#### Parameters

##### tilemap

[`TileLayerSource`](../interfaces/TileLayerSource.md)

##### renderLayer?

`string` = `"default"`

##### autoTile?

[`AutoTileResolver`](../interfaces/AutoTileResolver.md)

#### Returns

`void`

***

### releaseOverlay()

> **releaseOverlay**(`scene`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:1370

Explicitly release an overlay's tracking/container — safe to call even if `renderFrame` would have pruned it anyway.

#### Parameters

##### scene

[`Scene`](Scene.md)

#### Returns

`void`

***

### renderFrame()

> **renderFrame**(`main`, `overlays?`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:513

`Game.update()` step 7's entry point (via `Game.attachRenderer(this)` —
this method is what makes `RenderPipeline` satisfy `SceneRenderer`
structurally). Syncs the main scene, then every overlay in call order,
releases tracking for any overlay no longer present in `overlays`, and
renders once.

#### Parameters

##### main

[`Scene`](Scene.md)

##### overlays?

readonly [`Scene`](Scene.md)[] = `[]`

#### Returns

`void`

#### Implementation of

[`SceneRenderer`](../interfaces/SceneRenderer.md).[`renderFrame`](../interfaces/SceneRenderer.md#renderframe)

***

### renderMultiCamera()

> **renderMultiCamera**(`viewports`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:464

Thin passthrough to `RenderSystem.renderMultiCamera()` — game code
(and the runtime) talks to `RenderPipeline`, never
the lower-level `RenderSystem` directly, so this is the real call site
for multi-view compositing. Does not itself call
`syncEntities()`/`renderFrame()` — call this *instead of*
`renderFrame()` for a frame that wants every active camera slot
composited, after the usual entity sync.

#### Parameters

##### viewports

readonly [`CameraViewport`](../interfaces/CameraViewport.md)[]

#### Returns

`void`

***

### renderTransitionOverlay()

> **renderTransitionOverlay**(`postProcess`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:551

Paints the scene-transition overlay described by `postProcess`'s
`transitionEffect`/`transitionProgress`/`transitionColour` on top of
the stage — an overlay-based approach (a single colour rect, never two
live scenes rendered simultaneously). the release notes
Track 6 / ground rule 11 confirmed a true two-scene crossfade is
technically buildable (`renderer.render({ target: renderTexture,
container })`, pixi v8's real object-form API) but deliberately did
**not** build it in this pass: it's a genuine two-full-render-pass-per-
frame cost during the transition window with no documented perf number
from pixi's own docs, and the honest way to decide "default-on vs.
opt-in" is profiling on real target devices (including lower-end
tablets, per the mobile/tablet scope) — not something a headless CI
sandbox can do. Shipping an unvalidated perf-risk rendering path
without being able to verify its cost would be worse than keeping the
proven, cheap overlay approach. Revisit once real device profiling is
actually possible.

#### Parameters

##### postProcess

[`PostProcessSystem`](PostProcessSystem.md)

#### Returns

`void`

***

### resize()

> **resize**(`width`, `height`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:470

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### resolveShaderFilter()

> **resolveShaderFilter**(`id`): [`CustomShaderFilter`](../interfaces/CustomShaderFilter.md) \| `undefined`

Defined in: engine/src/systems/RenderPipeline.ts:937

The one live Filter for a registered shader id (`undefined` when the id
isn't registered), shared by every entity/draw call using that shader —
never allocated per frame. Re-registering a shader rebuilds it; uniform
writes (`setShaderUniform`) are copied into the Filter here, and only
when the registry's version for that shader changed.

GPU compilation of the generated program is not verified headless: the
tests cover the wiring (which Filter lands on which sprite), not pixels.

#### Parameters

##### id

`string`

#### Returns

[`CustomShaderFilter`](../interfaces/CustomShaderFilter.md) \| `undefined`

***

### syncEntities()

> **syncEntities**(`scene`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:601

Sync the main scene's PixiJS sprites without rendering. Exposed for tests/custom loops.

#### Parameters

##### scene

[`Scene`](Scene.md)

#### Returns

`void`

***

### unmountParticles()

> **unmountParticles**(`emitter`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:375

Detaches and destroys `emitter`'s mounted `ParticleContainer`. Safe to call on an emitter that was never mounted (a no-op).

#### Parameters

##### emitter

[`ParticleEmitter`](ParticleEmitter.md)

#### Returns

`void`

***

### unmountTilemap()

> **unmountTilemap**(`tilemap`): `void`

Defined in: engine/src/systems/RenderPipeline.ts:1069

#### Parameters

##### tilemap

[`TileLayerSource`](../interfaces/TileLayerSource.md)

#### Returns

`void`
