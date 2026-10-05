[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderSystem

# Class: RenderSystem

Defined in: engine/src/systems/RenderSystem.ts:148

## Constructors

### Constructor

> **new RenderSystem**(): `RenderSystem`

#### Returns

`RenderSystem`

## Accessors

### canvas

#### Get Signature

> **get** **canvas**(): `HTMLCanvasElement`

Defined in: engine/src/systems/RenderSystem.ts:946

##### Returns

`HTMLCanvasElement`

***

### guiStage

#### Get Signature

> **get** **guiStage**(): `Container`

Defined in: engine/src/systems/RenderSystem.ts:957

Camera-independent overlay container — a sibling of `stage`, never a
descendant of it, so `CameraSystem.attach(stage)`'s pan/zoom/rotate
writes to `stage` never reach anything mounted here. See `_guiStage`'s
doc comment.

##### Returns

`Container`

***

### hasRenderer

#### Get Signature

> **get** **hasRenderer**(): `boolean`

Defined in: engine/src/systems/RenderSystem.ts:931

`true` once `init()` has built the pixi renderer.

##### Returns

`boolean`

***

### renderer

#### Get Signature

> **get** **renderer**(): `Renderer`

Defined in: engine/src/systems/RenderSystem.ts:935

##### Returns

`Renderer`

***

### stage

#### Get Signature

> **get** **stage**(): `Container`

Defined in: engine/src/systems/RenderSystem.ts:941

##### Returns

`Container`

## Methods

### addLayerShader()

> **addLayerShader**(`layerName`, `shaderId`): [`CustomShaderFilter`](../interfaces/CustomShaderFilter.md) \| `undefined`

Defined in: engine/src/systems/RenderSystem.ts:415

Attaches a shader registered via `registerShader` (what an
generated `assets/<name>.shader.ts` does on import) to a layer's
container as a real per-layer Filter. The asset pipeline's sprite-quad vertex
stage is adapted to pixi's filter contract (`adaptVertex`, same
substitution the per-entity `Sprite.shader` path uses), so the quad no
longer collapses. Returns the filter (pass it to
`removeLayerShaderFilter` to detach), or `undefined` for an unregistered
id. `shader_set_uniform_*` writes made later are copied in by
`syncLayerShaders()`, which `render()` calls each frame.

#### Parameters

##### layerName

`string`

##### shaderId

`string`

#### Returns

[`CustomShaderFilter`](../interfaces/CustomShaderFilter.md) \| `undefined`

***

### addLayerShaderFilter()

> **addLayerShaderFilter**(`layerName`, `filter`): `void`

Defined in: engine/src/systems/RenderSystem.ts:360

Attach a custom shader filter (e.g. from `createCustomShaderFilter()`)
to a layer's container. This is the real counterpart to the ShaderEditor
IDE panel's live preview — the same Filter instance a shader authored
there produces is what gets attached here.

#### Parameters

##### layerName

`string`

##### filter

`Filter`

#### Returns

`void`

***

### clearLighting()

> **clearLighting**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:799

Detach and destroy whatever `syncLighting()` built. Call from scene teardown if a scene turns lighting off entirely.

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:976

#### Returns

`void`

***

### getLayerContainer()

> **getLayerContainer**(`layerName?`): `Container`

Defined in: engine/src/systems/RenderSystem.ts:283

Return the PixiJS Container for a given layer name. Creates it if it does
not yet exist (e.g. a layer was defined after init). Falls back to the
default container when no LayerSystem is active.

#### Parameters

##### layerName?

`string` = `"default"`

#### Returns

`Container`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: engine/src/systems/RenderSystem.ts:202

#### Parameters

##### options?

[`RenderSystemOptions`](../interfaces/RenderSystemOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### removeLayerShaderFilter()

> **removeLayerShaderFilter**(`layerName`, `filter`): `void`

Defined in: engine/src/systems/RenderSystem.ts:447

Detach a previously attached shader filter from a layer's container.

#### Parameters

##### layerName

`string`

##### filter

`Filter`

#### Returns

`void`

***

### render()

> **render**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:963

#### Returns

`void`

***

### renderMultiCamera()

> **renderMultiCamera**(`viewports`): `void`

Defined in: engine/src/systems/RenderSystem.ts:855

Real multi-camera compositing: renders the *same*
`_stage` content once per active viewport (each pass using that
viewport's own position/zoom/rotation, the exact convention
`CameraSystem.update()` already writes to `_stage` — `stage.x =
-viewport.x`, `.y = -viewport.y`, `.scale = viewport.zoom`, `.rotation =
viewport.rotation`, so a single-camera game and a multi-camera one agree
on what "camera position" means) into that viewport's own offscreen
`RenderTexture` (pixi v8's real object-form `renderer.render({
container, target })` API — the same one CLAUDE.md's
`SceneTransitionManager` entry already names as real and available, and
the one `syncLighting()` above already uses for its lightmap pass), then
draws every one of those textures as a plain `Sprite` quad positioned at
that viewport's own screen rectangle (`screenX`/`screenY`/
`screenWidth`/`screenHeight`) in one final pass straight to the real
canvas.

This is genuinely opt-in: it mutates `_stage`'s transform only for the
duration of its own per-viewport render passes, restoring exactly what
was there before returning — a `CameraSystem` driving the ordinary
single-camera `render()` path never sees any effect from a call here,
and `render()` itself is completely untouched by this method's
existence. Call this instead of `render()` for a frame that wants
multiple-simultaneous-view-slot rendering (see
the compat layer's `buildActiveCameraViewports()`, which
produces the `viewports` array this method expects); call `render()` as
before for the ordinary single-camera case.

One `RenderTexture`/`Sprite` pair is cached per viewport `id` and reused
across calls (resized only when that viewport's `viewWidth`/`viewHeight`
actually changed) — the same "don't reallocate a GPU resource every
frame" discipline `_lightMapTexture`/`_postProcessFilters` already
follow. A viewport id that stops appearing in `viewports` (camera
disabled, view slot turned off) has its cached texture/sprite destroyed
and dropped on the next call, not left leaking.

A real N-full-render-pass-per-frame cost, same caveat
`SceneTransitionManager`'s and this file's own `syncLighting()`'s doc
comments already raise: bounded by how many camera slots a game
actually activates at once, not fixed 8-slot ceiling, but
still needs real device profiling before a game leans on many
simultaneous cameras — this method does not attempt that profiling.

#### Parameters

##### viewports

readonly [`CameraViewport`](../interfaces/CameraViewport.md)[]

#### Returns

`void`

***

### resize()

> **resize**(`width`, `height`): `void`

Defined in: engine/src/systems/RenderSystem.ts:972

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setLayerSystem()

> **setLayerSystem**(`ls`): `void`

Defined in: engine/src/systems/RenderSystem.ts:244

Attach a LayerSystem. May be called after init(). When set, entities
should be added to the container returned by getLayerContainer() rather
than directly to stage.

#### Parameters

##### ls

[`LayerSystem`](LayerSystem.md)

#### Returns

`void`

***

### syncLayerOffsets()

> **syncLayerOffsets**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:345

Synchronise layer container position from `LayerSystem.getOffset()` —
the real render-side half of `layer_x`/`layer_y` compat
functions. A layer with no offset ever set reads
`{ x: 0, y: 0 }` (`LayerSystem.getOffset()`'s own default), so an
offset-free scene renders byte-identical to before this existed. Call
once per frame alongside `syncLayerVisibility()`.

#### Returns

`void`

***

### syncLayerShaders()

> **syncLayerShaders**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:438

Re-copies registry uniform values into every filter `addLayerShader` attached, only when that shader's registry version changed.

#### Returns

`void`

***

### syncLayerVisibility()

> **syncLayerVisibility**(): `void`

Defined in: engine/src/systems/RenderSystem.ts:330

Synchronise layer container visibility from LayerSystem state. Call once
per frame (or on demand) after setVisible() calls.

#### Returns

`void`

***

### syncLighting()

> **syncLighting**(`lighting`, `scene`, `layerId`, `viewport`): `void`

Defined in: engine/src/systems/RenderSystem.ts:736

Real 2D dynamic point lighting — see CLAUDE.md's "LightingSystem: real
2D point lights via a baked lightmap, not a hand-rolled shader" entry
for the full rationale. `LightingSystem` (framework-agnostic) decides
*which* lights are live; this method is the one place that turns them
into pixels, following the exact split `syncPostProcessLayerFilters`
already established (a framework-agnostic system feeds a plain options
object, `RenderSystem` builds/reuses the real pixi objects).

The technique: every light is drawn as a set of concentric, additively
blended filled circles (`Graphics.circle().fill()`, outer ring first,
each ring's alpha the *increment* of a `(1 - t)^falloff` intensity curve
between it and the next ring in) into an offscreen `RenderTexture` sized
to `viewport` — the "lightmap". `pixi-filters`' real `SimpleLightmapFilter`
(already an engine dependency, already used for PostProcessSystem's
`outline` mapping) is then attached to `layerId` via the same
`addLayerShaderFilter()` every other post-process filter in this file
uses; its shader does `sceneColour * (ambientColour * ambientLevel +
lightmap.rgb)` — read straight from its own real WGSL source — which is
exactly "pitch black except lit areas" at `ambient.level = 0` and "no
darkness at all" at `ambient.level = 1`.

Concentric rings rather than a `FillGradient` radial fill: `FillGradient`
bakes its gradient into a texture the first time it's used, and that
path has not been verified to run under the headless Node/Vitest harness
(no confirmed canvas-free code path) — concentric `Graphics.circle()`
calls are the same primitive the compat layer's `draw_circle` and
`RenderPipeline`'s scene-transition overlay already use, so this stays
on a rendering primitive this codebase has already verified works
headless. One `RenderTexture` and one lightmap `Container` are built
once and reused/resized across calls, the same "don't reallocate a GPU
resource every frame" discipline `_postProcessFilters` already follows;
the per-light `Graphics` objects are rebuilt from scratch every call
(the same "simplicity over per-frame allocation cost" tradeoff
`ParticleEmitter`'s pixi wiring already accepts).

`viewport` is the world-space rect the lightmap should cover — normally
the camera's visible area. Lights outside it still count toward
`LightingSystem.maxLights`'s nearest-N cap (`collectLights()` doesn't
know about the viewport rect, only a reference point) but contribute
nothing to a lightmap that doesn't cover them, which is the correct,
honest behaviour — a light fully offscreen has no visible effect to fake.

#### Parameters

##### lighting

[`LightingSystem`](LightingSystem.md)

##### scene

[`Scene`](Scene.md)

##### layerId

`string`

##### viewport

###### height

`number`

###### width

`number`

###### x

`number`

###### y

`number`

#### Returns

`void`

***

### syncPostProcessLayerFilters()

> **syncPostProcessLayerFilters**(`postProcess`): `void`

Defined in: engine/src/systems/RenderSystem.ts:475

Reads `postProcess.layerFilters` and applies the real PixiJS filter for
each entry to that layer's container, per the effect-to-library mapping
decided in the release notes Track 0's scope-hardening section: `blur` →
pixi.js core's `BlurFilter`; `brightness`/`contrast`/`saturate`/
`hue-rotate`/`invert`/`colour-grade`/`colourblind` → pixi.js core's
`ColorMatrixFilter` (colourblind reuses `PostProcessSystem`'s own
Brettel/Viénot/Machado simulation matrices via `.multiply()`, the exact
same coefficients the CSS/SVG fallback in `cssFilterForLayer()` uses);
`outline` → `pixi-filters`' `OutlineFilter`. `cssFilterForLayer()` is
untouched and still exists for hosts (the browser preview iframe) that
render a layer as a DOM element rather than a PixiJS container.

One filter instance per layer id is built once and reused across calls
— call this every frame from `render()`'s caller; it does not rebuild a
filter unless the layer's filter *type* actually changed, and layers
whose filter was cleared or disabled since the last call get their
filter detached.

#### Parameters

##### postProcess

[`PostProcessSystem`](PostProcessSystem.md)

#### Returns

`void`

***

### warnIfGlOnlyFilter()

> **warnIfGlOnlyFilter**(`filter`): `void`

Defined in: engine/src/systems/RenderSystem.ts:378

Logs ONE clear warning (per RenderSystem) when the active renderer is
WebGPU and `filter` carries only a GL program: pixi skips such a filter
under WebGPU, so it would otherwise silently render nothing. Called for
every layer filter attach and by `RenderPipeline` for per-entity shaders.

#### Parameters

##### filter

`Filter`

#### Returns

`void`
