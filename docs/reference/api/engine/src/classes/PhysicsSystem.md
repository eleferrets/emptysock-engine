[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsSystem

# Class: PhysicsSystem

Defined in: engine/src/systems/PhysicsSystem.ts:98

`PhysicsSystem` (ECS core) — wraps Rapier2D behind `PhysicsBody` (the engine design notes
§6). One instance per scene, created/destroyed by `Game.loadScene`/
`unloadScene` (§4) unless `manageLifecycle: false` is passed.

Fixed timestep + interpolation (§10.3): `update(scene, dt)` accumulates
real frame time and steps Rapier at exactly `fixedTimestep` seconds per
step, however many (zero or more) that frame's `dt` calls for. Between
steps it keeps the previous and current post-step transform for every
registered body, and exposes `interpolationAlpha` (0..1, how far into the
*next* step the current render frame falls) plus `getInterpolatedTransform`
so a renderer can lerp `previous -> current` by `alpha` instead of
snapping bodies to whatever position the last physics step left them at —
this is the API surface the Rendering track consumes; this track does not
wire it into an actual renderer.

## Constructors

### Constructor

> **new PhysicsSystem**(): `PhysicsSystem`

#### Returns

`PhysicsSystem`

## Accessors

### interpolationAlpha

#### Get Signature

> **get** **interpolationAlpha**(): `number`

Defined in: engine/src/systems/PhysicsSystem.ts:136

How far (0..1) the current render frame sits between the last two physics steps.

##### Returns

`number`

***

### world

#### Get Signature

> **get** **world**(): `World`

Defined in: engine/src/systems/PhysicsSystem.ts:130

##### Returns

`World`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/PhysicsSystem.ts:419

the engine design notes PhysicsSystem3D-must-be-destroyed decision (CLAUDE.md)
applies here too: Rapier allocates its world/body buffers in WASM linear
memory outside the JS heap, invisible to the GC. Always call this when a
scene unloads.

#### Returns

`void`

***

### getBodyState()

> **getBodyState**(`entity`): [`BodyState2D`](../interfaces/BodyState2D.md) \| `undefined`

Defined in: engine/src/systems/PhysicsSystem.ts:396

Live Rapier state for a registered `PhysicsBody`, straight off the
rigid body — the primitive `physics_body_state` in `emptysock-mcp`
wraps. `undefined` means "this entity has no registered body" (not yet
stepped, wrong entity, dead handle) — a real, meaningful absence, not
the "no world at all" case `PhysicsNotInitializedError` covers.

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

[`BodyState2D`](../interfaces/BodyState2D.md) \| `undefined`

***

### getInterpolatedTransform()

> **getInterpolatedTransform**(`entity`, `alpha?`): `Snapshot`

Defined in: engine/src/systems/PhysicsSystem.ts:141

Linearly interpolated transform for a registered body, for rendering.

#### Parameters

##### entity

[`Entity`](Entity.md)

##### alpha?

`number` = `...`

#### Returns

`Snapshot`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: engine/src/systems/PhysicsSystem.ts:109

#### Parameters

##### options?

[`PhysicsSystemOptions`](../interfaces/PhysicsSystemOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### overlapCircle()

> **overlapCircle**(`center`, `radius`): [`Entity`](Entity.md)[]

Defined in: engine/src/systems/PhysicsSystem.ts:372

All registered entities whose collider overlaps a circle at `center`
with radius `radius` (the engine design notes's `overlapCircle2d` query
primitive). Empty array is a real "nothing overlapping" result;
`PhysicsNotInitializedError` is the "no world to query" case.

#### Parameters

##### center

`Vec2`

##### radius

`number`

#### Returns

[`Entity`](Entity.md)[]

***

### raycast()

> **raycast**(`origin`, `direction`, `maxToi?`, `solid?`): [`RaycastHit2D`](../interfaces/RaycastHit2D.md) \| `null`

Defined in: engine/src/systems/PhysicsSystem.ts:340

Cast a ray into the world and return the first collider it hits, mapped
back to the registered `Entity` that owns it (the engine design notes — the
primitive the MCP query bridge's `raycast2d` query wraps). `null` means
a real "nothing along this ray" result, distinct from the
`PhysicsNotInitializedError` thrown when there is no world to query at
all — callers (the query bridge in particular) must not conflate the
two into a single "empty" shape.

#### Parameters

##### origin

`Vec2`

##### direction

`Vec2`

##### maxToi?

`number` = `1000`

##### solid?

`boolean` = `true`

#### Returns

[`RaycastHit2D`](../interfaces/RaycastHit2D.md) \| `null`

***

### update()

> **update**(`scene`, `dt`): `void`

Defined in: engine/src/systems/PhysicsSystem.ts:165

Advance the simulation by `dt` real seconds: registers any new
`PhysicsBody`s found on `scene`, steps Rapier zero or more times at the
fixed timestep, and dispatches collision/sensor callbacks after each
step. Called from `Game.update()`.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### dt

`number`

#### Returns

`void`
