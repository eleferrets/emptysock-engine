[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneTransitionManager

# Class: SceneTransitionManager

Defined in: engine/src/systems/SceneTransition.ts:41

Scene-transition **timing** logic —
deliberately not scene registration/lifecycle. `Game.ts` already owns
real scene swapping (`loadScene()`/`loadOverlay()`/`unloadScene()`) with
its own lifecycle guarantees — this class's only job is timing a
transition's visual progress and calling a caller-supplied `load`
callback (typically `() => game.loadScene(...)`) once the transition's
midpoint duration elapses. A pause/resume scene stack, if ever wanted, is
a separate, real design question for `Game.ts` itself — not something to
bolt onto this class.

Also **not a singleton** — see CLAUDE.md's "PluginSystem, VariableStore,
LocalisationSystem, ViewportSystem, and WindowSystem are Game services"
entry for why a bare module-level singleton is a shared-mutable-state
hazard across test files. A game constructs its own
`new SceneTransitionManager()` (typically once, held by the game's own
bootstrap code, not `Game` itself — `Game.ts` has no opinion on
transitions, same as it has none on rendering).

## Constructors

### Constructor

> **new SceneTransitionManager**(): `SceneTransitionManager`

#### Returns

`SceneTransitionManager`

## Accessors

### isTransitioning

#### Get Signature

> **get** **isTransitioning**(): `boolean`

Defined in: engine/src/systems/SceneTransition.ts:59

##### Returns

`boolean`

## Methods

### attachPostProcess()

> **attachPostProcess**(`sink`): `void`

Defined in: engine/src/systems/SceneTransition.ts:55

Attach the `PostProcessSystem` instance (or anything else satisfying
`TransitionEffectSink`) whose transition fields drive
`RenderPipeline.renderTransitionOverlay()`. Optional — without it,
transitions still time and call `load` correctly, they just render as
an instant cut.

#### Parameters

##### sink

[`TransitionEffectSink`](../interfaces/TransitionEffectSink.md) \| `null`

#### Returns

`void`

***

### transition()

> **transition**(`load`, `options?`): `void`

Defined in: engine/src/systems/SceneTransition.ts:71

Begin a timed transition. `load` is called once, when `options.duration`
(default 0.3s) has elapsed since this call — typically
`() => game.loadScene(nextScene)`. Calling `transition()` again while
one is already in flight replaces the pending `load` and resets the
elapsed timer — "last call wins"; it never queues multiple pending
transitions.

#### Parameters

##### load

() => `void` \| `Promise`\<`void`\>

##### options?

[`TransitionOptions`](../interfaces/TransitionOptions.md) = `{}`

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: engine/src/systems/SceneTransition.ts:86

Call once per frame with delta-time in seconds. Fires the pending `load` and ends the transition once its duration has elapsed.

#### Parameters

##### deltaTime

`number`

#### Returns

`void`
