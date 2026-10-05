# LightingSystem

Real 2D dynamic point/spot lights with shadow-casting occlusion. Data collection is framework-agnostic (`LightingSystem`, `packages/engine/src/systems/LightingSystem.ts`); actual pixels come from `RenderSystem.syncLighting()`, which `RenderPipeline.renderFrame()` calls every frame once you call `pipeline.attachLighting(lighting, layerId = "default")` (`attachLighting(null)` detaches and frees the lightmap). The lightmap covers the camera's visible world rect (stage translate and scale; camera rotation is ignored) and the ambient filter is applied to that one layer. It composites an offscreen lightmap texture with `pixi-filters`' `SimpleLightmapFilter`.

## Components

### `LightSource`

| Field               | Type      | Default    | Notes                                                                                                                    |
| ------------------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `radius`            | `number`  | `200`      | World units (px). No contribution beyond this distance.                                                                  |
| `colour`            | `number`  | `0xffffff` | `0xRRGGBB`.                                                                                                              |
| `intensity`         | `number`  | `1`        | Brightness multiplier at the light's centre.                                                                             |
| `falloff`           | `number`  | `1`        | Falloff curve exponent; `1` ≈ linear, `<1` stays bright longer, `>1` fades faster overall.                               |
| `offsetX`/`offsetY` | `number`  | `0`        | Offset from the owning entity's `Transform`.                                                                             |
| `enabled`           | `boolean` | `true`     | A disabled light is skipped entirely — cheaper than add/remove for a torch that's been extinguished.                     |
| `coneAngle`         | `number`  | `360`      | Degrees. `360` is an ordinary point light. A smaller value restricts the light to a pie-slice wedge (a spot/flashlight). |
| `coneDirection`     | `number`  | `0`        | Degrees, cone centre direction. Only matters when `coneAngle < 360`.                                                     |

### `LightOccluder`

Axis-aligned box (`width`, `height`, `offsetX`, `offsetY`, `enabled`) that casts a real shadow — a `LightSource` on the far side no longer illuminates straight through it.

## `LightingSystem`

- `ambient: { colour: number; level: number }` — scene-wide darkness; `level: 0` = pitch black except lit areas, `1` = fully lit.
- `maxLights` (default `32`), `raySamples` (default `32`, angle samples per occluded light's visibility polygon).
- `collectLights(scene, reference?): LightSample[]` — every enabled `LightSource` in `scene`, resolved to world position, capped at `maxLights` (nearest `reference` kept when over the cap). Each sample's `visibility` is a real occlusion-aware polygon (or `null` when nothing nearby could occlude it — the common case, rendered as an ordinary un-masked circle/wedge).

A cone light (`coneAngle < 360`) always produces a real pie-slice polygon, even with zero occluders nearby — see `LightOcclusion.computeVisibilityPolygon()`'s `cone` parameter.
