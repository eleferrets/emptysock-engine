[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LoadOverlayOptions

# Interface: LoadOverlayOptions

Defined in: engine/src/Game.ts:205

the engine design notes — options for `Game.loadOverlay()`. Deliberately a
narrower surface than `LoadSceneOptions`: an overlay has no `physics` field
unless the caller opts in, because "no PhysicsSystem by default, since a
HUD doesn't need one" is the whole point of overlays being a separate call
from `loadScene`.

## Properties

### headless?

> `optional` **headless?**: `boolean`

Defined in: engine/src/Game.ts:221

Same as `LoadSceneOptions.headless` — set only by the testing harness.

***

### manageLifecycle?

> `optional` **manageLifecycle?**: `boolean`

Defined in: engine/src/Game.ts:207

Same escape hatch as `LoadSceneOptions.manageLifecycle`. Default `true`.

***

### physics?

> `optional` **physics?**: [`PhysicsSystemOptions`](PhysicsSystemOptions.md)

Defined in: engine/src/Game.ts:219

Opt-in only. Omitted (the common case), this overlay's `PhysicsSystem`
is constructed but never `.init()`-ed — inert, not stepped by
`Game.update()`, present only so `SceneLifecycle`'s shape stays uniform
between `loadScene` and `loadOverlay`. Pass this if an overlay genuinely
needs its own physics world (rare — most overlays are HUD/menu chrome).
When passed, `Game.update()` now actually steps this overlay's physics
world every frame alongside its actor/onUpdate treatment (Finding 7,
engine code-quality pass) — the caller no longer has to drive it
manually from their own `onUpdate`.
