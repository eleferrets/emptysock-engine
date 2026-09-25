# LightingSystem

Real 2D dynamic point/spot lights with shadow-casting occlusion. Data collection is framework-agnostic (`LightingSystem`, `packages/engine/src/systems/LightingSystem.ts`); actual pixels come from `RenderSystem.syncLighting()`, which composites an offscreen lightmap texture with `pixi-filters`' `SimpleLightmapFilter`.

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

## GML compat — `compat/gmlLighting.ts`

GameMaker itself has no built-in dynamic-lighting API; every real GML project hand-rolls one (a `lightrender`-style controller plus per-instance light objects — the community `Crystal`/`ED5`/"Ultra-Fast 2D Dynamic Lighting" pattern). `gmlLighting.ts` gives a GMS2-imported object's Create event a real, drop-in "attach a light to me" call:

```typescript
GmlActions.light_attach(_entity, _ctx, 150, 0xff8800, {
  coneAngle: 60,
  coneDirection: 90,
});
GmlActions.light_occluder_attach(_entity, _ctx, 32, 96);
GmlActions.lighting_set_ambient(_ctx, 0xffffff, 0.1);
```

| Function                                                   | Signature                                 | Notes                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `light_attach`                                             | `(entity, ctx, radius, colour, options?)` | Attaches/reconfigures a `LightSource`. `options`: `intensity`, `falloff`, `offsetX`/`offsetY`, `coneAngle`, `coneDirection`. |
| `light_set_enabled` / `_colour` / `_radius` / `_intensity` | `(entity, ctx, value)`                    | Live per-frame mutation (flicker, colour-cycling); safe no-op with no `LightSource`.                                         |
| `light_remove`                                             | `(entity, ctx)`                           | Removes the component.                                                                                                       |
| `light_occluder_attach`                                    | `(entity, ctx, width?, height?)`          | Attaches/reconfigures a `LightOccluder`; a default size is used when omitted.                                                |
| `light_occluder_set_enabled` / `_remove`                   | `(entity, ctx, ...)`                      |                                                                                                                              |
| `lighting_set_ambient` / `lighting_get_ambient`            | `(ctx, colour, level)` / `(ctx)`          | Global darkness, against an optional `ctx.lighting: LightingSystem`; a safe no-op/default when none is wired.                |

`GmlLightingContext extends GmlActionContext` adds one optional field, `lighting?: LightingSystem`.
