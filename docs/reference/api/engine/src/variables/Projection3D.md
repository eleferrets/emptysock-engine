[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Projection3D

# Variable: Projection3D

> `const` **Projection3D**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `active`: `boolean`; `x0`: `number`; `x1`: `number`; `x2`: `number`; `x3`: `number`; `y0`: `number`; `y1`: `number`; `y2`: `number`; `y3`: `number`; \}\>

Defined in: engine/src/components/Projection3D.ts:30

Plain-data corner state for a pseudo-3D projected sprite — see
the projection compat layer and CLAUDE.md's "Pseudo-3D projection" entry for
the full mechanism. Corners are clockwise from top-left
(`x0,y0`/`x1,y1`/`x2,y2`/`x3,y3`), the exact same convention
`PerspectiveMesh.setCorners()` uses — `RenderPipeline`'s sprite-sync pass
copies these eight numbers straight into a `PerspectiveMesh` with no
reinterpretation, so this component's corner fields and
`PerspectiveMesh.setCorners()`'s eight parameters can never drift apart on
what "corner order" means.

`Serializable`-only, like every other component (`defineComponent`
rejects a function field at the type level) — the actual per-entity
transform state (`d3d_transform_set_*`'s accumulated matrix) that
*produces* these corners lives in the projection layer's own side-table, the
same "component holds the current derived result, a side-table holds the
mutable working state" split `VisualScriptState`'s evaluation scope and
`PhysicsBody`'s callbacks already use — `Projection3D` itself is just the
flat result `RenderPipeline` reads every frame.

`active: false` (the default) means "render this entity as a normal
`Sprite`, ignore these corners entirely" — `RenderPipeline._syncOne()`
only takes the `PerspectiveMesh` branch when `active` is `true`, so
attaching this component with `active: false` (or never attaching it at
all) leaves every existing sprite-rendering entity's behaviour completely
unchanged.
