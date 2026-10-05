[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LightingSystem

# Class: LightingSystem

Defined in: engine/src/systems/LightingSystem.ts:120

Collects `LightSource` entities each frame and hands `RenderSystem` a
plain list to render. No per-entity or per-World side-table is needed —
unlike `PhysicsBody`'s callbacks or `VisualScriptState`'s evaluation scope,
every field a light needs is plain serialisable data that already lives on
the component itself, so `collectLights()` can read it straight off
`scene.each()` with nothing extra to track or clear on destroy.

## Constructors

### Constructor

> **new LightingSystem**(`options?`): `LightingSystem`

Defined in: engine/src/systems/LightingSystem.ts:125

#### Parameters

##### options?

[`LightingSystemOptions`](../interfaces/LightingSystemOptions.md) = `{}`

#### Returns

`LightingSystem`

## Properties

### ambient

> **ambient**: [`AmbientLight`](../interfaces/AmbientLight.md)

Defined in: engine/src/systems/LightingSystem.ts:121

***

### maxLights

> **maxLights**: `number`

Defined in: engine/src/systems/LightingSystem.ts:122

***

### raySamples

> **raySamples**: `number`

Defined in: engine/src/systems/LightingSystem.ts:123

## Methods

### collectLights()

> **collectLights**(`scene`, `reference?`): [`LightSample`](../interfaces/LightSample.md)[]

Defined in: engine/src/systems/LightingSystem.ts:157

Every enabled `LightSource` (with a `Transform`) in `scene`, resolved to
world position, capped at `maxLights`. When there are more live lights
than the cap, this keeps the `maxLights` lights nearest `reference`
(typically the camera/viewport centre) and drops the rest — the honest
"degrade gracefully, never crash, never silently truncate an arbitrary
subset" shape this codebase already uses elsewhere (see `QueryChannel`'s
doc comment on partial-success reporting). A disabled light or a
non-positive radius is skipped outright, the same way a light with zero
practical effect would be.

Each returned sample's `visibility` is real shadow-casting output, not
a placeholder — see `LightOcclusion.ts`'s module doc comment for the
algorithm. This method collects every enabled `LightOccluder` in
`scene` once (not once per light), then for each light spatially culls
that shared list down to only the occluders within the light's own
radius (`boxWithinReach()` — an AABB-vs-circle distance test, O(1) per
occluder) before doing any real ray work. Worst case is still
`O(lights x occluders x rays)`, same shape `renderMultiCamera()`'s own
doc comment names for its N-render-pass cost — for the "torch-lit
dungeon, 5-10 lights, dozens of wall segments" scale CLAUDE.md's
lighting entry documents as the target, this is a few thousand
ray/segment tests per frame, comfortably cheap; a scene with hundreds
of simultaneous occluded lights would need real profiling before
shipping, the same honest caveat this codebase's other N-pass features
already carry rather than pretending is free.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### reference?

###### x

`number`

###### y

`number`

#### Returns

[`LightSample`](../interfaces/LightSample.md)[]
