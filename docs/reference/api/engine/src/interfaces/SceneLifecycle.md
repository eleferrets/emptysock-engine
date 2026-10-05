[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneLifecycle

# Interface: SceneLifecycle

Defined in: engine/src/Game.ts:70

What a loaded scene gets handed for the lifetime of that load.

## Properties

### actors

> `readonly` **actors**: [`ActorSystem`](../classes/ActorSystem.md)

Defined in: engine/src/Game.ts:72

***

### assets

> `readonly` **assets**: [`AssetRegistry`](../classes/AssetRegistry.md)

Defined in: engine/src/Game.ts:110

Game-owned typed asset lookup (sprite sizes, font sizes, asset existence) loaded from the asset pipeline's `asset-index.json`. See `systems/AssetRegistry.ts`.

***

### audio

> `readonly` **audio**: [`AudioSystem`](../classes/AudioSystem.md)

Defined in: engine/src/Game.ts:84

Game-owned, same reasoning as `input` — music/sfx commonly outlive a scene transition.

***

### fonts

> `readonly` **fonts**: [`FontRegistry`](../classes/FontRegistry.md)

Defined in: engine/src/Game.ts:108

Game-owned, same reasoning as `globals` — one `FontRegistry` for the lifetime of this `Game`, a real component for working with fonts. See `systems/FontRegistry.ts`'s own doc comment.

***

### globals

> `readonly` **globals**: [`GlobalStore`](../classes/GlobalStore.md)

Defined in: engine/src/Game.ts:104

Game-owned, same reasoning as `audio`/`input`/`variables` — one
`GlobalStore` for the lifetime of this `Game`. This is the real target
for `global.x = expr` semantic (arbitrary named,
arbitrary-typed values reachable from anywhere) — see
`systems/GlobalStore.ts`'s own doc comment for why it's a distinct
service from `variables` rather than reusing `VariableStore`'s
numbered, integer-only shape.

***

### input

> `readonly` **input**: [`InputManager`](../classes/InputManager.md)

Defined in: engine/src/Game.ts:82

Game-owned, not scene-owned (unlike `actors`/`physics`): one
`InputManager` persists across every scene load for the lifetime of the
`Game`, because raw device state (which keys are held down) has no
relationship to which scene happens to be loaded. Handed here purely
for convenience so scene code doesn't need a separate reference to the
owning `Game`.

***

### localisation

> `readonly` **localisation**: [`LocalisationSystem`](../classes/LocalisationSystem.md)

Defined in: engine/src/Game.ts:124

Game-owned, same reasoning as `plugins`/`variables` — one
`LocalisationSystem` for the lifetime of this `Game`, so a locale change
made from a settings menu in one scene is visible to every other scene's
UI text without threading a reference through scene boundaries.

***

### physics

> `readonly` **physics**: [`PhysicsSystem`](../classes/PhysicsSystem.md)

Defined in: engine/src/Game.ts:73

***

### plugins

> `readonly` **plugins**: [`PluginSystem`](../classes/PluginSystem.md)

Defined in: engine/src/Game.ts:117

Game-owned, same reasoning as `audio`/`input`/`variables` — one
`PluginSystem` for the lifetime of this `Game`. Equivalent to
`game.services.get(PluginSystem)`, handed here for convenience so scene
code doesn't need a separate reference to the owning `Game`.

***

### scene

> `readonly` **scene**: [`Scene`](../classes/Scene.md)

Defined in: engine/src/Game.ts:71

***

### signals

> `readonly` **signals**: [`SignalBus`](../classes/SignalBus.md)

Defined in: engine/src/Game.ts:106

Game-owned signal/broadcast bus — see `systems/SignalBus.ts`.

***

### variables

> `readonly` **variables**: [`VariableStore`](../classes/VariableStore.md)

Defined in: engine/src/Game.ts:94

Game-owned, same reasoning as `audio`/`input` — the one canonical
`VariableStore` for the lifetime of this `Game`, shared across every
scene unless a system is deliberately constructed with its own isolated
instance instead (e.g. `new VNSystem(new VariableStore())` for a
self-contained minigame). Pass this to `VNSystem`/`MapEventSystem`
constructors that need the shared switches/variables a save-gated
dialogue tree or map trigger expects.

***

### viewport

> `readonly` **viewport**: [`ViewportSystem`](../classes/ViewportSystem.md)

Defined in: engine/src/Game.ts:134

Game-owned, same reasoning as `plugins`/`variables`/`localisation` —
one `ViewportSystem` for the lifetime of this `Game`, since there is
normally exactly one canvas/viewport for the whole running game,
regardless of which scene happens to be loaded. Call
`ctx.viewport.init({ designWidth, designHeight, scaleMode }, { renderTarget, cameraSystem })`
once (typically from the `startScene`'s `onLoad`) to start automatic
resize/scale handling.

***

### window

> `readonly` **window**: [`WindowSystem`](../classes/WindowSystem.md)

Defined in: engine/src/Game.ts:140

Game-owned, same reasoning as `viewport` — one OS window for the whole
running desktop app (a no-op on platforms without a Tauri window, per
`WindowSystem`'s own runtime Tauri-detection guard).

## Methods

### restoreCarried()

> **restoreCarried**(): [`EntityIdMap`](EntityIdMap.md) \| `undefined`

Defined in: engine/src/Game.ts:149

Respawns the entities `loadScene(def, { carry })` captured from the
outgoing scene into this one and returns the old-id to new-entity map, or
`undefined` when nothing was carried (or it was already restored). Call it
first thing in `onLoad`, before spawning the scene's own entities:
carried entities exist before the new scene's, and there is no automatic
restore so the ordering stays visible to the scene author. Synchronous.

#### Returns

[`EntityIdMap`](EntityIdMap.md) \| `undefined`

***

### restoreRoom()

> **restoreRoom**(): [`EntityIdMap`](EntityIdMap.md) \| `undefined`

Defined in: engine/src/Game.ts:157

For a scene with a `persistentKey`: if a cached state exists from a
previous visit, respawns it (consuming the cache entry) and returns the
old-id map; the scene should then skip its own initial population. Returns
`undefined` on the first visit and after a restart, when the scene should
populate itself normally. Call after `restoreCarried()`.

#### Returns

[`EntityIdMap`](EntityIdMap.md) \| `undefined`
