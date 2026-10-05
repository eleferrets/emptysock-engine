[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneRenderer

# Interface: SceneRenderer

Defined in: engine/src/Game.ts:238

the engine design notes step 7 / §12.3 — the minimal shape `Game.attachRenderer()`
needs. Deliberately a plain structural interface, not an import of the
concrete Pixi-backed `ecs/systems/RenderPipeline` — `Game.ts` must stay
inside the engine environment boundary (CLAUDE.md: "the engine package
must not import anything from the DOM"; pixi.js's renderer construction
needs a canvas) so it keeps running under the headless testing harness
with zero Pixi involvement, import included. This mirrors the pattern
documented in CLAUDE.md under "Scene transitions: SceneTransitionManager
times them, RenderPipeline paints them" — `SceneTransitionManager` drives
a `TransitionEffectSink` interface that `PostProcessSystem` satisfies
structurally, never importing pixi itself. `RenderPipeline` satisfies
`SceneRenderer` the same way here.

## Methods

### renderFrame()

> **renderFrame**(`main`, `overlays`): `void`

Defined in: engine/src/Game.ts:245

Render `main` (the currently loaded scene), then every entry of
`overlays` on top of it, in array order — array order is call order
, so the most
recently `loadOverlay()`-ed scene paints last/topmost.

#### Parameters

##### main

[`Scene`](../classes/Scene.md)

##### overlays

readonly [`Scene`](../classes/Scene.md)[]

#### Returns

`void`
