[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LightSource

# Variable: LightSource

> `const` **LightSource**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `colour`: `number`; `coneAngle`: `number`; `coneDirection`: `number`; `enabled`: `boolean`; `falloff`: `number`; `intensity`: `number`; `offsetX`: `number`; `offsetY`: `number`; `radius`: `number`; \}\>

Defined in: engine/src/components/LightSource.ts:16

A point-light emitter attached to an entity. Position is read from the
entity's `Transform` (see `LightingSystem.collectLights()`) plus this
component's `offsetX`/`offsetY` — a torch prop's light sits a few pixels
above the sprite's own origin, not exactly on top of it, so the offset is
a real field rather than something a caller has to fake by nudging
`Transform` itself.

All fields are plain numbers/booleans (`Serializable`), matching every
other component in this codebase (`PhysicsBody`, `Meta`, ...) — nothing
here needs a callback or a non-serialisable field, so there's no side-table
split to do (contrast `PhysicsBody`'s collision callbacks).
