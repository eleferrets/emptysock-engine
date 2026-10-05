[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Game

# Class: Game

Defined in: engine/src/Game.ts:393

## Constructors

### Constructor

> **new Game**(`options?`): `Game`

Defined in: engine/src/Game.ts:441

#### Parameters

##### options?

`GameOptions` = `{}`

#### Returns

`Game`

## Properties

### services

> `readonly` **services**: [`ServiceRegistry`](ServiceRegistry.md)

Defined in: engine/src/Game.ts:430

the engine design notes — process-global for the lifetime of this `Game`
instance, constructed once here (not per-scene, unlike `actors`/
`physics` in `SceneLifecycle`) and never reset by `loadScene`/
`unloadScene`. `PluginSystem` and `VariableStore` are registered here in
the constructor as the first two real services — see `Services.ts`.

***

### instances

> `readonly` `static` **instances**: `Set`\<`Game`\>

Defined in: engine/src/Game.ts:407

Every live `Game` instance, in construction order. Pure in-memory
bookkeeping — no DOM, no globals, nothing that violates the engine
environment boundary — so a headless/Node `Game` is unaffected. This
exists so host code that doesn't own the `new Game()` call (the IDE's
preview iframe bootstrap script, which runs alongside arbitrary game
code it never wrote) has a documented way to find the game instance
the user's own code just created, instead of requiring every game to
opt in to some IDE-specific registration call. See
`ecs/bridge/QueryChannel.ts`'s doc comment for the other half: the host
is expected to `new QueryChannel().attach(game.currentScene, ...)`
once it finds a `Game` here, not the other way around.

## Accessors

### assets

#### Get Signature

> **get** **assets**(): [`AssetRegistry`](AssetRegistry.md)

Defined in: engine/src/Game.ts:529

The `Game`'s single `AssetRegistry` — see that class's own doc comment.

##### Returns

[`AssetRegistry`](AssetRegistry.md)

***

### audio

#### Get Signature

> **get** **audio**(): [`AudioSystem`](AudioSystem.md)

Defined in: engine/src/Game.ts:490

The `Game`'s single `AudioSystem` (§18 — Howler-backed).

##### Returns

[`AudioSystem`](AudioSystem.md)

***

### currentScene

#### Get Signature

> **get** **currentScene**(): [`Scene`](Scene.md) \| `null`

Defined in: engine/src/Game.ts:798

##### Returns

[`Scene`](Scene.md) \| `null`

***

### fonts

#### Get Signature

> **get** **fonts**(): [`FontRegistry`](FontRegistry.md)

Defined in: engine/src/Game.ts:534

The `Game`'s single `FontRegistry` — see that class's own doc comment.

##### Returns

[`FontRegistry`](FontRegistry.md)

***

### globals

#### Get Signature

> **get** **globals**(): [`GlobalStore`](GlobalStore.md)

Defined in: engine/src/Game.ts:524

##### Returns

[`GlobalStore`](GlobalStore.md)

***

### input

#### Get Signature

> **get** **input**(): [`InputManager`](InputManager.md)

Defined in: engine/src/Game.ts:485

The `Game`'s single `InputManager`. Call
`game.input.attach()` from browser/Tauri bootstrap code to start
listening to real device events — `Game` itself never calls `attach()`,
so a headless/Node `Game` never touches `window` (CLAUDE.md's
engine-environment-boundary rule).

##### Returns

[`InputManager`](InputManager.md)

***

### lifecycle

#### Get Signature

> **get** **lifecycle**(): [`SceneLifecycle`](../interfaces/SceneLifecycle.md) \| `null`

Defined in: engine/src/Game.ts:802

##### Returns

[`SceneLifecycle`](../interfaces/SceneLifecycle.md) \| `null`

***

### overlays

#### Get Signature

> **get** **overlays**(): readonly [`SceneLifecycle`](../interfaces/SceneLifecycle.md)[]

Defined in: engine/src/Game.ts:794

Currently loaded overlays, oldest (bottom of the stack) first.

##### Returns

readonly [`SceneLifecycle`](../interfaces/SceneLifecycle.md)[]

***

### restarting

#### Get Signature

> **get** **restarting**(): `boolean`

Defined in: engine/src/Game.ts:517

`true` while a `loadScene({ restart: "game" })` is unloading the outgoing scene.

##### Returns

`boolean`

***

### roomCache

#### Get Signature

> **get** **roomCache**(): [`RoomStateCache`](RoomStateCache.md)

Defined in: engine/src/Game.ts:512

Cached state of persistent rooms (`SceneDefinition.persistentKey`).

##### Returns

[`RoomStateCache`](RoomStateCache.md)

***

### signals

#### Get Signature

> **get** **signals**(): [`SignalBus`](SignalBus.md)

Defined in: engine/src/Game.ts:521

##### Returns

[`SignalBus`](SignalBus.md)

## Methods

### attachRenderer()

> **attachRenderer**(`renderer`): `void`

Defined in: engine/src/Game.ts:469

Wire a concrete renderer (the real `ecs/systems/RenderPipeline`, or a
test double) into step 7 of `update()`. Never called by the headless
testing harness — a `Game`/`HeadlessGame` with no renderer attached (the
default) already makes step 7 a no-op with nothing extra to configure;
`attachRenderer` exists for the host app (browser preview, Tauri
WebView) to call once, after constructing the renderer against its own
canvas.

#### Parameters

##### renderer

[`SceneRenderer`](../interfaces/SceneRenderer.md)

#### Returns

`void`

***

### detachRenderer()

> **detachRenderer**(): `void`

Defined in: engine/src/Game.ts:474

Undo `attachRenderer` — step 7 goes back to a no-op.

#### Returns

`void`

***

### loadOverlay()

> **loadOverlay**(`definition`, `options?`): `Promise`\<[`SceneLifecycle`](../interfaces/SceneLifecycle.md)\>

Defined in: engine/src/Game.ts:714

the engine design notes — stack an additional, independently-lifecycled
scene on top of whatever `loadScene()` currently has loaded (a HUD,
pause menu, minimap). Unlike `loadScene`, this never tears anything
down first: multiple overlays stack, in call order, and an overlay
survives the main scene being reloaded underneath it (`loadScene`
only ever touches `this._current`, never `this._overlays`).

Gets its own `ActorSystem` (same "one per scene" guarantee as the main
scene, CLAUDE.md's "One ActorSystem per scene" decision, carried over
here). Gets a `PhysicsSystem` too, for `SceneLifecycle`'s shape to stay
uniform with `loadScene`'s — but it is **not** `.init()`-ed unless the
caller passes `options.physics` explicitly, so it never steps and never
costs a WASM physics world for the common HUD-only case ("no
PhysicsSystem by default, since a HUD doesn't need one").

#### Parameters

##### definition

[`SceneDefinition`](../interfaces/SceneDefinition.md)

##### options?

[`LoadOverlayOptions`](../interfaces/LoadOverlayOptions.md) = `{}`

#### Returns

`Promise`\<[`SceneLifecycle`](../interfaces/SceneLifecycle.md)\>

***

### loadScene()

> **loadScene**(`definition`, `options?`): `Promise`\<[`SceneLifecycle`](../interfaces/SceneLifecycle.md)\>

Defined in: engine/src/Game.ts:545

Load a scene: creates its `Scene` (bitECS world), its `ActorSystem` and
`PhysicsSystem` (unless `manageLifecycle: false`), and calls the
definition's `onLoad`. If a scene is already loaded, it is unloaded
first via `unloadScene()` — same "engine owns it" guarantee applies to
the outgoing scene.

#### Parameters

##### definition

[`SceneDefinition`](../interfaces/SceneDefinition.md)

##### options?

[`LoadSceneOptions`](../interfaces/LoadSceneOptions.md) = `{}`

#### Returns

`Promise`\<[`SceneLifecycle`](../interfaces/SceneLifecycle.md)\>

***

### unloadOverlay()

> **unloadOverlay**(`scene?`): `Promise`\<`void`\>

Defined in: engine/src/Game.ts:770

Tear down an overlay scene: calls its `onUnload`, then destroys its
`ActorSystem`/`PhysicsSystem` (unless it was loaded with
`manageLifecycle: false`) — same unconditional-teardown guarantee as
`unloadScene()`. With no argument, unloads the most-recently-loaded
overlay (LIFO, matching the "stack" framing); pass a specific overlay's
`Scene` (from the `SceneLifecycle` `loadOverlay()` returned) to unload
one out of order, e.g. closing a pause menu while a toast overlay
loaded after it stays up. No-op if that scene isn't a currently loaded
overlay (already unloaded, or never was one).

#### Parameters

##### scene?

[`Scene`](Scene.md)

#### Returns

`Promise`\<`void`\>

***

### unloadScene()

> **unloadScene**(): `Promise`\<`void`\>

Defined in: engine/src/Game.ts:640

Tear down the currently loaded scene: calls `onUnload`, then destroys
the scene's `ActorSystem`/`PhysicsSystem` — unconditionally, before
`onUnload` finishes matters less than that it happens at all, so this
always runs the teardown even if `onUnload` throws. No-op if
`manageLifecycle: false` was passed to `loadScene` — the caller owns
those systems and is responsible for destroying them itself.

#### Returns

`Promise`\<`void`\>

***

### update()

> **update**(`dt`): `void`

Defined in: engine/src/Game.ts:839

Runs the fixed, one-phase-per-frame update order from the engine design notes
§4:

1. Input snapshot (§15.3) — `this._input.snapshot()`, unconditional and
   first, even if no scene is loaded. Copies live device state into a
   frozen snapshot that every `input.isDown()`/`input.keyboard`/
   `input.gamepad()`/`input.pointers`/`input.gestures`/
   `input.wheelEvents` read for the rest of this frame, including
   everything steps 2–7 below do — see `InputManager.snapshot`.
2. Actor mailbox flush + actor `update()` (unchanged actor-mailbox semantics —
   drain every inbox before any actor's `update()` runs).
3–4. Physics step + collision/sensor dispatch — delegated to
   `PhysicsSystem.step()`, which is Track 1 scope; Track 0 only
   guarantees the system exists and is destroyed correctly.
5. The scene definition's `onUpdate(dt)`.
6. Camera/viewport resolve — Track 1/2 scope, no-op here.
7. Render — the main scene, then any active overlays on top of it, in
   call order. A no-op if no renderer is
   attached (`attachRenderer()`), or if the currently loaded scene was
   loaded with `headless: true` — the headless testing harness relies on
   this to never construct or touch a real Pixi renderer.

Overlays run steps 2-5 too — their own `ActorSystem` mailbox flush, their
The physics step (steps 3-4, only if `loadOverlay({ physics })` actually
initialized one — the common HUD-only overlay's inert default
`PhysicsSystem` stays unstepped, §12.3: "no PhysicsSystem by default"),
and their own `onUpdate(dt)` — right after the main scene's, in call
order, so HUD/menu logic keeps ticking every frame exactly like a normal
scene's does. Both the main scene and every overlay run this same
per-frame sequence through the shared `runFrame()` helper below, gated
only by each `LoadedScene`'s own `physicsEnabled` flag.

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### create()

> `static` **create**(`options?`): `Game`

Defined in: engine/src/Game.ts:456

Equivalent to `new Game(options)` — reads better at a call site than `new`.

#### Parameters

##### options?

`GameOptions` = `{}`

#### Returns

`Game`
